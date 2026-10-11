"""Local pitch delivery analysis: signal measurements with Praat, judgement with Gemma."""

import hashlib
import json
import logging
import os
import pathlib
import queue
import re
import subprocess
import tempfile
import threading
import time
from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import TypeVar

import numpy as np
import parselmouth
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from transformers import AutoModelForMultimodalLM, AutoProcessor, GenerationConfig
from transformers.generation.streamers import BaseStreamer

from app import alignment, deck, rubric

SAMPLE_RATE = 16_000
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "google/gemma-4-E2B-it")
# "auto" uses the checkpoint's dtype (bf16); GPUs without bf16, such as the T4, need float16
GEMMA_DTYPE = os.getenv("GEMMA_DTYPE", "auto")
# On CPU, "auto" offloads layers to disk when RAM looks short, which makes generation unusably slow,
# so the default keeps everything in RAM there; the bf16 weights need about 10 GB for E2B.
GEMMA_DEVICE_MAP = os.getenv("GEMMA_DEVICE_MAP") or ("auto" if torch.cuda.is_available() else "cpu")
# Gemma accepts audio clips of at most 30 seconds. The default is shorter: of a 27-second segment Gemma
# returned the first two thirds of what was said, and of segments under 20 seconds all of it, which the
# comparison with the deck depends on. SEGMENT_SECONDS changes it; more than 30 is not possible.
MAX_SEGMENT_S = min(30.0, float(os.getenv("SEGMENT_SECONDS") or 20))
MIN_SEGMENT_S = 1.0
PAUSE_THRESHOLD_S = 0.5
# Frames this far below the loudest one count as silence
SILENCE_BELOW_PEAK_DB = 25.0
# Speaking rate in syllables per second of speaking, outside which a segment counts as slow or fast.
# Gemma did not hear pace: it called the same text at 124, 169 and 343 words a minute "conversational"
# every time, so pace is measured. The limits are a convention, about 100 and 215 words a minute on
# the synthetic voice they were tried on; published advice disagrees, so only the extremes are marked.
SLOW_SYLLABLES_PER_S = 2.7
FAST_SYLLABLES_PER_S = 5.5
# Limits for the other criteria rated from the signal. All three are conventions the team chose, with no
# study behind them: Gemma gave a steady synthetic voice a different loudness level from one run to the
# next, so these levels are arithmetic too, and the limits are here to be argued with.
LONG_PAUSE_S = 2.0  # a pause longer than this counts against the pauses criterion
EVEN_PITCH_SEMITONES = 2.0  # a segment whose pitch varies by less than this (std) counts as even
QUIET_BELOW_MEAN_DB = 6.0  # a segment this much quieter than the whole recording counts as quiet
UNEVEN_LOUDNESS_DB = 9.0  # a segment whose loudness varies by more than this (std) counts as uneven
MAX_DECK_BYTES = 50 * 2**20

# Rated in code: the level is arithmetic on a count or a share, and Gemma did not apply numeric limits
# reliably when asked to. It called 5.7 filler words a minute "5 or fewer", and a pitch with two
# expected topics missing complete. Pace comes from the measured speaking rate; filler words and
# topic coverage from what Gemma heard in each segment.
PACE_CRITERION = "Pace"
FILLER_CRITERION = "Filler words"
# Rated in code, and only when the event's time limit came with the recording
TIME_CRITERION = "Time"

