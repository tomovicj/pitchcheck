"""Local speech analysis: transcript + cadence, pitch/tonality, and emotion."""

import json
import os
import queue
import shutil
import subprocess
import tempfile
import threading
from collections.abc import Callable
from contextlib import asynccontextmanager

import numpy as np
import parselmouth
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from faster_whisper import WhisperModel
from transformers import pipeline

SAMPLE_RATE = 16_000
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
EMOTION_MODEL = os.getenv("EMOTION_MODEL", "superb/wav2vec2-base-superb-er")
EMOTION_WINDOW_S = float(os.getenv("EMOTION_WINDOW_S", "5"))
PAUSE_THRESHOLD_S = 0.5
FILLERS = {"um", "uh", "uhm", "umm", "er", "erm", "ah", "hmm", "mm"}
EMOTION_LABELS = {"neu": "neutral", "hap": "happy", "ang": "angry", "sad": "sad"}

models = {}

# Called with a 0-1 fraction of the current step's work
OnProgress = Callable[[float], None]


@asynccontextmanager
async def lifespan(_: FastAPI):
    models["whisper"] = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    models["emotion"] = pipeline("audio-classification", model=EMOTION_MODEL, device=-1)
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


def analyze_speech(audio: np.ndarray, on_progress: OnProgress) -> dict:
    duration = audio.size / SAMPLE_RATE
    segments, info = models["whisper"].transcribe(audio, word_timestamps=True, vad_filter=True)
    words = []
    # Segments are generated lazily, so transcription happens inside this loop
    for segment in segments:
        words.extend(segment.words or [])
        on_progress(min(segment.end / duration, 1.0))
    transcript = "".join(w.word for w in words).strip()
    if not words:
        return {"language": info.language, "transcript": transcript, "word_count": 0}

    gaps = [b.start - a.end for a, b in zip(words, words[1:])]
    pauses = [g for g in gaps if g >= PAUSE_THRESHOLD_S]
    span = words[-1].end - words[0].start
    speaking_time = span - sum(pauses)
    fillers = [w.word.strip(" ,.?!").lower() for w in words]
    fillers = [w for w in fillers if w in FILLERS]

    return {
        "language": info.language,
        "transcript": transcript,
        "word_count": len(words),
        "words_per_minute": round(len(words) / span * 60, 1) if span > 0 else None,
        # Rate while actually talking, excluding pauses
        "articulation_rate_wpm": round(len(words) / speaking_time * 60, 1) if speaking_time > 0 else None,
        "pause_count": len(pauses),
        "total_pause_s": round(sum(pauses), 2),
        "mean_pause_s": round(float(np.mean(pauses)), 2) if pauses else 0.0,
        "longest_pause_s": round(max(pauses), 2) if pauses else 0.0,
        "filler_count": len(fillers),
        "fillers": sorted(set(fillers)),
    }


def analyze_prosody(audio: np.ndarray) -> dict | None:
    sound = parselmouth.Sound(audio.astype(np.float64), sampling_frequency=SAMPLE_RATE)
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


def analyze_emotion(audio: np.ndarray, on_progress: OnProgress) -> dict:
    window = int(EMOTION_WINDOW_S * SAMPLE_RATE)
    chunks = [(i, audio[i : i + window]) for i in range(0, len(audio), window)]
    chunks = [(i, c) for i, c in chunks if len(c) >= SAMPLE_RATE]  # skip tails under 1s
    if not chunks:
        return {"overall": {}, "timeline": []}

    results = []
    for n, (_, chunk) in enumerate(chunks, start=1):
        results.append(models["emotion"]({"raw": chunk, "sampling_rate": SAMPLE_RATE}, top_k=None))
        on_progress(n / len(chunks))

    timeline, totals = [], {}
    for (start, chunk), scores in zip(chunks, results):
        scores = {EMOTION_LABELS.get(s["label"], s["label"]): s["score"] for s in scores}
        for label, score in scores.items():
            totals[label] = totals.get(label, 0.0) + score
        top = max(scores, key=scores.get)
        timeline.append({
            "start_s": round(start / SAMPLE_RATE, 2),
            "end_s": round((start + len(chunk)) / SAMPLE_RATE, 2),
            "label": top,
            "scores": {k: round(v, 3) for k, v in scores.items()},
        })

    overall = {k: round(v / len(timeline), 3) for k, v in totals.items()}
    return {"overall": dict(sorted(overall.items(), key=lambda kv: -kv[1])), "timeline": timeline}


def run_analysis(audio: np.ndarray, report: Callable[[str, float], None]) -> dict:
    """Run every step, reporting (stage, overall 0-1 progress) along the way."""
    # Weights reflect measured timings on CPU: transcription dominates
    report("transcribing", 0.0)
    speech = analyze_speech(audio, lambda p: report("transcribing", 0.9 * p))
    report("analyzing_pitch", 0.9)
    prosody = analyze_prosody(audio)
    emotion = analyze_emotion(audio, lambda p: report("detecting_emotion", 0.91 + 0.09 * p))
    return {
        "duration_s": round(audio.size / SAMPLE_RATE, 2),
        "speech": speech,
        "prosody": prosody,
        "emotion": emotion,
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
