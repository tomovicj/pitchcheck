"""End-to-end check of the service with a tiny, randomly initialised Gemma 4.

Catches missing dependencies and broken loading or generation without the 10 GB of real
weights. Only the real model's config, processor and tokenizer are downloaded. Replies are
gibberish, so this checks that the pipeline runs, not what Gemma says. From services/analysis:
    python -m scripts.smoke_test
"""

import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid

import torch
from PIL import Image, ImageDraw
from transformers import AutoConfig, AutoModelForMultimodalLM, AutoProcessor, GenerationConfig

from app.main import GEMMA_MODEL, MAX_SEGMENT_S
from app.rubric import RUBRIC_VERSION

PORT = 8765
URL = f"http://127.0.0.1:{PORT}"


def make_tiny_model(out: str):
    config = AutoConfig.from_pretrained(GEMMA_MODEL)
    text = config.text_config
    text.hidden_size, text.intermediate_size, text.num_hidden_layers = 64, 128, 2
    text.num_attention_heads, text.num_key_value_heads, text.head_dim = 2, 1, 32
    if hasattr(text, "global_head_dim"):
        text.global_head_dim = 32
    text.hidden_size_per_layer_input, text.num_kv_shared_layers = 16, 0
    text.layer_types = text.layer_types[:1] + text.layer_types[-1:]
    audio = config.audio_config
    audio.hidden_size, audio.num_hidden_layers, audio.num_attention_heads = 64, 1, 2
    audio.output_proj_dims = text.hidden_size
    vision = config.vision_config
    vision.hidden_size, vision.intermediate_size, vision.num_hidden_layers = 64, 128, 1
    vision.num_attention_heads = vision.num_key_value_heads = 2
    vision.head_dim = vision.global_head_dim = 32

    torch.manual_seed(0)
    model = AutoModelForMultimodalLM.from_config(config, dtype=torch.bfloat16)
    model.generation_config = GenerationConfig.from_pretrained(GEMMA_MODEL)
    model.save_pretrained(out)
    AutoProcessor.from_pretrained(GEMMA_MODEL).save_pretrained(out)

    # The real config overrides layers that the 2-layer model does not have
    path = os.path.join(out, "config.json")
    with open(path) as f:
        saved = json.load(f)
    saved["text_config"]["per_layer_config"] = None
    with open(path, "w") as f:
        json.dump(saved, f)


def make_recording(path: str):
    """45 s of tone with silent gaps, so there is more than one segment and a cut at a pause."""
    tone = "sine=frequency=160:duration=20"
    gap = "anullsrc=r=16000:cl=mono:d=1"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", tone, "-f", "lavfi", "-i", gap, "-f", "lavfi", "-i", tone,
         "-f", "lavfi", "-i", gap, "-f", "lavfi", "-i", "sine=frequency=160:duration=3",
         "-filter_complex", "[0][1][2][3][4]concat=n=5:v=0:a=1", "-ar", "44100", path],
        check=True,
    )


def wait_for_health(server: subprocess.Popen, timeout_s: float = 300):
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if server.poll() is not None:
            sys.exit(f"service exited during startup with code {server.returncode}")
        try:
            with urllib.request.urlopen(f"{URL}/health", timeout=2):
                return
        except OSError:
            time.sleep(1)
    sys.exit("service did not become healthy")


def make_deck(path: str):
    """Two slides as a PDF of images: no text layer, so only the part of the deck analysis that needs Gemma runs."""
    pages = []
    for title in ("The problem", "Our solution"):
        page = Image.new("RGB", (960, 540), "white")
        ImageDraw.Draw(page).text((80, 80), title, fill="black")
        pages.append(page)
    pages[0].save(path, save_all=True, append_images=pages[1:])


