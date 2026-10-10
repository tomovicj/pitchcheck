"""Local pitch delivery analysis: signal measurements with Praat, judgement with Gemma."""

import json
import os
import queue
import re
import shutil
import subprocess
import tempfile
import threading
from collections.abc import Callable
from contextlib import asynccontextmanager

import numpy as np
import parselmouth
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from transformers import AutoModelForMultimodalLM, AutoProcessor, GenerationConfig

SAMPLE_RATE = 16_000
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "google/gemma-4-E2B-it")
# "auto" uses the checkpoint's dtype (bf16); GPUs without bf16, such as the T4, need float16
GEMMA_DTYPE = os.getenv("GEMMA_DTYPE", "auto")
# Gemma accepts audio clips of at most 30 seconds
MAX_SEGMENT_S = 30.0
MIN_SEGMENT_S = 1.0
PAUSE_THRESHOLD_S = 0.5

models = {}


def load_models():
    # Processor and model directly, as in the Gemma 4 examples: the any-to-any pipeline
    # insists on librosa for audio even when it is given decoded arrays.
    models["processor"] = AutoProcessor.from_pretrained(GEMMA_MODEL)
    # On CPU, "auto" offloads layers to disk when RAM looks short, which makes generation unusably slow.
    # Load everything into RAM instead; the bf16 weights need about 10 GB for E2B.
    device_map = "auto" if torch.cuda.is_available() else "cpu"
    models["gemma"] = AutoModelForMultimodalLM.from_pretrained(GEMMA_MODEL, device_map=device_map, dtype=GEMMA_DTYPE)
    config = GenerationConfig.from_pretrained(GEMMA_MODEL)
    # Greedy decoding so the same recording gets the same scores
    config.do_sample = False
    config.max_new_tokens = 600
    models["generation_config"] = config


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_models()
    yield
    models.clear()


app = FastAPI(title="pitchcheck-audio", lifespan=lifespan)


