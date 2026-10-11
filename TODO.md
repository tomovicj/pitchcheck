# TODO

Work queue for the hackathon build. Sections are in priority order, and so are the items inside each one. Requirements and background are in [README.md](README.md).

## Questions that need a human answer

Each has a working assumption so the build is not blocked. Change the assumption here when the team decides.

- [ ] **May any non-Gemma model stay?** Assumed no: Whisper and the wav2vec2 emotion classifier left the analysis path. Praat signal measurements and the measurements from the PDF stay, because they are measurements and not an AI model.
- [ ] **May code give rubric levels?** Working choice since 11 October 2026: code gives every level. Each level description is a count, a share or a measurement, and Gemma supplies what is counted: what it hears and reads, and which of those statements say each expected topic. Gemma writes all the feedback. The reason is in README, "How the scores are built". If the team reads "Gemma does the analysis" more strictly, levels go back into the prompts.
- [ ] **What does "no transcript" rule out?** Assumed: a transcript is never the only basis for judging delivery; delivery is rated from the signal. What the pitch says is rated from the statements Gemma heard, and the page now shows the statement behind each expected topic. Open: whether the page may show more of what was said.
- [ ] **Score scale and rubrics.** Working choice: levels 0 to 4 with a description per level, shown as 0 to 100 in steps of 5. Nine criteria for the pitch (ten with a time limit) in two groups, content at 60% and delivery at 40%; eleven for the slides, content and design at 50% each; inside content the topics count three times and their numbers twice. The standards are Y Combinator's; the weights and nearly all limits are the team's. Not tried on real pitches.
- [ ] **Which topics does a pitch have to cover?** Working choice: Y Combinator's eight (problem, solution, market, traction, unique insight, business model, team, ask). A one-minute hackathon pitch is marked down for leaving out traction or the team. An event that expects less sets `PITCH_TOPICS`.
- [x] **Emotion labels.** Working decision, 11 October 2026: the product describes how the delivery sounds (pace, pauses, filler words, pitch, loudness) and does not label the speaker's emotions or state of mind. Gemma's ability to hear emotion is undocumented, the EU AI Act restricts inferring emotion from the voice, and such labels carry bias. Reopen here if the team wants emotion labels back.
- [ ] **Slide formats.** Working choice: PDF only. Measurements need a PDF with a text layer. PPTX needs a conversion step.
- [ ] **Demo hardware.** Competition deployment runs the web app, the analysis service and Gemma on the organizer's server. Still to confirm the demo machine and whether it has a GPU. On a laptop CPU a full check of a one-minute pitch and an eight-slide deck took 18 minutes.

## 1. Prove that Gemma can hear delivery

Requirement 3 rests on it, and the official documentation lists only speech recognition and translation as audio tasks. Still open: everything so far ran on a text-to-speech voice.

- [x] Get one audio clip through Gemma, with `AutoProcessor` and `AutoModelForMultimodalLM` from Transformers.
- [x] Pace, tested with a synthetic voice: the same text at 124, 169 and 343 words a minute got "conversational" from Gemma every time, with and without the measurements in the prompt. Pace is now measured from the signal. The table is in README, "What Gemma did not hear".
- [ ] Choose the variant: Gemma 4 E2B, E4B or 12B Unified. E2B is the default (`GEMMA_MODEL`). `requirements.txt` pulls CPU-only torch wheels.
- [ ] Tone, with human voices: a synthetic voice cannot answer this. Record the same 20 to 30 second script three ways: flat, energetic, rushed and nervous. Run `python -m scripts.probe <file> --audio-only` from `services/audio` on each (or `docker compose exec audio python -m scripts.probe <file> --audio-only` with the file copied into the container), then again without the flag. The `tone` answers must differ between the recordings and match what a listener hears. If they do so only when the measurements are in the prompt, the description comes from the measurements and not from what Gemma hears.
- [ ] If the answers do not track the delivery, tune how the measurements are described in the prompt and repeat the test.
- [ ] Write down what was tried and what happened.

## 2. Pitch analysis

- [x] Split the decoded audio into segments of at most 20 seconds, cutting at pauses so words are not split. The last two segments are split near the middle, so a recording does not end in a stub. Gemma would take 30 seconds, but it dropped the end of a 27-second segment from its list of what was said.
- [x] Per segment, call Gemma with the audio and its measurements. Get JSON back: tone of voice, filler words heard, topics covered, the statements the speaker made.
- [x] Measure the speaking rate of each segment from the signal and label it slow, conversational or fast.
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
- [ ] Try it on a real pitch. On the test pair it found the planted price mismatch in every run. The slide the talk skipped (the team) it found in one run of five, and with 30-second segments it also listed points the talk did explain, because Gemma's list of what was said was incomplete.

## 5. Scoring