# Delivery rubric: one description per level, from 4 down to 0. Levels describe what is heard or measured,
# never the speaker's state of mind. Only the filler word levels rest on research (Laske and DiGennaro Reed
# 2024, one study, English; nothing is known between 5 and 12 per minute). The rest are conventions.
RUBRIC = {
    PACE_CRITERION: rubric.time_share_levels("is spoken slowly or fast"),
    FILLER_CRITERION: [
        "5 or fewer per minute",
        "more than 5 and up to 7 per minute",
        "more than 7 and up to 10 per minute",
        "more than 10 and under 12 per minute",
        "12 or more per minute",
    ],
    "Pauses": [
        f"no pause longer than {LONG_PAUSE_S:g} seconds",
        f"at most one pause longer than {LONG_PAUSE_S:g} seconds a minute",
        "at most two a minute",
        "at most four a minute",
        f"more than four pauses longer than {LONG_PAUSE_S:g} seconds a minute",
    ],
    "Pitch variation": rubric.time_share_levels("has even pitch"),
    "Loudness": rubric.time_share_levels("is much quieter than the rest or swings in loudness"),
    TIME_CRITERION: [
        "within the event's time limit",
        "over the limit by up to 5%",
        "over the limit by up to 10%",
        "over the limit by up to 20%",
        "over the limit by more than 20%",
    ],
    rubric.TOPIC_CRITERION: rubric.TOPIC_LEVELS,
    "Structure and flow": [
        "opens by saying what the team does, the topics follow in an order a listener can track, "
        "and it ends with a closing message or a next step",
        "one of the three is weak",
        "one of the three is missing",
        "two of the three are missing",
        "no opening, no order and no closing",
    ],
}
# Gemma rates the criterion that is a judgement of what was said; the rest follow from the signal and from counts
GEMMA_CRITERIA = ["Structure and flow"]

T = TypeVar("T")

models = {}
analysis_lock = threading.Lock()
logger = logging.getLogger("uvicorn.error")


def load_models():
    # Processor and model directly, as in the Gemma 4 examples: the any-to-any pipeline
    # insists on librosa for audio even when it is given decoded arrays.
    models["processor"] = AutoProcessor.from_pretrained(GEMMA_MODEL)
    model = AutoModelForMultimodalLM.from_pretrained(GEMMA_MODEL, device_map=GEMMA_DEVICE_MAP, dtype=GEMMA_DTYPE)
    models["gemma"] = model
    devices = set(getattr(model, "hf_device_map", {"": model.device}).values())
    logger.info("Gemma model placement: %s", sorted(str(device) for device in devices))
    if "disk" in devices:
        logger.warning("Gemma weights are offloaded to disk; generation may take minutes per segment. "
                       "If enough RAM is available, use GEMMA_DEVICE_MAP=cpu to keep weights in memory.")
    config = GenerationConfig.from_pretrained(GEMMA_MODEL)
    # Greedy decoding so the same recording gets the same scores
    config.do_sample = False
    config.max_new_tokens = 800
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
    """Silent stretches of at least PAUSE_THRESHOLD_S, from intensity (SILENCE_BELOW_PEAK_DB below the peak)."""
    sound = to_sound(audio)
    grid = parselmouth.praat.call(
        sound, "To TextGrid (silences)", 100, 0, -SILENCE_BELOW_PEAK_DB, PAUSE_THRESHOLD_S, 0.1, "silent", "sounding"
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
        "long_pause_count": sum(p > LONG_PAUSE_S for p in pauses),
        # Share of the time between first and last sound spent talking
        "speaking_ratio": round(speaking / (duration - edges), 2) if duration > edges else 0.0,
        # From the first sound to the last: the length of the pitch without leading and trailing silence
        "spoken_s": round(duration - edges, 2),
    }