def decode(path: str) -> np.ndarray:
    """Decode the audio track of any ffmpeg-readable audio or video file to 16 kHz mono float32."""
    result = subprocess.run(
        ["ffmpeg", "-nostdin", "-i", path, "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
        capture_output=True,
    )
    if b"does not contain any stream" in result.stderr:
        raise HTTPException(400, "The file has no audio track")
    if result.returncode != 0:
        raise HTTPException(400, "Could not decode the file")
    return np.frombuffer(result.stdout, dtype=np.float32)


def to_sound(audio: np.ndarray) -> parselmouth.Sound:
    return parselmouth.Sound(audio.astype(np.float64), sampling_frequency=SAMPLE_RATE)


def find_silences(audio: np.ndarray) -> list[tuple[float, float]]:
    """Silent stretches of at least PAUSE_THRESHOLD_S, from intensity (25 dB below the peak)."""
    sound = to_sound(audio)
    grid = parselmouth.praat.call(
        sound, "To TextGrid (silences)", 100, 0, -25, PAUSE_THRESHOLD_S, 0.1, "silent", "sounding"
    )
    silences = []
    for i in range(1, parselmouth.praat.call(grid, "Get number of intervals", 1) + 1):
        if parselmouth.praat.call(grid, "Get label of interval", 1, i) == "silent":
            start = parselmouth.praat.call(grid, "Get start time of interval", 1, i)
            end = parselmouth.praat.call(grid, "Get end time of interval", 1, i)
            silences.append((start, end))
    return silences


def inner_pauses(silences: list[tuple[float, float]], start: float, end: float) -> list[float]:
    """Pause lengths within [start, end], ignoring silence before the first and after the last sound."""
    pauses = []
    for s, e in silences:
        s, e = max(s, start), min(e, end)
        if e - s >= PAUSE_THRESHOLD_S and s > start and e < end:
            pauses.append(e - s)
    return pauses


def analyze_pauses(silences: list[tuple[float, float]], duration: float) -> dict:
    pauses = inner_pauses(silences, 0.0, duration)
    edges = sum(e - s for s, e in silences if s <= 0.0 or e >= duration)
    speaking = duration - edges - sum(pauses)
    return {
        "pause_count": len(pauses),
        "total_pause_s": round(sum(pauses), 2),
        "mean_pause_s": round(float(np.mean(pauses)), 2) if pauses else 0.0,
        "longest_pause_s": round(max(pauses), 2) if pauses else 0.0,
        # Share of the time between first and last sound spent talking
        "speaking_ratio": round(speaking / (duration - edges), 2) if duration > edges else 0.0,
    }


def segment(duration: float, silences: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Split into segments of at most MAX_SEGMENT_S, cutting in the middle of a pause where possible."""
    segments, start = [], 0.0
    while duration - start > MAX_SEGMENT_S:
        limit = start + MAX_SEGMENT_S
        middles = [(s + e) / 2 for s, e in silences]
        cuts = [m for m in middles if start + MIN_SEGMENT_S <= m <= limit]
        # No pause in this stretch: cut mid-word rather than exceed what Gemma accepts
        cut = cuts[-1] if cuts else limit
        segments.append((start, cut))
        start = cut
    if duration - start >= MIN_SEGMENT_S:
        segments.append((start, duration))
    return segments


def measure(audio: np.ndarray) -> dict | None:
    sound = to_sound(audio)
    f0 = sound.to_pitch().selected_array["frequency"]
    voiced = f0[f0 > 0]
    if voiced.size == 0:
        return None

    # Pitch variation in semitones is speaker-independent; low values = monotone delivery
    semitones = 12 * np.log2(voiced / np.median(voiced))
    intensity = sound.to_intensity().values[0]

    return {
        "pitch_mean_hz": round(float(voiced.mean()), 1),
        "pitch_median_hz": round(float(np.median(voiced)), 1),
        "pitch_p5_hz": round(float(np.percentile(voiced, 5)), 1),
        "pitch_p95_hz": round(float(np.percentile(voiced, 95)), 1),
        "pitch_std_semitones": round(float(semitones.std()), 2),
        "pitch_range_semitones": round(float(np.percentile(semitones, 95) - np.percentile(semitones, 5)), 2),
        "voiced_ratio": round(voiced.size / f0.size, 2),
        "intensity_mean_db": round(float(intensity.mean()), 1),
        "intensity_std_db": round(float(intensity.std()), 1),
    }


def parse_json(text: str) -> dict | None:
    text = re.sub(r"```(?:json)?", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        value = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def generate(messages: list[dict]) -> str:
    processor, model = models["processor"], models["gemma"]
    inputs = processor.apply_chat_template(
        messages, tokenize=True, return_dict=True, return_tensors="pt", add_generation_prompt=True
    ).to(model.device, dtype=model.dtype)
    with torch.inference_mode():
        output = model.generate(**inputs, generation_config=models["generation_config"])
    # Decode only the reply, not the prompt
    return processor.decode(output[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True)


def ask_gemma(content: list[dict]) -> tuple[dict | None, str]:
    """Send one user turn and parse a JSON object from the reply, retrying once if it does not parse."""
    raw = ""
    for attempt in range(2):
        if attempt:
            content = [*content, {"type": "text", "text": "Your previous reply was not valid JSON. Return only the JSON object."}]
        raw = generate([{"role": "user", "content": content}])
        if (parsed := parse_json(raw)) is not None:
            return parsed, raw
    return None, raw


def describe_measurements(measurements: dict | None, pause_ratio: float | None = None) -> str:
    if measurements is None:
        return "Signal measurements: no voiced speech detected."
    lines = [
        "Signal measurements for this audio (from Praat):",
        f"- Pitch variation: {measurements['pitch_std_semitones']} semitones std "
        "(under 2 usually sounds monotone, over 4 expressive)",
        f"- Pitch range (5th-95th percentile): {measurements['pitch_range_semitones']} semitones",
        f"- Loudness variation: {measurements['intensity_std_db']} dB std",
        f"- Voiced share of frames: {measurements['voiced_ratio']}",
    ]
    if pause_ratio is not None:
        lines.append(f"- Share of time in pauses of {PAUSE_THRESHOLD_S}s or longer: {pause_ratio}")
    return "\n".join(lines)


SEGMENT_PROMPT = """You are a presentation coach listening to one segment of a startup pitch, from {start} to {end} in the recording.
Judge how it is delivered: tone of voice, emotion, energy, pace, hesitation and filler words. Do not judge the business idea.
Base your answer on what you hear in the audio. Use the measurements below as supporting evidence.

{measurements}

Reply with only a JSON object in this shape:
{{"tone": "short description of the tone of voice",
 "emotion": "the dominant emotion the speaker conveys, one or two words",
 "energy": "low" | "medium" | "high",
 "pace": "slow" | "conversational" | "fast",
 "filler_words": ["each filler word or sound you hear, e.g. um, uh, like"],
 "topics": ["short names of the topics covered in this segment"],
 "observations": "one or two sentences on what works and what does not in this delivery"}}"""


def observe_segment(clip: np.ndarray, start: float, end: float, measurements: dict | None, pause_ratio: float) -> dict:
    prompt = SEGMENT_PROMPT.format(
        start=format_time(start),
        end=format_time(end),
        measurements=describe_measurements(measurements, pause_ratio),
    )
    # Audio after the text, as recommended for Gemma 4
    observations, raw = ask_gemma([{"type": "text", "text": prompt}, {"type": "audio", "audio": clip}])
    return {"observations": observations, **({} if observations else {"raw": raw})}


SCORE_PROMPT = """You are a presentation coach scoring the delivery of a startup pitch. Score how it was delivered, never the business idea or its market potential.

Whole recording: {duration}.
{measurements}
Pauses: {pauses}

Observations per segment, made while listening to the audio:
{segments}

Score each criterion from 0 to 100:
- Vocal variety: pitch and loudness change to carry meaning, not monotone.
- Energy and confidence: sounds engaged and sure, not flat or nervous.
- Pace and pauses: easy to follow, pauses used deliberately, not rushed or dragging.
- Clarity: few filler words and hesitations.
- Structure: the topics follow a clear order a listener can track.

Reply with only a JSON object in this shape:
{{"criteria": [{{"name": "Vocal variety", "score": 0, "reason": "one sentence"}}, ...one entry per criterion above],
 "pitch_score": 0,
 "insights": ["what the analysis found, 3 to 5 short statements"],
 "feedback": [{{"at_s": 0, "text": "one concrete thing to change"}}]}}
pitch_score is the overall delivery score from 0 to 100. Give 3 to 5 feedback items. Set at_s to the second in the recording the feedback refers to, or null if it applies to the whole pitch."""


def score_pitch(duration: float, prosody: dict | None, pauses: dict, segments: list[dict]) -> dict | None:
    described = []
    for s in segments:
        observations = json.dumps(s["observations"]) if s["observations"] else "(no observations)"
        described.append(f"- {format_time(s['start_s'])}-{format_time(s['end_s'])} (starts at {s['start_s']}s): {observations}")
    prompt = SCORE_PROMPT.format(
        duration=format_time(duration),
        measurements=describe_measurements(prosody),
        pauses=json.dumps(pauses),
        segments="\n".join(described),
    )
    summary, _ = ask_gemma([{"type": "text", "text": prompt}])
    return summary


def format_time(seconds: float) -> str:
    return f"{int(seconds // 60)}:{int(seconds % 60):02d}"


def run_analysis(audio: np.ndarray, report: Callable[[str, float], None]) -> dict:
    """Run every step, reporting (stage, overall 0-1 progress) along the way."""
    # Weights reflect where the time goes: one Gemma call per segment dominates
    duration = audio.size / SAMPLE_RATE
    report("measuring", 0.0)
    silences = find_silences(audio)
    pauses = analyze_pauses(silences, duration)
    prosody = measure(audio)
    bounds = segment(duration, silences)

    report("listening", 0.05)
    segments = []
    for n, (start, end) in enumerate(bounds, start=1):
        clip = audio[int(start * SAMPLE_RATE) : int(end * SAMPLE_RATE)]
        measurements = measure(clip)
        pause_ratio = round(sum(inner_pauses(silences, start, end)) / (end - start), 2)
        segments.append({
            "start_s": round(start, 2),
            "end_s": round(end, 2),
            "measurements": measurements,
            "pause_ratio": pause_ratio,
            **observe_segment(clip, start, end, measurements, pause_ratio),
        })
        report("listening", 0.05 + 0.85 * n / len(bounds))

    report("scoring", 0.9)
    summary = score_pitch(duration, prosody, pauses, segments) if segments else None
    return {
        "duration_s": round(duration, 2),
        "model": GEMMA_MODEL,
        "prosody": prosody,
        "pauses": pauses,
        "segments": segments,
        "summary": summary,
    }


def load_upload(file: UploadFile | None) -> np.ndarray:
    if file is None:
        raise HTTPException(400, "No file uploaded")

    # Copy in chunks: uploads can be large videos
    with tempfile.NamedTemporaryFile(suffix=os.path.splitext(file.filename or "")[1]) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp.flush()
        audio = decode(tmp.name)

    if audio.size < SAMPLE_RATE:
        raise HTTPException(400, "Audio is shorter than 1 second")
    return audio


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze(file: UploadFile | None = File(None)):
    return run_analysis(load_upload(file), lambda *_: None)


@app.post("/analyze/stream")
def analyze_stream(file: UploadFile | None = File(None)):
    """Same as /analyze, but streams NDJSON progress events before the result."""
    audio = load_upload(file)
    events = queue.Queue()

    def work():
        try:
            result = run_analysis(
                audio,
                lambda stage, p: events.put({"type": "progress", "stage": stage, "progress": round(p, 3)}),
            )
            events.put({"type": "result", "data": result})
        except Exception:
            events.put({"type": "error", "message": "Analysis failed"})
            raise
        finally:
            events.put(None)

    def stream():
        threading.Thread(target=work, daemon=True).start()
        while (event := events.get()) is not None:
            yield json.dumps(event) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")
