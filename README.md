# PitchCheck

PitchCheck gives hackathon and startup teams feedback on a pitch before a human reviewer sees it. A team uploads the recording of their pitch and the slide deck. Gemma analyzes both and returns a score for the slides, a score for the pitch, and concrete feedback on what to improve.

Built for the GDG Belgrade DevFest hackathon, whose theme is "Reimagine the Event Experience with Gemma".

> **Status on 10 October 2026: work in progress.** The app accepts an audio or video recording. Gemma 4 E2B listens to it in segments of up to 30 seconds and returns a pitch score, insights and feedback. Slides are not accepted yet, and whether Gemma reliably hears tone and emotion has not been tested on real recordings. See [What is implemented](#what-is-implemented) and [TODO.md](TODO.md).

The `frontend` branch adds a reference-inspired landing page and two upload cards. The recording card keeps the existing analysis flow. The deck card accepts PDFs up to 25 MB for browser-local selection and preview; PDFs are not submitted to Gemma yet, and slide scoring remains unimplemented. A centered "Check pitch + deck" button below the cards introduces the planned combined check: separate delivery and deck scores plus speech-to-slide alignment. It is marked coming soon and expands an explanation; it does not submit files for combined analysis. Design notes and component specifications are in `docs/research/`.

## Requirements

These four are fixed.

1. **Input is a pitch video and the slide deck.**
2. **Gemma does the analysis.** Every score and every piece of feedback comes from a Gemma model.
3. **The pitch is judged from its sound, not from a transcript.** Tone, emotion, energy and pacing live in the audio signal, and a transcript drops them. The audio itself goes into the model.
4. **Output is two scores plus guidance:** a score for the slides, a score for the pitch, insights (what the analysis found) and feedback (what to change).

The scores describe the deck and the delivery. They do not rate the business idea or its investment potential.

## What is implemented

Read from the code after the Gemma audio change (the commit following `a0a917e`).

| Capability | State |
| --- | --- |
| Upload an audio or video recording; for video the audio track is extracted with ffmpeg | Implemented |
| Live progress while the analysis runs | Implemented |
| Pitch and loudness variation, measured from the signal with Praat | Implemented; sent to Gemma as supporting evidence |
| Pauses, measured from the signal with Praat | Implemented |
| Splitting the audio into segments of at most 30 seconds, cut at pauses | Implemented |
| Gemma 4 E2B listens to each segment: tone, emotion, energy, pace, filler words, topics | Implemented; not yet validated on real recordings (TODO section 1) |
| Score for the pitch with per-criterion sub-scores, insights and timestamped feedback | Implemented; rubric is provisional |
| Slide deck upload and analysis | Not started |
| Score for the slides | Not started |
| Check that the spoken pitch matches the deck | Not started |

Whisper and the wav2vec2 emotion classifier have been removed. Every score and every piece of feedback now comes from Gemma; Praat supplies measurements only.

## Planned pipeline

Steps 2 to 4 and the pitch half of step 7 are built. The rest is the working plan, shaped by the Gemma limits in the next section.

1. The team uploads the pitch video and the deck.
2. ffmpeg extracts the audio track as 16 kHz mono. This step exists today.
3. The audio is split into segments of at most 30 seconds, because that is the longest clip Gemma accepts.
4. For each segment, Gemma receives the audio together with signal measurements for that segment (pitch variation, loudness variation, pauses). It returns structured observations about delivery (tone, emotion, energy, pace, filler words) and the topics covered.
5. Deck pages are rendered to images. Gemma reads them for structure, clarity, legibility, and topics covered or missing against the rubric.
6. Gemma compares what was said with what is on the slides: deck topics the speaker never explained, and statements that contradict the slides. Summarizing a slide or adding explanation is not an error.
7. Gemma turns the observations into the slide score, the pitch score, insights and feedback.

## What the Gemma documentation confirms

Checked on 10 October 2026.

| Fact | Consequence for PitchCheck |
| --- | --- |
| Audio input exists in Gemma 3n and in Gemma 4 E2B, E4B and 12B Unified. Gemma 4 26B A4B and 31B do not take audio. | The model must be one of the audio-capable variants. Gemma 4 E2B is the default (`GEMMA_MODEL`). |
| One audio clip is at most 30 seconds, 16 kHz, single channel, 25 tokens per second in Gemma 4. | A pitch of several minutes has to be segmented and the results combined. |
| Documented audio tasks are speech recognition and speech translation. Emotion, tone and prosody are not mentioned as a capability or as a limitation. | Requirement 3 depends on behavior the documentation does not promise. It has to be tested on real recordings first. |
| Video is processed as image frames, up to 60 seconds at one frame per second. | Video frames are not part of the plan; the recording is used for its sound. |
| Image input covers document and PDF parsing, OCR and chart comprehension, with a visual token budget of 70 to 1120 per image. | Slides can be sent as page images. |
| Gemma 4 is released under Apache 2.0. | No license obstacle to local use. |

Sources: [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4) (updated 30 July 2026), [Gemma audio understanding](https://ai.google.dev/gemma/docs/capabilities/audio) (updated 10 October 2026), [Welcome Gemma 4](https://huggingface.co/blog/gemma4) on Hugging Face.

The only official code example for audio uses Hugging Face Transformers (`AutoProcessor` with `AutoModelForMultimodalLM`). Third-party guides report that recent Ollama versions accept audio for Gemma 4 and that llama.cpp does not; neither claim was checked against an official source.

## Running it

With Docker:

```bash
docker compose up --build
```

The web app is on http://localhost:3000 and the audio service on http://localhost:8000. The first start downloads the Gemma weights (several GB), which can take a while. If Hugging Face asks for the Gemma license to be accepted, export `HF_TOKEN` before starting.

From prebuilt images, on a machine that should not build them: every push to `main` publishes both images to GitHub Container Registry (`.github/workflows/images.yml`) for `linux/amd64` and `linux/arm64`, so they run natively on x86 machines and on Apple Silicon. The images are public, so no login is needed. Copy `docker-compose.yml` over, and pull:

```bash
docker compose pull
docker compose up -d
```

Images are tagged `latest` and `sha-<short commit>`; set `TAG=sha-abc1234` to run a specific build. Try Gemma on one clip with `docker compose exec audio python -m scripts.probe <file>` after copying the file into the container (`docker compose cp clip.wav audio:/tmp/clip.wav`).

If the app does not start, check `docker compose ps -a` and
`docker compose logs --tail=100 audio`. The web container waits for the audio
service to become healthy. Older audio images can fail with
`AnyToAnyPipeline requires the librosa library`; the dependency is now included
in `services/audio/requirements.txt`. To repair a pulled image from this checkout:

```bash
docker compose build audio
docker compose up -d --no-build --pull never
```

This keeps the downloaded model weights in the `models` volume. Pulling again
replaces the local image, so use the repaired image until an updated image is
published to the registry. Startup readiness confirms that Gemma loaded; it does
not verify the quality or speed of pitch analysis.

If analysis stays at **5% / Gemma is listening**, that percentage does not move
until the first audio segment finishes. Check `docker compose logs -f audio`:
the service logs the segment and the time for each Gemma call. `/health` also
reports `analysis_running` and `model_devices`. Only one analysis runs at a time;
another request receives HTTP 429 instead of competing for model memory.
Generation logs report the time to the first output token, progress every 32
output tokens, and the final token count. A long wait for the first token points
to input processing; slow progress afterward points to text generation. These
diagnostics log counts and timings, not the model's text or the recording.

On a machine with enough available RAM, set `GEMMA_DEVICE_MAP=cpu` in `.env`
and recreate the audio container with `docker compose up -d --no-build --pull never`.
This keeps the full model in RAM instead of automatically offloading layers to
disk. E2B has roughly 10.2 GB of weights and needs additional memory for inference;
do not use this setting on a Docker VM with too little RAM. The default remains
`auto` for other machines. Docker on this Mac runs CPU-only inference.

A local diagnostic on an Apple M5 with 16 GB RAM and a Docker VM with 11.67 GiB
used one second of silence and at most eight output tokens: automatic CPU/disk
placement took 22.4 s; full CPU placement took 7.5 s. This is a short inference
benchmark, not a delivery-quality test or an end-to-end pitch timing. Start with
one short spoken clip and wait for it to finish before submitting another.

On 11 October, a roughly 24-second spoken recording reached the scoring stage:
the first Gemma audio call completed in 480 s and its JSON parsed on the first
attempt. The browser advanced from 5% to 90%. This run overlapped an audio-image
rebuild, so the timing includes competing build work. It confirms that waiting
at 5% can be slow inference rather than a failed request; it does not establish
delivery accuracy or a clean performance baseline.

Without Docker, in two terminals:

```bash
pnpm install
pnpm dev
```

```bash
cd services/audio
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

The audio service needs Python 3.12 and ffmpeg on the PATH. The web app reaches it through `AUDIO_SERVICE_URL`, which defaults to `http://localhost:8000`.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/app/page.tsx`, `src/components/audio-analyzer.tsx` | Upload page and results view |
| `src/app/api/analyze/route.ts` | Streams the upload to the audio service and relays its progress events |
| `src/lib/analysis.ts` | Types for the analysis result and progress events |
| `services/audio/app/main.py` | FastAPI service: decodes the file, measures it, splits it, and runs Gemma per segment and for the score |
| `services/audio/scripts/probe.py` | Runs the per-segment Gemma prompt on one clip of 30 s or less, for testing what Gemma hears |
| `docker-compose.yml` | The `web` and `audio` services |

## Privacy

Local processing is part of what PitchCheck is for: a startup should not have to send its idea to someone else's server to get feedback. Today both services run in local Docker containers, and model weights are downloaded from Hugging Face on first start.

Whether the finished product runs on the participant's machine or on a server the organizer controls is not decided, and it depends on how heavy the chosen Gemma variant turns out to be.