def post(endpoint: str, files: dict[str, str]) -> list[dict]:
    """Upload files as multipart form fields and return the NDJSON events of the reply."""
    boundary = uuid.uuid4().hex
    body = b""
    for field, path in files.items():
        with open(path, "rb") as f:
            content = f.read()
        body += (
            f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{os.path.basename(path)}"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n"
        ).encode() + content + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    request = urllib.request.Request(
        f"{URL}{endpoint}", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(request, timeout=600) as res:
        return [json.loads(line) for line in res if line.strip()]


def result_of(events: list[dict], stages: set[str]) -> dict:
    """The result at the end of a stream, after checking that it ran without an error through the stages."""
    errors = [e for e in events if e["type"] == "error"]
    assert not errors, f"analysis failed: {errors}"
    seen = {e["stage"] for e in events if e["type"] == "progress"}
    assert stages <= seen, f"missing stages: {sorted(stages - seen)}"
    assert events[-1]["type"] == "result", f"last event is not the result: {events[-1]}"
    return events[-1]["data"]


def check_file(data: dict, path: str):
    """The fingerprint in a result is the salted SHA-256 of the file that was uploaded."""
    with open(path, "rb") as f:
        content = f.read()
    file = data["file"]
    assert file["bytes"] == len(content), f"fingerprint counts {file['bytes']} bytes of {len(content)}"
    expected = hashlib.sha256(bytes.fromhex(file["salt"]) + content).hexdigest()
    assert file["sha256"] == expected, "fingerprint does not match the uploaded file"
    assert len(data["setup"]["code_sha256"]) == 64, f"no code hash in the setup: {data['setup']}"
    assert data["setup"]["rubric"] == RUBRIC_VERSION, f"no rubric version in the setup: {data['setup']}"


def check_summary(data: dict, measured: str):
    """The group of criteria that needs no reply from Gemma is rated, and every rated criterion names its standard."""
    summary = data["summary"]
    assert measured in summary["subscores"], f"the {measured} group was not rated: {summary['subscores']}"
    for c in summary["criteria"]:
        assert c["level"] in range(5) and c["target"] and c["standard"]["by"], f"incomplete criterion: {c}"
    assert isinstance(summary["checklist"], list), f"no checklist in the summary: {sorted(summary)}"


def check_pitch(data: dict):
    segments = data["segments"]
    assert len(segments) >= 2, f"expected the recording to be split, got {len(segments)} segment(s)"
    for s in segments:
        assert s["end_s"] - s["start_s"] <= MAX_SEGMENT_S, f"segment longer than {MAX_SEGMENT_S}s: {s}"
        assert s["observations"] is not None or s.get("raw") is not None, f"segment without a reply: {s}"
    assert data["pauses"]["pause_count"] >= 1, f"expected the silent gaps as pauses: {data['pauses']}"
    check_summary(data, "delivery")


def check_deck(data: dict):
    assert data["page_count"] == 2 and len(data["slides"]) == 2, f"expected two slides: {data}"
    assert not data["text_layer"], "a PDF of images has no text layer"
    for s in data["slides"]:
        assert s["observations"] is not None or s.get("raw") is not None, f"slide without a reply: {s}"
    check_summary(data, "design")


def main():
    with tempfile.TemporaryDirectory() as tmp:
        model_dir = os.path.join(tmp, "tiny-gemma")
        recording = os.path.join(tmp, "clip.wav")
        slides = os.path.join(tmp, "deck.pdf")
        make_tiny_model(model_dir)
        make_recording(recording)
        make_deck(slides)

        env = {**os.environ, "GEMMA_MODEL": model_dir, "HF_HUB_OFFLINE": "1"}
        server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)], env=env
        )
        try:
            wait_for_health(server)
            pitch_events = post("/analyze/stream", {"file": recording})
            deck_events = post("/deck/stream", {"file": slides})
            check_events = post("/check/stream", {"recording": recording, "deck": slides})
        finally:
            server.terminate()
            server.wait(timeout=30)

        pitch_stages, deck_stages = {"measuring", "listening", "scoring"}, {"reading", "reviewing"}
        pitch = result_of(pitch_events, pitch_stages)
        check_pitch(pitch)
        check_deck(result_of(deck_events, deck_stages))
        both = result_of(check_events, pitch_stages | deck_stages | {"aligning"})
        check_pitch(both["pitch"])
        check_deck(both["deck"])
        # While the files still exist
        check_file(both["pitch"], recording)
        check_file(both["deck"], slides)
        assert "alignment" in both, f"the combined check has no alignment entry: {sorted(both)}"
    print(f"smoke test passed: pitch with {len(pitch['segments'])} segments, deck with 2 slides, combined check")


if __name__ == "__main__":
    main()
