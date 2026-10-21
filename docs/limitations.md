# Limitations and next steps

PitchCheck was built in a weekend hackathon. Everything below was still open when it ended. It replaces the former `TODO.md`; the completed items there are covered by the git history and by [how-it-works.md](how-it-works.md).

## What has not been validated

- **No real pitches yet.** Every run with the real model used synthetic material: a text-to-speech voice and a deck made for the test. The rubrics, limits and scores have not been tried on real recordings or decks.
- **Gemma hearing tone of voice.** The Gemma documentation lists only speech recognition and translation as audio tasks. Pace is measured from the signal because Gemma rated 124 and 343 words a minute both as "conversational". Whether Gemma tells flat delivery from lively delivery is untested. To test it:
  1. Record the same 20 to 30 second script three ways: flat, energetic, and rushed or nervous.
  2. On each recording, run `python -m scripts.probe <file> --audio-only` from `services/analysis`, then run it again without the flag.
  3. Compare the `tone` answers. They must differ between the recordings and match what a listener hears. If they differ only when the measurements are in the prompt, the description comes from the measurements and not from Gemma's hearing.
- **The deck checklist wording.** The labelling prompt for decks was rewritten after the fourth real run, and the new wording has not run with the model. To check it, run the combined check and read `labelled` and `label_replies` in the deck summary. The expected labels for the test deck are slide 1 "what it does" or "solution", 2 "problem", 3 "solution", 4 "market", 5 "business model", 6 "unique insight", 7 "team" and 8 "ask".
  - "none" for a deck now means only a closing slide. A slide that fits no topic, such as an agenda or a roadmap, is pushed towards the closest topic.
  - Each slide gets one label, so a slide that covers two topics counts for only one.
- **Signal limits are the team's conventions.** None of these has a validated source: 2.7 and 5.0 syllables a second for pace, 2 seconds for a long pause, at least 3 pauses a minute, 2 semitones for even pitch, and 6 dB and 9 dB for loudness. They are constants at the top of `services/analysis/app/main.py`. Only three limits come from outside the team: the filler word rates (one English study), the contrast limit (WCAG 2.2) and the 24 pt minimum text size (Penn State's guidance for projected slides).
- **Marketing word list.** `BUZZWORD` in `services/analysis/app/rubric.py` is short and in English only.
- **Repeatability across machines.** Scores on different hardware or dtypes have not been compared (for example CPU bf16 against a T4 in float16). The [verdict](verdict.md) check needs that band.
- **Languages.** Nothing has been tried in Serbian. On the test voice, Gemma heard two of three filler words.
- **Real decks.** Measurements were checked on one PDF printed from a browser. Decks exported from PowerPoint, Google Slides, Keynote and Canva are untried. A PDF made of images gets no measurements, and text over a photo or a gradient gets an estimated contrast. `SLIDE_TOKENS=1120` on small text has not been compared with the default.

## Known gaps in the product

- **The "See a sample result" link is hidden.** The saved sample was made under the first rubric, and the page cannot show it, so it was removed. The link comes back by itself once a run of the current service is saved as `apps/web/public/sample-check.json`.
- **PDF only.** PPTX needs a conversion step. The pitch deck mentions python-pptx, but it is not part of the build.
- **Reading slides word for word** is not detected. That would need the words that were said, not the key points.
- **No screen for the organizer's topics.** Events set their topics through `PITCH_TOPICS` only.
- **One analysis at a time** per service instance. A running check is lost on reload, and results are kept only in `sessionStorage`.
- **The verdict** is not tied to an event, and `/verify` cannot re-run the analysis by itself. It has no defence against instructions to the model hidden in a deck. Details are in [verdict.md](verdict.md).

## Product decisions taken as working assumptions

- **Only Gemma models are on the analysis path.** Whisper and a wav2vec2 emotion classifier were removed. Praat and the PDF supply measurements only.
- **Code gives every rubric level.** Gemma supplies what is counted (statements, labels, filler sounds) and writes all of the feedback. If "Gemma does the analysis" is read more strictly, levels go back into the prompts.
- **No emotion labels.** The product describes how delivery sounds and never labels the speaker's emotions or state of mind (decided 11 October 2026). Gemma's ability to hear emotion is undocumented, the EU AI Act restricts inferring emotion from the voice, and such labels carry bias.
- **Y Combinator's eight topics** are the default (problem, solution, market, traction, unique insight, business model, team, ask). As a result, a one-minute hackathon pitch is marked down for skipping traction or team.
- **Score scale.** Levels run from 0 to 4 and are shown as 0 to 100 in steps of 5.
  - Pitch: content counts 60% and delivery 40%.
  - Slides: content and design count 50% each.

## Ideas for later

- Organizer-configurable criteria and topic lists.
- PPTX upload.
- Body language and eye contact from video frames.
- A Q&A simulator in the style of Shark Tank.
- Scaling beyond hackathons: sales presentations, educational talks, public speaking coaching (from the pitch deck).
