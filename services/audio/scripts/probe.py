"""Run the per-segment Gemma prompt on one clip of at most 30 seconds and print the result.

For checking whether Gemma hears delivery (TODO section 1). From services/audio:
    python -m scripts.probe recording.wav
    python -m scripts.probe recording.wav --audio-only

With --audio-only the prompt carries no signal measurements, so the answer shows what Gemma hears
rather than what it reads. Run that first: a description that only tracks the delivery when the
measurements are in the prompt comes from the measurements.
"""

import json
import sys
import time

from app import main

audio_only = "--audio-only" in sys.argv[1:]
paths = [a for a in sys.argv[1:] if a != "--audio-only"]
if len(paths) != 1:
    sys.exit("usage: python -m scripts.probe <audio-or-video-file> [--audio-only]")

audio = main.decode(paths[0])
duration = audio.size / main.SAMPLE_RATE
if duration > main.MAX_SEGMENT_S:
    sys.exit(f"clip is {duration:.1f}s; Gemma accepts at most {main.MAX_SEGMENT_S:.0f}s")

started = time.perf_counter()
main.load_models()
loaded = time.perf_counter()

silences = main.find_silences(audio)
measurements = main.measure(audio)
pause_ratio = round(sum(main.inner_pauses(silences, 0.0, duration)) / duration, 2)
if audio_only:
    prompt = main.SEGMENT_PROMPT.format(
        start=main.format_time(0.0),
        end=main.format_time(duration),
        no_state=main.NO_STATE,
        measurements="No measurements are provided for this clip. Rely on the audio alone.",
        topics=main.rubric.TOPIC_GUIDE,
    )
    observations, raw = main.ask_gemma([{"type": "text", "text": prompt}, {"type": "audio", "audio": audio}])
    result = {"observations": observations, **({} if observations else {"raw": raw})}
else:
    result = main.observe_segment(audio, 0.0, duration, measurements, pause_ratio)
done = time.perf_counter()

print(json.dumps({"audio_only": audio_only, "measurements": measurements, "pause_ratio": pause_ratio, **result}, indent=2))
print(f"model load {loaded - started:.1f}s, analysis of {duration:.1f}s clip {done - loaded:.1f}s", file=sys.stderr)
