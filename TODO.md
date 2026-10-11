# TODO

Work queue for the hackathon build. Sections are in priority order, and so are the items inside each one. Requirements and background are in [README.md](README.md).

## Questions that need a human answer

Each has a working assumption so the build is not blocked. Change the assumption here when the team decides.

- [ ] **May any non-Gemma model stay?** Assumed no: Whisper and the wav2vec2 emotion classifier left the analysis path. Praat signal measurements and the measurements from the PDF stay, because they are measurements and not an AI model.
- [ ] **May code give rubric levels?** Working choice: yes, where the level descriptions are a count or a share (pace, filler words, topic coverage, time; one message per slide, text size, density, contrast). Gemma supplies what is counted and gives every level that is a judgement. The reason is in README, "How the scores are built". If the team reads "Gemma does the analysis" more strictly, those levels go back into the prompts.
- [ ] **What does "no transcript" rule out?** Assumed: a transcript is never the basis for the pitch score. The service now asks Gemma for the key points of what was said, to compare the talk with the deck; the page does not show them. Open: whether the page may show them.
- [ ] **Score scale and rubrics.** Working choice: levels 0 to 4 with a description per level, shown as 0 to 100 in steps of 5 with equal weights. Seven criteria for the pitch (eight with a time limit), seven for the slides. Not tried on real pitches.
- [x] **Emotion labels.** Working decision, 11 October 2026: the product describes how the delivery sounds (pace, pauses, filler words, pitch, loudness) and does not label the speaker's emotions or state of mind. Gemma's ability to hear emotion is undocumented, the EU AI Act restricts inferring emotion from the voice, and such labels carry bias. Reopen here if the team wants emotion labels back.
- [ ] **Slide formats.** Working choice: PDF only. Measurements need a PDF with a text layer. PPTX needs a conversion step.
- [ ] **Where the demo runs.** Participant laptop or one organizer-style server, and whether that machine has a GPU. On a laptop CPU a full check of a one-minute pitch and an eight-slide deck took 18 minutes.

## 1. Prove that Gemma can hear delivery

Requirement 3 rests on it, and the official documentation lists only speech recognition and translation as audio tasks. Still open: everything so far ran on a text-to-speech voice.

- [x] Get one audio clip through Gemma, with `AutoProcessor` and `AutoModelForMultimodalLM` from Transformers.
- [ ] Choose the variant: Gemma 4 E2B, E4B or 12B Unified. E2B is the default (`GEMMA_MODEL`). `requirements.txt` pulls CPU-only torch wheels.
- [ ] Record the same 20 to 30 second script three ways: flat, energetic, rushed and nervous. Run `python -m scripts.probe <file> --audio-only` from `services/audio` on each (or `docker compose exec audio python -m scripts.probe <file> --audio-only` with the file copied into the container), then again without the flag. The `tone` and `pace` answers must differ between the recordings and match what a listener hears. If they do so only when the measurements are in the prompt, the description comes from the measurements and not from what Gemma hears.
- [ ] If the answers do not track the delivery, tune how the measurements are described in the prompt and repeat the test.
- [ ] Write down what was tried and what happened.

## 2. Pitch analysis

- [x] Split the decoded audio into segments of at most 30 seconds, cutting at pauses so words are not split. The last two segments are split near the middle, so a recording does not end in a stub.
- [x] Per segment, call Gemma with the audio and its measurements. Get JSON back: tone of voice, pace, filler words heard, topics covered, key points of what was said.
- [x] Compute pauses from the signal (intensity and voicing) instead of from Whisper word timestamps.
- [x] Remove `faster-whisper` and the wav2vec2 pipeline.
- [x] Combine the segment results into the pitch score, insights and feedback, with timestamps.
- [x] Rate the length of the recording against the event's time limit when the team enters one.
- [ ] Try it on real recordings, in English and in Serbian. Gemma heard two of three filler words in the test voice.

## 3. Slide analysis

