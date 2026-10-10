"""End-to-end check of the service with a tiny, randomly initialised Gemma 4.

Catches missing dependencies and broken loading or generation without the 10 GB of real
weights. Only the real model's config, processor and tokenizer are downloaded. Replies are
gibberish, so this checks that the pipeline runs, not what Gemma says. From services/audio:
    python -m scripts.smoke_test
"""

import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
import uuid

import torch
from transformers import AutoConfig, AutoModelForMultimodalLM, AutoProcessor, GenerationConfig

from app.main import GEMMA_MODEL, MAX_SEGMENT_S

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


def analyze(path: str) -> list[dict]:
    boundary = uuid.uuid4().hex
    with open(path, "rb") as f:
        audio = f.read()
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="clip.wav"\r\n'
        "Content-Type: audio/wav\r\n\r\n"
    ).encode() + audio + f"\r\n--{boundary}--\r\n".encode()
    request = urllib.request.Request(
        f"{URL}/analyze/stream", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(request, timeout=600) as res:
        return [json.loads(line) for line in res if line.strip()]


def main():
    with tempfile.TemporaryDirectory() as tmp:
        model_dir = os.path.join(tmp, "tiny-gemma")
        recording = os.path.join(tmp, "clip.wav")
        make_tiny_model(model_dir)
        make_recording(recording)

        env = {**os.environ, "GEMMA_MODEL": model_dir, "HF_HUB_OFFLINE": "1"}
        server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)], env=env
        )
        try:
            wait_for_health(server)
            events = analyze(recording)
        finally:
            server.terminate()
            server.wait(timeout=30)

    errors = [e for e in events if e["type"] == "error"]
    assert not errors, f"analysis failed: {errors}"
    stages = [e["stage"] for e in events if e["type"] == "progress"]
    assert {"measuring", "listening", "scoring"} <= set(stages), f"missing stages: {stages}"
    result = events[-1]
    assert result["type"] == "result", f"last event is not the result: {result}"
    data = result["data"]
    segments = data["segments"]
    assert len(segments) >= 2, f"expected the recording to be split, got {len(segments)} segment(s)"
    for s in segments:
        assert s["end_s"] - s["start_s"] <= MAX_SEGMENT_S, f"segment longer than {MAX_SEGMENT_S}s: {s}"
        assert s["observations"] is not None or s.get("raw") is not None, f"segment without a reply: {s}"
    assert data["pauses"]["pause_count"] >= 1, f"expected the silent gaps as pauses: {data['pauses']}"
    print(f"smoke test passed: {len(segments)} segments, stages {sorted(set(stages))}")


if __name__ == "__main__":
    main()