def segment(duration: float, silences: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Split into segments of at most MAX_SEGMENT_S, cutting in the middle of a pause where possible."""
    segments, start = [], 0.0
    while duration - start > MAX_SEGMENT_S:
        limit = start + MAX_SEGMENT_S
        # When what is left fits in two segments, aim for its middle so the last one is not a stub of a second or two
        left = duration - start
        target = start + left / 2 if left <= 2 * MAX_SEGMENT_S else limit
        middles = [(s + e) / 2 for s, e in silences]
        cuts = [m for m in middles if start + MIN_SEGMENT_S <= m <= limit]
        # No pause in this stretch: cut mid-word rather than exceed what Gemma accepts
        cut = min(cuts, key=lambda m: abs(m - target)) if cuts else target
        segments.append((start, cut))
        start = cut
    if duration - start >= MIN_SEGMENT_S:
        segments.append((start, duration))
    return segments


def silent_time(silences: list[tuple[float, float]], start: float, end: float) -> float:
    """Seconds of silence within [start, end], the edges of the recording included."""
    return sum(max(0.0, min(e, end) - max(s, start)) for s, e in silences)


def count_syllables(sound: parselmouth.Sound) -> int:
    """Syllable nuclei after de Jong and Wempe (2009): voiced peaks in loudness, each followed by a dip of 2 dB or more."""
    intensity = sound.to_intensity(minimum_pitch=50)
    values, times = intensity.values[0], intensity.xs()
    pitch = sound.to_pitch()
    threshold = np.percentile(values, 99) - SILENCE_BELOW_PEAK_DB
    peaks = [i for i in range(1, len(values) - 1) if values[i - 1] < values[i] >= values[i + 1] and values[i] > threshold]
    count = 0
    for peak, following in zip(peaks, peaks[1:] + [len(values)]):
        if values[peak] - values[peak:following].min() > 2 and not np.isnan(pitch.get_value_at_time(times[peak])):
            count += 1
    return count


def pace_of(syllable_rate: float | None) -> str | None:
    """Slow, conversational or fast, from the measured speaking rate; None when it was not measured."""
    if syllable_rate is None:
        return None
    return "slow" if syllable_rate < SLOW_SYLLABLES_PER_S else "fast" if syllable_rate > FAST_SYLLABLES_PER_S else "conversational"


def measure(audio: np.ndarray, speaking_s: float | None = None) -> dict | None:
    """Pitch, loudness and, when the seconds of actual speaking are given, the speaking rate."""
    sound = to_sound(audio)
    f0 = sound.to_pitch().selected_array["frequency"]
    voiced = f0[f0 > 0]
    if voiced.size == 0:
        return None

    # Pitch variation in semitones is speaker-independent; low values = monotone delivery
    semitones = 12 * np.log2(voiced / np.median(voiced))
    intensity = sound.to_intensity().values[0]
    # Loudness while sounding only: digital silence reads as about -300 dB and swamps the mean and the spread
    intensity = intensity[intensity > intensity.max() - SILENCE_BELOW_PEAK_DB]

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
        # Syllables per second of speaking, pauses left out
        "syllable_rate": round(count_syllables(sound) / speaking_s, 2) if speaking_s and speaking_s >= 1 else None,
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


class GenerationTiming(BaseStreamer):
    """Log progress without decoding or recording the speaker's content."""

    def __init__(self):
        self.started = time.monotonic()
        self.prompt_received = False
        self.tokens = 0
        self.first_token_at = None

    def put(self, value):
        # generate() first sends the complete prompt, then generated tokens.
        if not self.prompt_received:
            self.prompt_received = True
            return
        self.tokens += value.numel()
        if self.first_token_at is None:
            self.first_token_at = time.monotonic()
            logger.info("Gemma first output token after %.1fs", self.first_token_at - self.started)
        if self.tokens % 32 == 0:
            logger.info("Gemma generated %s tokens in %.1fs", self.tokens, time.monotonic() - self.started)

    def end(self):
        logger.info("Gemma generated %s tokens total in %.1fs", self.tokens, time.monotonic() - self.started)


def generate(messages: list[dict], **processor_kwargs) -> str:
    processor, model = models["processor"], models["gemma"]
    inputs = processor.apply_chat_template(
        messages, tokenize=True, return_dict=True, return_tensors="pt", add_generation_prompt=True,
        processor_kwargs=processor_kwargs,
    ).to(model.device, dtype=model.dtype)
    with torch.inference_mode():
        output = model.generate(**inputs, generation_config=models["generation_config"], streamer=GenerationTiming())
    # Decode only the reply, not the prompt
    return processor.decode(output[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True)


def ask_gemma(content: list[dict], **processor_kwargs) -> tuple[dict | None, str]:
    """Send one user turn and parse a JSON object from the reply, retrying once if it does not parse.

    processor_kwargs go to the Gemma processor, e.g. images_kwargs for the visual token budget.
    """
    raw = ""
    for attempt in range(2):
        if attempt:
            content = [*content, {"type": "text", "text": "Your previous reply was not valid JSON. Return only the JSON object."}]
        started = time.monotonic()
        logger.info("Gemma generation started (attempt %s)", attempt + 1)
        raw = generate([{"role": "user", "content": content}], **processor_kwargs)
        logger.info("Gemma generation finished in %.1fs", time.monotonic() - started)
        if (parsed := parse_json(raw)) is not None:
            return parsed, raw
    return None, raw


def describe_measurements(measurements: dict | None, pause_ratio: float | None = None) -> str:
    if measurements is None:
        return "Signal measurements: no voiced speech detected."
    lines = [
        "Signal measurements for this audio (from Praat):",
        f"- Pitch variation: {measurements['pitch_std_semitones']} semitones std around the speaker's own median "
        "(rule of thumb, not a validated threshold: under 2 tends to sound even, over 4 varied)",
        f"- Pitch range (5th-95th percentile): {measurements['pitch_range_semitones']} semitones",
        f"- Loudness variation while speaking: {measurements['intensity_std_db']} dB std",
        f"- Voiced share of frames: {measurements['voiced_ratio']}",
    ]
    if measurements.get("syllable_rate") is not None:
        lines.append(
            f"- Speaking rate: {measurements['syllable_rate']} syllables per second of speaking, "
            f"which counts as {pace_of(measurements['syllable_rate'])} (under {SLOW_SYLLABLES_PER_S} is slow, over {FAST_SYLLABLES_PER_S} fast)"
        )
    if pause_ratio is not None:
        lines.append(f"- Share of time in pauses of {PAUSE_THRESHOLD_S}s or longer: {pause_ratio}")
    return "\n".join(lines)


# Sounds that fill a pause: um, uh, er, hmm and their spellings. Only these are kept from Gemma's list of
# filler words. It also listed words such as "like" and "so" where they were part of the sentence, and
# telling it not to did not stop it, so words are not counted.
FILLED_PAUSE = re.compile(r"^(u+h+m*|u+m+|u{2,}|e+r+m*|e+h+|e{2,}|a+h+|a{2,}|h+m+|m{2,}|m+h+m+|ə+)$")

# Describing the voice is not the same as inferring how the speaker feels; the product does the first only
NO_STATE = (
    "Describe what can be heard. Do not name the speaker's emotions or state of mind "
    "(for example nervous, confident, passionate), and do not comment on accent or pronunciation."
)

SEGMENT_PROMPT = """You are a presentation coach listening to one segment of a startup pitch, from {start} to {end} in the recording.
Describe how it is delivered: how the voice sounds, hesitation and filler words. Do not judge the business idea.
{no_state}
Base your answer on what you hear in the audio. Use the measurements below as supporting evidence.

{measurements}

Reply with only a JSON object in this shape:
{{"tone": "how the voice sounds: pitch movement, loudness, steadiness",
 "filler_words": ["every sound that fills a pause, in the order you hear it, repeated each time it is made, e.g. um, uh, um, er"],
 "topics": ["the name of each topic this segment explains, from: {topics}"],
 "key_points": ["every statement the speaker makes in this segment, each as one short sentence, in order, keeping numbers and names as spoken; at most 12"],
 "observations": "one or two sentences on what works and what does not in this delivery"}}"""


def observe_segment(clip: np.ndarray, start: float, end: float, measurements: dict | None, pause_ratio: float) -> dict:
    prompt = SEGMENT_PROMPT.format(
        start=format_time(start),
        end=format_time(end),
        no_state=NO_STATE,
        measurements=describe_measurements(measurements, pause_ratio),
        topics=rubric.TOPIC_GUIDE,
    )
    # Audio after the text, as recommended for Gemma 4
    observations, raw = ask_gemma([{"type": "text", "text": prompt}, {"type": "audio", "audio": clip}])
    if observations is not None:
        fillers = observations.get("filler_words")
        observations["filler_words"] = [
            f for f in (fillers if isinstance(fillers, list) else [])
            if isinstance(f, str) and FILLED_PAUSE.match(f.strip(" .,!?-").lower())
        ]
    return {"observations": observations, **({} if observations else {"raw": raw})}


SCORE_PROMPT = """You are a presentation coach reviewing the delivery of a startup pitch against a fixed rubric. Review how it was delivered, never the business idea or its market potential.
{no_state}

Whole recording: {duration}.
{measurements}
Pauses: {pauses}

What you heard in each segment:
{segments}

Already rated from the measurements and from counts of what you heard:
{findings}

Give this criterion the level, from 4 down to 0, whose description fits best:
{rubric}

Reply with only a JSON object in this shape:
{{"criteria": [{{"name": "Structure and flow", "reason": "one sentence naming the moment it rests on", "level": 0}}],
 "insights": ["what the analysis found, 3 to 5 short statements"],
 "feedback": [{{"at_s": 0, "text": "one concrete thing to change"}}]}}
Give 3 to 5 feedback items. Start with the criteria rated below 4 above, naming the number that was measured; then add what you found yourself. Set at_s to the second in the recording the feedback refers to, or null if it applies to the whole pitch.
A voice whose pitch moves and whose loudness stays easy to hear helps a listener: never advise a flatter or more even pitch."""


def count_fillers(segments: list[dict], duration: float) -> dict:
    count = 0
    for s in segments:
        fillers = (s["observations"] or {}).get("filler_words")
        count += len(fillers) if isinstance(fillers, list) else 0
    return {"count": count, "per_minute": round(count / (duration / 60), 1)}


def rate_fillers(fillers: dict) -> dict:
    """The filler word criterion; limits as in RUBRIC."""
    per_minute = fillers["per_minute"]
    level = 4 if per_minute <= 5 else 3 if per_minute <= 7 else 2 if per_minute <= 10 else 1 if per_minute < 12 else 0
    reason = f"{fillers['count']} heard by Gemma, {per_minute} per minute ({RUBRIC[FILLER_CRITERION][4 - level]})."
    return {"name": FILLER_CRITERION, "reason": reason, "level": level}


def rate_time(spoken_s: float, limit_s: float) -> dict:
    """The time criterion, from the first sound to the last; limits as in RUBRIC. Finishing early is not marked down."""
    # Whole seconds: half a second of trailing breath is not an overrun
    over = round(spoken_s) / limit_s - 1
    level = 4 if over <= 0 else 3 if over <= 0.05 else 2 if over <= 0.1 else 1 if over <= 0.2 else 0
    reason = (
        f"{format_time(round(spoken_s))} from the first sound to the last, against a limit of "
        f"{format_time(limit_s)} ({RUBRIC[TIME_CRITERION][4 - level]})."
    )
    return {"name": TIME_CRITERION, "reason": reason, "level": level}


def span(s: dict) -> str:
    return f"{format_time(s['start_s'])} to {format_time(s['end_s'])}"


def spread(values: list[float]) -> str:
    """One number, or the lowest and the highest when the segments differ."""
    return f"{min(values)}" if min(values) == max(values) else f"{min(values)} to {max(values)}"


def rate_time_share(name: str, flagged: list[dict], measured: list[dict], finding: str, clear: str) -> dict:
    """A criterion rated by the share of the measured time whose segments have a problem; limits as in rubric.time_share_levels()."""
    share = sum(s["end_s"] - s["start_s"] for s in flagged) / sum(s["end_s"] - s["start_s"] for s in measured)
    reason = f"{finding} from {', '.join(span(s) for s in flagged)}." if flagged else clear
    return {"name": name, "reason": reason, "level": rubric.level_for_time_share(share)}


def rate_signal(prosody: dict | None, pauses: dict, segments: list[dict]) -> dict[str, dict]:
    """The criteria that follow from the signal alone: pace, pauses, pitch variation and loudness."""
    rated = {}
    paced = [s for s in segments if s["pace"]]
    if paced:
        rated[PACE_CRITERION] = rate_time_share(
            PACE_CRITERION,
            [s for s in paced if s["pace"] != "conversational"],
            paced,
            f"Speaking rate outside {SLOW_SYLLABLES_PER_S} to {FAST_SYLLABLES_PER_S} syllables a second",
            f"Speaking rate of {spread([s['measurements']['syllable_rate'] for s in paced])} syllables a second, a conversational pace.",
        )

    minutes = max(pauses["spoken_s"], 1.0) / 60
    long_per_minute = pauses["long_pause_count"] / minutes
    level = 4 if long_per_minute == 0 else 3 if long_per_minute <= 1 else 2 if long_per_minute <= 2 else 1 if long_per_minute <= 4 else 0
    rated["Pauses"] = {
        "name": "Pauses",
        "reason": f"{pauses['long_pause_count']} of {pauses['pause_count']} pauses are longer than {LONG_PAUSE_S:g} seconds; the longest is {pauses['longest_pause_s']} s.",
        "level": level,
    }

    measured = [s for s in segments if s["measurements"]]
    if measured and prosody:
        rated["Pitch variation"] = rate_time_share(
            "Pitch variation",
            [s for s in measured if s["measurements"]["pitch_std_semitones"] < EVEN_PITCH_SEMITONES],
            measured,
            f"Pitch varies by under {EVEN_PITCH_SEMITONES:g} semitones",
            f"Pitch varies by {spread([s['measurements']['pitch_std_semitones'] for s in measured])} semitones around the speaker's own median.",
        )
        rated["Loudness"] = rate_time_share(
            "Loudness",
            [
                s for s in measured
                if s["measurements"]["intensity_mean_db"] < prosody["intensity_mean_db"] - QUIET_BELOW_MEAN_DB
                or s["measurements"]["intensity_std_db"] > UNEVEN_LOUDNESS_DB
            ],
            measured,
            f"More than {QUIET_BELOW_MEAN_DB:g} dB quieter than the recording as a whole, or loudness swinging by over {UNEVEN_LOUDNESS_DB:g} dB,",
            f"No part is more than {QUIET_BELOW_MEAN_DB:g} dB quieter than the rest, and loudness varies by {prosody['intensity_std_db']} dB while speaking.",
        )
    return rated


def score_pitch(
    duration: float, prosody: dict | None, pauses: dict, fillers: dict, segments: list[dict], time_limit_s: float | None
) -> dict:
    """Rate the pitch: the signal and the counts in code, structure by Gemma, and one 0-100 score over both."""
    covered, missing = rubric.split_topics([(s["observations"] or {}).get("topics") for s in segments])
    rated = rate_signal(prosody, pauses, segments)
    # Without a single parsed segment there is no filler count to rate and no topic was heard or missed
    if any(s["observations"] for s in segments):
        rated[FILLER_CRITERION] = rate_fillers(fillers)
        rated[rubric.TOPIC_CRITERION] = rubric.rate_topics(missing)
    else:
        missing = []
    if time_limit_s:
        rated[TIME_CRITERION] = rate_time(pauses["spoken_s"], time_limit_s)

    described = []
    for s in segments:
        observations = json.dumps(s["observations"]) if s["observations"] else "(no observations)"
        described.append(f"- {span(s)} (starts at {s['start_s']}s): {observations}")
    prompt = SCORE_PROMPT.format(
        no_state=NO_STATE,
        duration=format_time(duration),
        measurements=describe_measurements(prosody),
        pauses=json.dumps(pauses),
        segments="\n".join(described),
        findings="\n".join(f"- {c['name']}: level {c['level']} of 4. {c['reason']}" for c in rated.values()),
        rubric=rubric.describe(RUBRIC, GEMMA_CRITERIA),
    )
    reply, _ = ask_gemma([{"type": "text", "text": prompt}])
    reply = reply or {}
    rated.update(rubric.gemma_levels(reply.get("criteria"), GEMMA_CRITERIA))
    # The score is arithmetic over the levels, so the same levels always give the same score
    criteria, score = rubric.total(RUBRIC, rated)
    feedback = [
        {"at_s": f.get("at_s") if type(f.get("at_s")) in (int, float) else None, "text": f["text"].strip()}
        for f in (reply.get("feedback") if isinstance(reply.get("feedback"), list) else [])
        if isinstance(f, dict) and isinstance(f.get("text"), str) and f["text"].strip()
    ]
    return {
        "pitch_score": score,
        "criteria": criteria,
        "missing_topics": missing,
        "insights": rubric.strings(reply.get("insights"), 5),
        "feedback": feedback[:5],
    }


def format_time(seconds: float) -> str:
    return f"{int(seconds // 60)}:{int(seconds % 60):02d}"


def run_analysis(audio: np.ndarray, report: Callable[[str, float], None], time_limit_s: float | None = None) -> dict:
    """Run every step, reporting (stage, overall 0-1 progress) along the way.

    time_limit_s is the event's limit for the pitch; with it the recording's length is rated too.
    """
    # Weights reflect where the time goes: one Gemma call per segment dominates
    duration = audio.size / SAMPLE_RATE
    report("measuring", 0.0)
    silences = find_silences(audio)
    pauses = analyze_pauses(silences, duration)
    prosody = measure(audio, duration - silent_time(silences, 0.0, duration))
    bounds = segment(duration, silences)

    report("listening", 0.05)
    segments = []
    for n, (start, end) in enumerate(bounds, start=1):
        logger.info("Listening to segment %s/%s (%s-%s)", n, len(bounds), format_time(start), format_time(end))
        clip = audio[int(start * SAMPLE_RATE) : int(end * SAMPLE_RATE)]
        measurements = measure(clip, end - start - silent_time(silences, start, end))
        pause_ratio = round(sum(inner_pauses(silences, start, end)) / (end - start), 2)
        segments.append({
            "start_s": round(start, 2),
            "end_s": round(end, 2),
            "measurements": measurements,
            "pause_ratio": pause_ratio,
            # Measured, not heard: slow, conversational or fast
            "pace": pace_of((measurements or {}).get("syllable_rate")),
            **observe_segment(clip, start, end, measurements, pause_ratio),
        })
        report("listening", 0.05 + 0.85 * n / len(bounds))

    report("scoring", 0.9)
    fillers = count_fillers(segments, duration)
    summary = score_pitch(duration, prosody, pauses, fillers, segments, time_limit_s) if segments else None
    return {
        "duration_s": round(duration, 2),
        "time_limit_s": time_limit_s,
        "model": GEMMA_MODEL,
        "prosody": prosody,
        "pauses": pauses,
        "filler_words": fillers,
        "segments": segments,
        "summary": summary,
    }


class Fingerprint:
    """Salted SHA-256 of an uploaded file, for a verdict that names the file without revealing it.

    The salt is random per upload, so the hash says nothing about the file until the team shows the
    salt, and the same file hashes differently in every analysis.
    """

    def __init__(self):
        self.salt = os.urandom(32)
        self.digest = hashlib.sha256(self.salt)
        self.size = 0

    def update(self, chunk: bytes):
        self.digest.update(chunk)
        self.size += len(chunk)

    def result(self) -> dict:
        return {"sha256": self.digest.hexdigest(), "salt": self.salt.hex(), "bytes": self.size}


def load_upload(file: UploadFile | None) -> tuple[np.ndarray, dict]:
    """The decoded audio of an uploaded recording, and the fingerprint of the file."""
    if file is None:
        raise HTTPException(400, "No file uploaded")

    # Copy in chunks: uploads can be large videos
    fingerprint = Fingerprint()
    with tempfile.NamedTemporaryFile(suffix=os.path.splitext(file.filename or "")[1]) as tmp:
        while chunk := file.file.read(2**20):
            fingerprint.update(chunk)
            tmp.write(chunk)
        tmp.flush()
        audio = decode(tmp.name)

    if audio.size < SAMPLE_RATE:
        raise HTTPException(400, "Audio is shorter than 1 second")
    return audio, fingerprint.result()


def code_hash() -> str:
    """SHA-256 over this package's source: it changes whenever a prompt, a rubric or a limit changes."""
    digest = hashlib.sha256()
    for path in sorted(pathlib.Path(__file__).parent.glob("*.py")):
        # Line endings differ between a Windows checkout and the image built from it
        digest.update(path.name.encode() + path.read_bytes().replace(b"\r\n", b"\n"))
    return digest.hexdigest()


CODE_SHA256 = code_hash()


def describe_setup() -> dict:
    """What produces an analysis. A verdict carries it so that a re-run can be told apart from a different setup."""
    model = models.get("gemma")
    return {
        "model": GEMMA_MODEL,
        "dtype": str(model.dtype).removeprefix("torch.") if model is not None else None,
        "slide_tokens": deck.SLIDE_TOKENS,
        "topics": list(rubric.PITCH_TOPICS),
        "code_sha256": CODE_SHA256,
    }


@app.get("/health")
def health():
    model = models.get("gemma")
    placement = getattr(model, "hf_device_map", {"": str(model.device)} if model is not None else {})
    return {"status": "ok", "analysis_running": analysis_lock.locked(),
            "model_devices": sorted({str(device) for device in placement.values()}),
            "setup": describe_setup()}


def reserve_analysis():
    if not analysis_lock.acquire(blocking=False):
        raise HTTPException(429, "An analysis is already running. Wait for it to finish before starting another.")


def positive(seconds: float | None) -> float | None:
    """The event's time limit, or None when the field was left out or makes no sense."""
    return seconds if seconds and seconds > 0 else None


def run_pitch_analysis(
    recording: tuple[np.ndarray, dict], report: Callable[[str, float], None], time_limit_s: float | None
) -> dict:
    audio, fingerprint = recording
    return {**run_analysis(audio, report, time_limit_s), "file": fingerprint, "setup": describe_setup()}


@app.post("/analyze")
def analyze(file: UploadFile | None = File(None), time_limit_s: float | None = Form(None)):
    reserve_analysis()
    try:
        return run_pitch_analysis(load_upload(file), lambda *_: None, positive(time_limit_s))
    finally:
        analysis_lock.release()


def load_deck(file: UploadFile | None) -> tuple[int, list[dict], dict]:
    """Page count and the rendered, measured pages of an uploaded PDF deck, and the fingerprint of the file."""
    if file is None:
        raise HTTPException(400, "No deck uploaded")
    data = file.file.read(MAX_DECK_BYTES + 1)
    if len(data) > MAX_DECK_BYTES:
        raise HTTPException(413, f"The deck is larger than {MAX_DECK_BYTES // 2**20} MB")
    if b"%PDF" not in data[:1024]:
        raise HTTPException(400, "The deck must be a PDF file")
    fingerprint = Fingerprint()
    fingerprint.update(data)
    try:
        return *deck.read_pdf(data), fingerprint.result()
    except deck.UnreadablePdf as error:
        raise HTTPException(400, str(error)) from error


def run_deck_analysis(slides: tuple[int, list[dict], dict], report: Callable[[str, float], None]) -> dict:
    page_count, pages, fingerprint = slides
    return {
        "model": GEMMA_MODEL,
        **deck.run_analysis(page_count, pages, ask_gemma, report),
        "file": fingerprint,
        "setup": describe_setup(),
    }


def run_check(
    recording: tuple[np.ndarray, dict],
    slides: tuple[int, list[dict], dict],
    report: Callable[[str, float], None],
    time_limit_s: float | None,
) -> dict:
    """The pitch, then the deck, then whether the pitch follows the deck."""
    pitch = run_pitch_analysis(recording, lambda stage, p: report(stage, 0.45 * p), time_limit_s)
    reviewed = run_deck_analysis(slides, lambda stage, p: report(stage, 0.45 + 0.45 * p))
    report("aligning", 0.9)
    logger.info("Comparing the speech with the deck")
    return {"pitch": pitch, "deck": reviewed, "alignment": alignment.run(ask_gemma, reviewed["slides"], pitch["segments"])}


def reserved(load: Callable[[], T]) -> T:
    """Take the analysis lock and load the upload, giving the lock back if loading fails."""
    reserve_analysis()
    try:
        return load()
    except BaseException:
        analysis_lock.release()
        raise


def stream(job: Callable[[Callable[[str, float], None]], dict]) -> StreamingResponse:
    """Run job in a thread and stream NDJSON progress events before its result. Gives the analysis lock back when done."""
    events = queue.Queue()

    def work():
        try:
            result = job(lambda stage, p: events.put({"type": "progress", "stage": stage, "progress": round(p, 3)}))
            events.put({"type": "result", "data": result})
        except Exception:
            events.put({"type": "error", "message": "Analysis failed"})
            raise
        finally:
            analysis_lock.release()
            events.put(None)

    def lines():
        threading.Thread(target=work, daemon=True).start()
        while (event := events.get()) is not None:
            yield json.dumps(event) + "\n"

    return StreamingResponse(lines(), media_type="application/x-ndjson")


@app.post("/analyze/stream")
def analyze_stream(file: UploadFile | None = File(None), time_limit_s: float | None = Form(None)):
    """Same as /analyze, but streams NDJSON progress events before the result."""
    recording = reserved(lambda: load_upload(file))
    return stream(lambda report: run_pitch_analysis(recording, report, positive(time_limit_s)))


@app.post("/deck/stream")
def deck_stream(file: UploadFile | None = File(None)):
    """Analyze a PDF deck, streaming NDJSON progress events before the result."""
    slides = reserved(lambda: load_deck(file))
    return stream(lambda report: run_deck_analysis(slides, report))


@app.post("/check/stream")
def check_stream(
    recording: UploadFile | None = File(None),
    slides: UploadFile | None = File(None, alias="deck"),
    time_limit_s: float | None = Form(None),
):
    """Analyze a recording and its deck together and compare them; fields are `recording` and `deck`."""
    loaded = reserved(lambda: (load_upload(recording), load_deck(slides)))
    return stream(lambda report: run_check(*loaded, report, positive(time_limit_s)))
