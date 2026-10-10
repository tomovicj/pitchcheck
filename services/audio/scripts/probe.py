"""Run the per-segment Gemma prompt on one clip of at most 30 seconds and print the result.

For checking whether Gemma hears delivery (TODO section 1). From services/audio:
    python -m scripts.probe recording.wav
"""

import json
import sys
import time

from app import main

if len(sys.argv) != 2:
    sys.exit("usage: python -m scripts.probe <audio-or-video-file>")

audio = main.decode(sys.argv[1])
duration = audio.size / main.SAMPLE_RATE
if duration > main.MAX_SEGMENT_S:
    sys.exit(f"clip is {duration:.1f}s; Gemma accepts at most {main.MAX_SEGMENT_S:.0f}s")

started = time.perf_counter()
main.load_models()
loaded = time.perf_counter()

silences = main.find_silences(audio)
measurements = main.measure(audio)
pause_ratio = round(sum(main.inner_pauses(silences, 0.0, duration)) / duration, 2)
result = main.observe_segment(audio, 0.0, duration, measurements, pause_ratio)
done = time.perf_counter()

print(json.dumps({"measurements": measurements, "pause_ratio": pause_ratio, **result}, indent=2))
print(f"model load {loaded - started:.1f}s, analysis of {duration:.1f}s clip {done - loaded:.1f}s", file=sys.stderr)