- [x] Rubric for the pitch and rubric for the slides, with a description for each level from 0 to 4. Scores are computed from the levels.
- [x] Stricter rubrics on Y Combinator's standards: expected topics, opening, numbers, plain language, tighter limits, and content weighted above delivery. Sources and the changed limits are in README, "Where the standards come from".
- [x] Every level is given in code. Gemma labels each statement it heard or read with the expected topic it says.
- [x] First run with the real model (Kaggle T4, 11 October 2026). Asked for the statements behind each topic, the checklist came back empty for all nine items and the pitch scored 45, the deck 40. The question was turned round into a label for each statement (README, "What the first run with the real model showed").
- [ ] **Run the labelling prompt with the real model.** Restart the Kaggle service from this branch and run the combined check on the test recording and the test deck. Read `labelled` in each summary of the result: every statement with its label. Look for a topic marked as said on the strength of a statement about something else, and for a statement that says a topic and got "none". Then tune `LABEL_PROMPT` in `services/audio/app/rubric.py`.
- [ ] Run `python -m scripts.smoke_test` in the audio image. It was updated for the new result format and has not run since; CI runs it on a push to `main`.
- [ ] Save that run as `public/sample-check.json`. The file there is from the first rubric, and the page refuses to show it.
- [ ] Try both rubrics on real material and adjust the level descriptions and limits. Only the ends of the filler word scale (one study, in English), the contrast limit (WCAG 2.2, written for the web) and the 24 pt text size (Penn State's guidance for projected slides) come from outside the team.
- [ ] The list of marketing words (`BUZZWORD` in `services/audio/app/rubric.py`) is short and English only. Check it against real pitches for honest words it marks and jargon it misses.
- [x] Code gives the levels for pace, pauses, pitch variation and loudness from the measurements. Gemma's levels for them moved between runs on the same voice.
- [ ] Check the signal limits on real recordings: 2.7 and 5.0 syllables a second for pace, 2 seconds for a long pause and 3 pauses a minute as the fewest, 2 semitones for even pitch, 6 dB and 9 dB for loudness (constants at the top of `services/audio/app/main.py`). They are the team's choice; none has a validated source.
- [ ] Organizer's topic list in the interface. The service takes the event's own topics from the `PITCH_TOPICS` variable (JSON, name to meaning); the default eight mark a short pitch down for skipping "traction" and "team". There is no screen for it.
- [x] Validate the model output: JSON parsing with one retry, levels, slide numbers, timestamps and lists are checked; anything else Gemma adds is dropped.
- [x] Repeatable on one machine: greedy decoding, fixed prompts, and most levels are arithmetic. On the laptop CPU the test recording gave the same levels, score, statements and feedback text in two runs, and the test deck the same levels and score in four.
- [ ] Measure how far scores move between machines (CPU bf16 against a T4 in float16, for a start). The verdict check needs that band.
- [x] State on the results cards that the scores rate the delivery and the deck, not the business idea, what is measured, that the scores are not validated, and that the pitch score can be less accurate for some speakers.

## 6. Interface

- [x] Two upload cards, recording and PDF deck, each with its own check.
- [x] Combined "Check pitch + deck" button that runs both and compares them.
- [x] Results view with both scores side by side, insights, feedback, and the pitch-against-deck report.
- [x] Landing page copy matches what the build does.
- [x] Draw arrows as SVG icons, not Unicode characters.
- [x] Show the page thumbnails next to the slide-by-slide notes.
- [x] Keep results when the page is reloaded. They are still lost when the tab closes, and a running check is lost on reload.
- [x] Redesign the landing page and the upload cards (feature list, step numbers, illustrated how-it-works).
- [x] State the privacy first, organizer-hosted deployment on the landing page, beside the uploads, in the FAQ and in the footer.
- [x] Bring the results views into the new design: a compact overview with up to five metrics and a "SHOW MORE" modal for the full pitch, deck and comparison reports and verdict downloads. Uploaded recordings use a compact file card without a video thumbnail; the event time-limit field hides after pitch analysis.

## 7. Demo and pitch evidence

These map to the jury's Technology criteria.

- [x] One architecture diagram that names the Google technology in use: README, "Architecture".
- [x] One implementation problem and its fix. The strongest: Gemma did not hear pace (the same text at 124 and at 343 words a minute was "conversational" both times), so pace is measured from the signal and Gemma is no longer asked. The second: Gemma did not apply numeric limits (5.7 filler words a minute rated as "5 or fewer"; a pitch with two topics missing rated complete), so counts are rated in code and Gemma keeps the judgements. Others in the code: loudness statistics swamped by digital silence; `fetch` buffering large uploads in memory.
- [ ] Record a full run on real material as a fallback for the live demo. "See a sample result" is out of order until `public/sample-check.json` is replaced with a run of the current rubric (section 5); replace it with a run on real material when there is one.
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
