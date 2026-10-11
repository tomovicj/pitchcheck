# TODO

Work queue for the hackathon build. Sections are in priority order, and so are the items inside each one. Requirements and background are in [README.md](README.md).

## Questions that need a human answer

Each has a working assumption so the build is not blocked. Change the assumption here when the team decides.

- [ ] **May any non-Gemma model stay?** Assumed no: Whisper and the wav2vec2 emotion classifier leave the analysis path. Praat signal measurements stay, because they are measurements and not an AI model.
- [ ] **What does "no transcript" rule out?** Assumed: a transcript is never the basis for the pitch score. Open: whether the UI may still show the text of what was said.
- [ ] **Score scale and rubric.** Proposed: 0 to 100 for the slides and 0 to 100 for the pitch, each built from per-criterion sub-scores against a fixed rubric.
- [ ] **Slide formats.** Proposed: PDF only for the demo. PPTX needs a conversion step.
- [ ] **Demo hardware.** Competition deployment runs the web app, audio service and Gemma on the organizer's server. Still to confirm the demo machine and whether it has a GPU.

## 1. Prove that Gemma can hear delivery

Do this first. Requirement 3 rests on it, and the official documentation lists only speech recognition and translation as audio tasks.

- [x] Get one audio clip through Gemma. Implemented with the documented `any-to-any` Transformers pipeline; numpy arrays are passed directly. Not yet run on the demo machine. Transformers has the only official audio example (`AutoProcessor` with `AutoModelForMultimodalLM`), and `services/audio` already depends on `transformers` and `torch`. Ollama audio support is reported by third parties only; verify it before relying on it.
- [ ] Choose the variant: Gemma 4 E2B, E4B or 12B Unified. E2B is the default (`GEMMA_MODEL`); still to measure load time, memory use and compute time per 30-second clip on the demo machine. `requirements.txt` currently pulls CPU-only torch wheels.
- [ ] Record the same 20 to 30 second script three ways: flat, energetic, rushed and nervous. Run `python -m scripts.probe <file>` from `services/audio` on each (or `docker compose exec audio python -m scripts.probe <file>` with the file copied into the container). Ask Gemma to describe tone, emotion and energy for each. The answers must differ and must match what a listener hears.
- [ ] If the answers do not track the delivery, tune how the measurements are described in the prompt and repeat the test. The per-segment measurements (pitch variation, loudness variation, pause ratio) are already sent alongside the audio.
- [ ] Write down what was tried and what happened. The jury asks for one real implementation problem and how it was solved.

## 2. Pitch analysis

- [x] Split the decoded audio into segments of at most 30 seconds, cutting at pauses so words are not split.
- [x] Per segment, call Gemma with the audio and its measurements. Get JSON back: tone, emotion, energy, pace, filler words heard, topics covered.
- [x] Compute pauses from the signal (intensity and voicing) instead of from Whisper word timestamps.
- [x] Remove `faster-whisper` and the wav2vec2 pipeline from `services/audio/app/main.py` and `requirements.txt`, the `WHISPER_MODEL` and `EMOTION_MODEL` variables from `docker-compose.yml`, and the Transcript and Emotion cards from `src/components/audio-analyzer.tsx`.
- [x] Combine the segment results into the pitch score, insights and feedback. Keep timestamps so feedback can point at a moment in the recording. The rubric in the prompt is provisional until section 5.
- [x] Update `AnalysisStage` in `src/lib/analysis.ts` and the stage labels in the UI to match the new steps.

## 3. Slide analysis

- [ ] Accept a deck upload next to the recording.
- [ ] Render deck pages to images and send them to Gemma with the rubric. Pick a visual token budget (70 to 1120 per image) that keeps small text legible without making the run too slow.
- [ ] Collect per-slide observations (clutter, legibility, clarity) and deck-level ones (structure, topics covered, topics missing).
- [ ] Produce the slide score, insights and feedback.

## 4. Pitch against deck

- [ ] Compare the topics heard in each segment with the slides. Report deck topics the speaker never explained and statements that contradict the slides.
- [ ] Do not penalize summarizing a slide or adding explanation that is not on it.

## 5. Scoring

- [ ] Write the rubric for the slides and the rubric for the pitch: the criteria and what each level means. The hackathon's own Delivery criteria are a possible starting point.
- [ ] Fix a JSON schema for the result. Validate the model output and retry when it does not parse. Parsing and one retry exist; field-level validation does not.
- [ ] Make scores repeatable: use greedy decoding and fixed prompts, then run the same input three times and compare.
- [ ] State in the UI that the scores rate the deck and the delivery, not the business idea.

## 6. Interface

- [x] Two upload inputs: recording and PDF deck. Deck selection and preview are browser-local; submitting it for Gemma analysis remains in section 3.
- [x] Centered pitch + deck button with a distinct visual treatment and an expandable explanation of the planned separate scores and speech-to-slide alignment. Marked coming soon until the combined analysis is implemented.
- [x] Reference-inspired landing page, supplied logo and responsive upload workspace on the `frontend` branch.
- [ ] Results view with both scores, insights, feedback, and the pitch-against-deck findings.
- [x] Redesign the upload cards and delivery results: real Gemma score and criteria, insights, timestamped improvement suggestions, pitch moments and measured audio details. Deck results are explicitly coming soon until the backend exists.
- [x] Keep the upload cards' claims true: video analysis uses the audio track; PDF selection and preview are local to the browser, and slide scoring is marked coming soon.
- [x] Draw arrows as SVG icons, not Unicode characters. Shared `lucide-react` SVG icons are used throughout the frontend.
- [x] State the privacy first organizer-hosted deployment on the landing page, beside uploads and in the FAQ: recordings and decks stay on the competition organizer's server, where Gemma runs.

## 7. Demo and pitch evidence

These map to the jury's Technology criteria.

- [ ] One architecture diagram that names the Google technology actually in use.
- [ ] One implementation problem and its fix. A candidate already in the code: `fetch` buffered large video uploads in memory, so `src/app/api/analyze/route.ts` streams them with `node:http`. The Gemma audio test in section 1 may give a better one.
- [ ] Record a full run on real material as a fallback for the live demo.
- [ ] Measure what one machine handles (analysis time per pitch, concurrent analyses) so the scalability answer is based on numbers.
- [ ] Claim only what the build does. "Gemma recognizes emotion in the voice" goes in the pitch only if section 1 confirms it.

## Later

Not for the demo unless everything above is done.

- Summary and verdict for organizers or the jury, and a way for the organizer to check that a verdict was not edited.
- Criteria that the organizer can configure.
- PPTX upload.
- Body language and eye contact from video frames.
- Shark Tank style Q&A simulator.

## Done

From the git history up to `a0a917e`.

- [x] Next.js app with shadcn/ui and a dark theme
- [x] Docker Compose setup with the web app and the local audio service
- [x] Audio and video upload, streamed to the audio service without buffering the file in memory
- [x] Speech metrics, pitch and loudness measurements, and emotion detection, without Gemma
- [x] Live progress during analysis
