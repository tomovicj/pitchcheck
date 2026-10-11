# PitchCheck

PitchCheck gives hackathon and startup teams feedback on a pitch before a human reviewer sees it. A team uploads the recording of their pitch and the slide deck. Gemma analyzes both and returns a score for the slides, a score for the pitch, and concrete feedback on what to improve.

Built for the GDG Belgrade DevFest hackathon, whose theme is "Reimagine the Event Experience with Gemma".

> **Status on 11 October 2026.** The app takes a recording of the pitch and the deck as a PDF. Gemma 4 E2B listens to the recording in segments of up to 20 seconds and reads every slide. It returns a pitch score, a slide score, insights and feedback, and a report on whether the talk follows the deck. All of it has run end to end with the real model, but only on synthetic material: a text-to-speech voice and a deck made for the test. Whether Gemma reliably hears tone of voice has not been tested on real recordings, and the rubrics have not been tried on real pitches. See [What is implemented](#what-is-implemented) and [TODO.md](TODO.md).

The page has one workspace with two upload cards. Each card runs its own check, and the "Check pitch + deck" button below them runs both and compares them. Selected recordings appear as compact file cards without a video preview. Results show up to five main metrics, including the pitch and slide scores; "SHOW MORE" opens the full reports and verdict downloads in a modal. The event time-limit field hides once the pitch result is available. Design notes and component specifications for the landing page are in `docs/research/`.

## Requirements

These four are fixed.

1. **Input is a pitch video and the slide deck.**
2. **Gemma does the analysis.** Every score and every piece of feedback comes from a Gemma model.
3. **The pitch is judged from its sound, not from a transcript.** Tone, emotion, energy and pacing live in the audio signal, and a transcript drops them. The audio itself goes into the model. The feedback describes how the delivery sounds (pace, pauses, filler words, pitch, loudness); it does not label the speaker's emotions or state of mind.
4. **Output is two scores plus guidance:** a score for the slides, a score for the pitch, insights (what the analysis found) and feedback (what to change).

The scores describe the deck and the delivery. They do not rate the business idea or its investment potential.

## What is implemented

Read from the code on the `feature/pitch-rubric` branch. "Implemented" means it runs end to end with the real model; none of it has been validated on real pitches.

| Capability | State |
| --- | --- |
| Upload an audio or video recording; for video the audio track is extracted with ffmpeg | Implemented |
| Live progress while the analysis runs | Implemented |
| Pitch and loudness variation, measured from the signal with Praat | Implemented; sent to Gemma as supporting evidence |
| Pauses, measured from the signal with Praat | Implemented |
| Splitting the audio into segments of at most 20 seconds, cut at pauses | Implemented. Gemma accepts up to 30 seconds, but of a 27-second segment it returned only the first two thirds of what was said |
| Speaking rate, measured from the signal as syllables per second of speaking | Implemented; tried on one synthetic voice at three speeds |
| Gemma 4 E2B listens to each segment: tone of voice, filler words, which of the expected pitch topics it explains, and the statements the speaker makes | Implemented; not yet validated on real recordings (TODO section 1) |
| Gemma 4 E2B reviews the pitch from the segment observations and the measured findings: a level for structure and flow, insights and timestamped feedback | Implemented |
| Pitch score from seven rubric criteria (pace, filler words, pauses, pitch variation, loudness, topic coverage, structure and flow) on levels 0 to 4, with the expected topics no segment explained | Implemented; the rubric (`RUBRIC` in `services/audio/app/main.py`) has not been tried on real recordings |
| Time criterion: the length of the recording against the event's time limit, when the team enters one | Implemented |
| PDF deck upload; pages rendered to images; text size, words per slide, fonts and contrast measured from the file | Implemented; needs a PDF with a text layer for the measurements. PPTX is not accepted |
| Gemma 4 E2B reads each slide: title, main point, one point or several, key points, legibility | Implemented |
| Slide score from seven rubric criteria (topic coverage, one message per slide, text size, text density, contrast, visual consistency, structure and flow) on levels 0 to 4, with the slides that explain each expected topic, insights and feedback by slide number | Implemented; the rubric (`RUBRIC` in `services/audio/app/deck.py`) has not been tried on real decks |
| Check that the spoken pitch follows the deck: deck points the talk never explains, statements where the two disagree, recommendations | Implemented (`services/audio/app/alignment.py`); a report next to the two scores, not part of either. Reading the slides word for word is not checked |
| Verdict for the organizer: after a combined check the team downloads a verdict (both scores, the level behind each criterion, a two-sentence summary, a fingerprint of each file) and a proof that opens the fingerprints | Implemented; see [Verdict](#verdict) |
| `/verify`: the organizer checks a verdict against the files a team shows and against this installation's setup | Implemented in the browser. Comparing the scores means running the files through the main page by hand |
| "See a sample result": shows a saved result without running an analysis | Implemented. `public/sample-check.json` is a real run of the combined check on the test recording and the test deck, and the page labels it as an example |
| Results stay on the page across a reload of the tab | Implemented with `sessionStorage`; the files themselves have to be chosen again |

Whisper and the wav2vec2 emotion classifier have been removed. Every judgement and every piece of feedback comes from Gemma; Praat and the PDF supply measurements only.

### How the scores are built

Each score comes from a rubric: a list of criteria, each with a description for every level from 0 to 4. The 0 to 100 score is arithmetic over the levels (equal weights, steps of 5), so the same levels always give the same score. A criterion that cannot be rated drops out of the score instead of counting as 0.

Who gives a level follows one rule. Where the level descriptions are a judgement, Gemma gives the level. Where they are a count or a share, code gives it from what Gemma heard or read and from the measurements, because Gemma did not apply numeric limits reliably when asked to: it rated 5.7 filler words a minute as "5 or fewer", and a pitch with two expected topics missing as complete.

| Score | Gemma gives the level | Code gives the level |
| --- | --- | --- |
| Pitch | Structure and flow | Pace, pauses, pitch variation and loudness (from the signal), filler words and topic coverage (from what Gemma heard), time (from the recording's length and the event's limit) |
| Slides | Visual consistency, structure and flow | Topic coverage (from Gemma's map of topics to slides), one message per slide (from what Gemma read on each slide), text size, text density, contrast (from the PDF) |

### What Gemma did not hear

One test, on 11 October 2026, with a text-to-speech voice. The same 56 words were spoken at three rates: 124, 169 and 343 words a minute. Gemma 4 E2B got each clip through the per-segment prompt, once with the audio alone and once with the signal measurements in the prompt.

| Clip | Gemma's pace, audio alone | Gemma's pace, with measurements | Measured speaking rate |
| --- | --- | --- | --- |
| 124 words a minute | conversational | conversational | 3.49 syllables a second |
| 169 words a minute | conversational | conversational | 4.23 syllables a second |
| 343 words a minute | conversational | conversational | 7.05 syllables a second |

Gemma's description of the tone was nearly the same sentence for all three clips, and it listed the word "like" in "like tiny fonts" as a filler word every time. So pace is no longer asked of Gemma. It is measured from the signal: syllables are counted as voiced peaks in loudness (de Jong and Wempe 2009) and divided by the seconds of speaking. A segment under 2.7 syllables a second counts as slow and one over 5.5 as fast; those limits are a convention.

The test says nothing about tone: a synthetic voice at three speeds does not change its tone. Whether Gemma hears flat against lively delivery is still open, and it needs human recordings (TODO section 1).

Pauses, pitch variation and loudness had been rated by Gemma from the sound and the measurements in its prompt. On the same steady synthetic voice it gave loudness level 3 in one run and level 2 in the next. Those three are now rated in code as well, from the measurements alone, with limits the team chose: a pause over 2 seconds is long, a segment whose pitch varies by under 2 semitones is even, a segment 6 dB quieter than the whole recording is quiet, and a segment whose loudness swings by over 9 dB is uneven. None of the four has a study behind it. What Gemma does for the pitch is what it showed it can do: hear the filler sounds, the topics and the statements, judge the structure, and write the insights and the feedback from the measured findings.

Only sounds that fill a pause (um, uh, er, hmm) are counted as filler words. Gemma also listed words such as "like" and "so" where they were part of the sentence, so words are left out of the count.

The rubrics rate what can be heard, seen or measured. They have no criterion for emotion, confidence, accent or pronunciation, and the results cards say so. Only two limits rest on something outside the team: the filler word levels on one study in English, and the contrast limit on WCAG 2.2, which was written for the web. The other limits are conventions and are named as such in the code and on the results cards.

## Architecture

```mermaid
flowchart LR
  user([Team]) -->|recording, PDF deck| web

  subgraph browser [Browser]
    web[Next.js page<br/>upload cards, results]
  end

  web -->|multipart upload, NDJSON progress| api[Next.js route handlers<br/>/api/analyze, /api/deck, /api/check]
  api -->|streams the upload| service

  subgraph service [Analysis service: FastAPI]
    direction TB
    ffmpeg[ffmpeg<br/>audio to 16 kHz mono] --> praat[Praat<br/>pauses, pitch, loudness]
    praat --> segments[Segments of up to 30 s]
    pdf[pdfium<br/>page images, text size, fonts, contrast] --> slides[Slides]
    segments -->|audio + measurements| gemma
    slides -->|image + file text| gemma
    gemma[Gemma 4 E2B<br/>Hugging Face Transformers] --> rubric[Rubrics<br/>levels 0-4, scores 0-100]
    gemma --> align[Alignment<br/>talk against deck]
  end
```

The only AI model is Gemma 4 E2B, a Google open model, run locally through Hugging Face Transformers. One model instance serves audio, slide images and text, and one analysis runs at a time.

## Verdict

An event can ask for the result of the check and not for the recording or the deck. After a combined check the results page offers two files.

- **The verdict** goes to the organizer. It holds both scores, the level and the reason for each criterion, the two-sentence summary of what the team builds, how much of the deck the talk covers, and the setup that produced it (model, dtype, and a hash over the service's code, which contains every prompt, rubric and limit). It does not hold the feedback, the timeline, the slide notes or the files.
- **The proof** stays with the team. It holds two random salts.

For each file the verdict carries SHA-256(salt + file). The salt is random per analysis and is made by the service, so the fingerprint says nothing about the file, and the same deck gives a different fingerprint every time. When the organizer asks a finalist to show the recording and the deck, the team hands over the proof with them, and `/verify` checks in the browser that these are the files the verdict was made for and that the verdict came from the same setup as the organizer's installation. The organizer can then run the files through the main page and compare the scores.

What this does and does not give:

- It makes a swapped file or a verdict for another file show up at the check. It does not stop a team from editing a verdict; an edited score shows up only when the organizer re-runs the analysis.
- Scores from a re-run are expected to be close, not always identical: the same model can give different levels on different hardware or dtype. How wide that band is on real hardware has not been measured.
- It does not show which of several attempts a team handed in.
- The verdict is not anonymous: the summary says what the team builds.

None of this is cryptographic proof of an honest analysis, and the app does not call it that.

## Pipeline

All seven steps are built, shaped by the Gemma limits in the next section.

1. The team uploads the pitch video and the deck as a PDF.
2. ffmpeg extracts the audio track as 16 kHz mono.
3. The audio is split into segments of at most 20 seconds. Gemma accepts clips of up to 30 seconds; shorter ones made it keep all of what was said.
4. For each segment, Gemma receives the audio together with signal measurements for that segment (pitch variation, loudness variation, speaking rate, pauses). It returns structured observations about delivery (tone of voice, filler words), the topics covered and the statements the speaker made.
5. Deck pages are rendered to images and measured from the file. Gemma reads each page image, with the page's text from the file, for its title, its point and its key points.
6. Gemma reviews the deck as a whole and scores the pitch from the segment observations. The two scores come out of the rubrics.
7. Gemma compares the key points of the slides with the key points of the speech: deck points the speaker never explained, and statements that contradict the slides. Summarizing a slide or adding explanation is not a finding.

The analysis service has one endpoint for each use: `/analyze/stream` for a recording, `/deck/stream` for a deck, and `/check/stream` for both with the comparison.

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

Images are tagged `latest` and `sha-<short commit>`; set `TAG=sha-abc1234` to run a specific build. Try Gemma on one clip with `docker compose exec audio python -m scripts.probe <file>` after copying the file into the container (`docker compose cp clip.wav audio:/tmp/clip.wav`). Add `--audio-only` to leave the signal measurements out of the prompt and see what Gemma hears on its own.

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

If `pnpm dev` keeps serving old styles or old code after a `git pull`, the dev server missed a file change. That happened with the repository inside a OneDrive folder on Windows: files replaced on disk, as git and some editors do, were not noticed until a restart. Put `NEXT_WATCH_POLL_MS=1000` in `.env.local` to make the dev server poll for changes. Polling costs CPU, so leave it off where file events work.

`GEMMA_DTYPE` sets the dtype the model is loaded in. The default `auto` uses the checkpoint's bf16; GPUs without bf16, such as the T4, need `float16`.

On a Kaggle GPU, for a laptop that cannot run Gemma: import `notebooks/kaggle.ipynb` into Kaggle, follow its first cell (GPU, Internet, `HF_TOKEN` secret) and run all cells. It clones the branch named in `BRANCH` (default `main`) from GitHub, starts the audio service and prints a Cloudflare tunnel URL. Run the web app locally against it:

```bash
AUDIO_SERVICE_URL=https://<printed-url> pnpm dev
```

The page and the service have to be the same version: the page shows an error instead of results when the service behind it is older. With the Kaggle service the recording and the deck leave the laptop, through the tunnel, to Kaggle; that setup is for demonstrations on a machine that cannot run the model.

`SLIDE_TOKENS` sets the visual tokens Gemma spends on one slide (70, 140, 280, 560 or 1120; default 560): more reads small text better and takes longer. `MAX_SLIDES` (default 20) caps how many pages of a deck are analyzed. `PITCH_TOPICS` replaces the six expected topics with an event's own, as a JSON object of name to meaning, for example `{"problem": "what hurts, and for whom", "go-to-market": "how it reaches buyers"}`; both rubrics and the comparison use it. `SEGMENT_SECONDS` (default 20, at most 30) sets the longest audio segment.

On one machine the results repeat. On the laptop CPU the test recording gave the same levels, score, statements and feedback text in two runs, and the test deck the same levels and score in four. Across machines they can differ; that has not been measured.

Measured on one laptop CPU (16 threads, 12 GB for the Docker VM, bf16 weights): a 31-second recording takes about 4 minutes, an 8-slide deck about 13 minutes at 50 to 80 seconds per slide, and the combined check of a one-minute recording with that deck took 16 to 19 minutes in five runs. On a Kaggle T4 the 31-second recording took 64 seconds. These are single runs on one machine, not benchmarks.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/app/page.tsx` | The landing page |
| `src/components/pitch-workspace.tsx` | Owns the two files, runs the three checks and lays out the results |
| `src/components/analysis-overview.tsx`, `analysis-overview.css` | Compact results overview and modal with the full reports and verdict downloads |
| `src/components/audio-analyzer.tsx`, `deck-uploader.tsx`, `combined-pitch-check.tsx` | The recording card, the deck card and the combined button |
| `src/components/pitch-results.tsx`, `deck-results.tsx`, `alignment-results.tsx` | The results views |
| `src/components/verdict-card.tsx`, `src/lib/verdict.ts` | Builds and downloads the verdict and the proof after a combined check |
| `src/app/verify/page.tsx`, `src/components/verdict-checker.tsx` | The organizer's page: checks a verdict against the files a team shows |
| `src/app/api/analyze`, `api/deck`, `api/check` | Route handlers; each streams the upload to the analysis service through `src/lib/proxy-upload.ts` and relays its progress events |
| `src/app/api/health` | The analysis service's status and setup, for `/verify` |
| `src/lib/analysis.ts` | Types for the analysis results and progress events |
| `services/audio/app/main.py` | FastAPI service: loads Gemma, analyzes the recording (decode, measure, split, Gemma per segment, pitch rubric) and serves the endpoints |
| `services/audio/app/deck.py` | Deck analysis: PDF rendering and measurements, Gemma per slide, deck rubric |
| `services/audio/app/alignment.py` | Compares the key points of the slides with the key points of the speech |
| `services/audio/app/rubric.py` | Shared rubric helpers: level descriptions for prompts, validation of Gemma's levels, the 0 to 100 score |
| `services/audio/scripts/probe.py` | Runs the per-segment Gemma prompt on one clip of 30 s or less, with or without the signal measurements, for testing what Gemma hears |
| `services/audio/scripts/smoke_test.py` | Runs the service end to end with a tiny random Gemma 4; CI runs it in the audio image before tagging |
| `docker-compose.yml` | The `web` and `audio` services |
| `notebooks/kaggle.ipynb` | Runs the audio service on a Kaggle GPU behind a Cloudflare tunnel |

## Privacy

PitchCheck is privacy first: a startup should not have to send its idea to someone else's server to get feedback. For competitions, the web app, the analysis service and Gemma all run on the organizer's server, and recordings and decks are never sent to an outside AI provider. The landing page states this beside the upload cards, in the FAQ and in the footer.

The recording and the deck go from the browser to the analysis service named in `AUDIO_SERVICE_URL` and nowhere else. The service keeps them in memory and in a temporary file for the length of one analysis and stores nothing afterwards. With Docker Compose both services run on the same machine, and the only outside traffic is the download of the model weights from Hugging Face on first start.

The Kaggle notebook is a development option: with it the files leave the machine. Competition deployments must run the analysis service and Gemma on the organizer's server to keep the privacy promise. On a laptop CPU the model fits in 12 GB but a full check of a pitch and a deck takes tens of minutes, so the organizer's server needs a GPU to make the wait short.