- [x] Accept a PDF deck next to the recording.
- [x] Render deck pages to images and send each to Gemma with the page's text from the file. The visual token budget is `SLIDE_TOKENS`, 560 by default.
- [x] Measure from the file: text size as a share of the slide height, words per slide, fonts, and contrast between the text colour and the rendered page around it.
- [x] Per-slide observations (title, point, key points, legibility) and a deck-level review (which slides explain each expected topic, visual consistency, structure).
- [x] Slide score, insights and feedback by slide number. Gemma is told the measured problems so that its feedback names them.
- [ ] Try it on real decks from PowerPoint, Google Slides, Keynote and Canva. The measurements were checked on one PDF printed from a browser. A PDF of images gets no measurements; text over a photo or a gradient gets an estimated contrast.
- [ ] Try `SLIDE_TOKENS=1120` on slides with small text and compare what Gemma reads.

## 4. Pitch against deck

- [x] Compare the key points of the slides with the key points of the speech. Report deck points the speaker never explained and statements that contradict the slides, with slide numbers and timestamps.
- [x] Do not penalize summarizing a slide or adding explanation that is not on it. The prompt says so, and the report is not part of either score.
- [ ] Check reading the slides word for word. It needs the words that were said, not key points.
- [ ] Try it on a real pitch. On the test pair it found the planted price mismatch and the slide the talk skipped.

## 5. Scoring

- [x] Rubric for the pitch and rubric for the slides, with a description for each level from 0 to 4. Scores are computed from the levels.
- [x] Counts and shares are rated in code; judgements by Gemma.
- [ ] Try both rubrics on real material and adjust the level descriptions and limits. Only the filler word limits (one study, in English) and the contrast limit (WCAG 2.2, written for the web) come from outside the team.
- [ ] Decide whether code should also give the levels for pauses, pitch variation and loudness from the measurements. It needs numeric limits, and none has a validated source.
- [ ] Organizer's topic list. The expected topics are fixed in `PITCH_TOPICS` (`services/audio/app/rubric.py`); a short pitch is marked down for skipping "alternatives" and "team".
- [x] Validate the model output: JSON parsing with one retry, levels, slide numbers, timestamps and lists are checked; anything else Gemma adds is dropped.
- [ ] Make scores repeatable: greedy decoding and fixed prompts are in place. Run the same input three times on the demo machine and compare. On different hardware or dtype the levels can differ.
- [x] State on the results cards that the scores rate the delivery and the deck, not the business idea, what is measured, that the scores are not validated, and that the pitch score can be less accurate for some speakers.

## 6. Interface

- [x] Two upload cards, recording and PDF deck, each with its own check.
- [x] Combined "Check pitch + deck" button that runs both and compares them.
- [x] Results view with both scores side by side, insights, feedback, and the pitch-against-deck report.
- [x] Landing page copy matches what the build does.
- [x] Draw arrows as SVG icons, not Unicode characters.
- [ ] Show the page thumbnails next to the slide-by-slide notes.
- [ ] Keep results when the page is reloaded. A long check is lost if the tab closes.

## 7. Demo and pitch evidence

These map to the jury's Technology criteria.

- [x] One architecture diagram that names the Google technology in use: README, "Architecture".
- [x] One implementation problem and its fix: Gemma did not apply numeric limits (5.7 filler words a minute rated as "5 or fewer"; a pitch with two topics missing rated complete), so counts are now rated in code and Gemma keeps the judgements. Others in the code: loudness statistics swamped by digital silence; `fetch` buffering large uploads in memory.
- [ ] Record a full run on real material as a fallback for the live demo.
- [ ] Measure what one machine handles on the demo hardware. Known so far, single runs: laptop CPU, 31 s recording in about 4 minutes, 8 slides in about 13 minutes; Kaggle T4, 31 s recording in 64 seconds. One analysis runs at a time.
- [ ] Claim only what the build does. "Gemma hears tone of voice" goes in the pitch only if section 1 confirms it. Do not claim emotion recognition: the product does not label emotions.

## Later

Not for the demo unless everything above is done.

- Verdict, next steps. Built: the verdict and proof downloads, and `/verify`, which checks the files and the setup (README, "Verdict"). Not built: re-running the analysis from `/verify` and comparing the scores automatically; a published band for how far scores may differ between machines, which has to be measured first; binding a verdict to an event with a value the organizer issues, so that a verdict from another event cannot be reused; a defence against instructions to the model hidden in a deck.
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
