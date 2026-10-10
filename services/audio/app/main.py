"""Local speech analysis: transcript + cadence, pitch/tonality, and emotion."""

import os
import subprocess
import tempfile
from contextlib import asynccontextmanager

import numpy as np
import parselmouth
from fastapi import FastAPI, File, HTTPException, UploadFile
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


@asynccontextmanager
async def lifespan(_: FastAPI):
    models["whisper"] = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    models["emotion"] = pipeline("audio-classification", model=EMOTION_MODEL, device=-1)
    yield
    models.clear()


app = FastAPI(title="pitchcheck-audio", lifespan=lifespan)


def decode(path: str) -> np.ndarray:
    """Decode any ffmpeg-readable file to 16 kHz mono float32."""
    result = subprocess.run(
        ["ffmpeg", "-nostdin", "-i", path, "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
        capture_output=True,
    )
    if result.returncode != 0:
        raise HTTPException(400, "Could not decode audio file")
    return np.frombuffer(result.stdout, dtype=np.float32)


def analyze_speech(audio: np.ndarray) -> dict:
    segments, info = models["whisper"].transcribe(audio, word_timestamps=True, vad_filter=True)
    words = [w for s in segments for w in s.words or []]
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


def analyze_emotion(audio: np.ndarray) -> dict:
    window = int(EMOTION_WINDOW_S * SAMPLE_RATE)
    chunks = [(i, audio[i : i + window]) for i in range(0, len(audio), window)]
    chunks = [(i, c) for i, c in chunks if len(c) >= SAMPLE_RATE]  # skip tails under 1s
    if not chunks:
        return {"overall": {}, "timeline": []}

    results = models["emotion"](
        [{"raw": c, "sampling_rate": SAMPLE_RATE} for _, c in chunks], top_k=None
    )

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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(suffix=os.path.splitext(file.filename or "")[1]) as tmp:
        tmp.write(file.file.read())
        tmp.flush()
        audio = decode(tmp.name)

    if audio.size < SAMPLE_RATE:
        raise HTTPException(400, "Audio is shorter than 1 second")

    return {
        "duration_s": round(audio.size / SAMPLE_RATE, 2),
        "speech": analyze_speech(audio),
        "prosody": analyze_prosody(audio),
        "emotion": analyze_emotion(audio),
    }
