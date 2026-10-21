# How PitchCheck works

The analysis pipeline, how the two scores are built, and what the team learned about Gemma while building it. For setup see [deployment.md](deployment.md); for what is still open see [limitations.md](limitations.md).

## Pipeline

All seven steps are built, shaped by the Gemma limits described [below](#what-the-gemma-documentation-confirms).

1. The team uploads the pitch video and the deck as a PDF.
2. ffmpeg extracts the audio track as 16 kHz mono.
3. The audio is split into segments of at most 20 seconds. Gemma accepts clips of up to 30 seconds; shorter ones made it keep all of what was said.
4. For each segment, Gemma receives the audio together with signal measurements for that segment (pitch variation, loudness variation, speaking rate, pauses). It returns structured observations about delivery (tone of voice, filler words) and the statements the speaker made.
5. Deck pages are rendered to images and measured from the file. Gemma reads each page image, with the page's text from the file, for its title, its point and its key points.
6. For the pitch and for the deck, Gemma gets the statements it heard or read as a numbered list and labels each with the expected thing it says, or with none. Code gives every level from that and from the measurements, and the two scores come out of the rubrics. Gemma then writes the insights and the feedback from the rated findings.
7. Gemma compares the key points of the slides with the key points of the speech: deck points the speaker never explained, and statements that contradict the slides. Summarizing a slide or adding explanation is not a finding.

The analysis service has one endpoint for each use: `/analyze/stream` for a recording, `/deck/stream` for a deck, and `/check/stream` for both with the comparison.

## What is implemented

Read from the code on `main` after the hackathon (13 October 2026). "Implemented" means it runs end to end with the real model, except where a row says it has not yet; none of it has been validated on real pitches.

| Capability | State |
| --- | --- |
| Upload an audio or video recording; for video the audio track is extracted with ffmpeg | Implemented |
| Live progress while the analysis runs | Implemented |
| Pitch and loudness variation, measured from the signal with Praat | Implemented; sent to Gemma as supporting evidence |
| Pauses, measured from the signal with Praat | Implemented |
| Splitting the audio into segments of at most 20 seconds, cut at pauses | Implemented. Gemma accepts up to 30 seconds, but of a 27-second segment it returned only the first two thirds of what was said |
| Speaking rate, measured from the signal as syllables per second of speaking | Implemented; tried on one synthetic voice at three speeds |
| Gemma 4 E2B listens to each segment: tone of voice, filler words, and the statements the speaker makes | Implemented; not yet validated on real recordings (see [Limitations](limitations.md)) |
| Checklist for the pitch: Gemma gets the statements it heard as a numbered list and labels each with what it says: what the company does, one of the eight expected topics, or none | Ran with the real model on the test recording, twice: the labels held up both times. The first version, which asked for the statements behind each topic, had come back empty |
| Gemma 4 E2B writes the insights and the feedback on the weakest criteria, lowest level first; an item that names none of them is dropped | Ran with the real model: right for the pitch (one item for each finding), mixed up for the deck (items under the wrong finding). Items are now tied by the finding's name; that has not run yet |
| Pitch score from nine rubric criteria in two groups, content (opening, topic coverage, numbers, plain language) and delivery (pace, filler words, pauses, pitch variation, loudness), on levels 0 to 4, every level given in code | Written and checked without the model, on the observations saved from a real run; the rubric (`RUBRIC` in `services/analysis/app/main.py`) has not been tried on real recordings |
| Time criterion: the length of the recording against the event's time limit, when the team enters one | Implemented |
| PDF deck upload; pages rendered to images; text size, words per slide, fonts, contrast, where the largest text sits and the size of the title measured from the file | Implemented; needs a PDF with a text layer for the measurements. PPTX is not accepted |
| Gemma 4 E2B reads each slide: title, main point, one point or several, key points, legibility | Implemented |
| Checklist for the deck: the same labels, one for each slide, from the title, the point and the key points Gemma read | Fourth version. Labelled line by line, the slide about the problem came out as "solution" and then as "traction" with the real model. With one label for a slide it got six of the eight slides of the test deck right and wrote "none" for the title slide and for the slide about the problem; the wording written after that has not run with it yet |
| Slide score from eleven rubric criteria in two groups, content (title slide, topic coverage, numbers, plain language) and design (one message per slide, words per slide, text size, contrast, key text at the top, visual consistency, deck length), on levels 0 to 4, every level given in code | Written and checked without the model, on the test deck and the observations saved from a real run; the rubric (`RUBRIC` in `services/analysis/app/deck.py`) has not been tried on real decks |
| Results in two steps: an overview with both scores and up to five measurements, and "SHOW MORE" for the full reports in a modal: the score of each group, the feedback, the criteria with the standard behind each, the checklist with what was found for each topic, the insights, the measurements, the timeline and the slide notes | Implemented |
| Check that the spoken pitch follows the deck: deck points the talk never explains, statements where the two disagree, recommendations | Implemented (`services/analysis/app/alignment.py`); a report next to the two scores, not part of either. Reading the slides word for word is not checked |
| Verdict for the organizer: after a combined check the team downloads a verdict (both scores, the level behind each criterion, a two-sentence summary, a fingerprint of each file) and a proof that opens the fingerprints | Implemented; see [verdict.md](verdict.md) |
| `/verify`: the organizer checks a verdict against the files a team shows and against this installation's setup | Implemented in the browser. Comparing the scores means running the files through the main page by hand |
| "See a sample result": shows a saved result without running an analysis | Hidden. The saved sample was made under the first rubric and was removed; the link reappears once a run of the current service is saved as `apps/web/public/sample-check.json` |
| Results stay on the page across a reload of the tab | Implemented with `sessionStorage`; the files themselves have to be chosen again |

Whisper and the wav2vec2 emotion classifier have been removed. Every judgement and every piece of feedback comes from Gemma; Praat and the PDF supply measurements only.

## How the scores are built

Each score comes from a rubric: a list of criteria, each with a description for every level from 0 to 4. Since 11 October 2026 the rubrics follow Y Combinator's published advice to founders, and they are stricter than the first version: on the test pair, the pitch went from 90 to 65 and the deck from 75 to 60 when the saved observations were rated again (with a stand-in for Gemma's checklist answers, so those two numbers show the arithmetic, not a run of the model).

The criteria sit in two groups, and the score is arithmetic over the levels, in steps of 5.

| Score | Group | Criteria |
| --- | --- | --- |
| Pitch | Content, 60% | Opening (says what the company does in the first 20 seconds), topic coverage (counts three times), numbers (market and traction stated with a number; counts twice), plain language |
| Pitch | Delivery, 40% | Pace, filler words, pauses, pitch variation, loudness, and time when the team enters the event's limit |
| Slides | Content, 50% | Title slide (the first slide says what the company does), topic coverage (three times), numbers (twice), plain language |
| Slides | Design, 50% | One message per slide, words per slide, text size, contrast, key text at the top, visual consistency, deck length |

The expected topics are the questions Y Combinator tells founders to answer: problem, solution, market, traction, unique insight, business model, team and the ask. A criterion that cannot be rated drops out of its group. A group with nothing rated leaves no score, so a pitch is never scored on delivery alone.

**Code gives every level.** Gemma supplies what is counted. It listens to each segment and reads each slide, and then gets the statements it heard or read back as a numbered list and gives each one a label: the expected topic the statement says, or none. A topic with no statement counts as missing, and market and traction count as stated with a number only when a statement about them carries one. What counts for a topic is always something Gemma heard or read. When no statement gets a label at all, the reply is treated as unusable and there is no score, so that a failed reply does not pass for a pitch that says nothing. Gemma then writes the insights and the feedback from the rated findings.

Two things led here. Gemma did not apply numeric limits reliably when asked to: it rated 5.7 filler words a minute as "5 or fewer", and a pitch with two expected topics missing as complete. And a level given from an impression is the less steady kind of judgement: CheckEval (Lee et al., EMNLP 2025, [arXiv:2403.18771](https://arxiv.org/abs/2403.18771)) reports that splitting a criterion into yes-or-no questions raised agreement between evaluator models and lowered the variance of their scores. In the first version Gemma gave three levels itself (structure of the pitch, structure and visual consistency of the deck); those criteria are now counts.

### Runs with the real model

**What the first run with the real model showed.** On 11 October 2026 the combined check ran on a Kaggle T4 with the test recording and the test deck, in 5 minutes 18 seconds. Gemma heard and read the statements as before. The checklist was then asked the other way round, "for each topic, give the numbers of the statements that say it", and it came back empty for all nine items, for the pitch and for the deck. With every topic counted as missing the pitch scored 45 and the deck 40, which is wrong: both say most of the topics. That prompt showed the shape of the reply with empty lists, and the reply was not kept, so whether Gemma gave the shape back is a guess.

The question is now a label for each statement, the kind Gemma answered sensibly in the first version when it named the topics of each segment. The shape in the prompt cannot pass for an answer, and every statement comes back in the result with its label (`labelled` in the summary), so a wrong label can be seen.

**The second run**, the same day and on the same files, in 5 minutes 11 seconds. Gemma labelled every statement.

- Pitch, 20 statements: the labels hold up. It found the problem, the product, the customers, the business model and the ask, and found no traction, no team and no unique insight, which is what the test pitch says. Two labels are arguable (a sentence about what organizers fix today got "solution"; "Who buys it?" got "market" though it is a question). The pitch scored 60: content 40, delivery 90.
- Deck, 31 lines: two labels were wrong in a way that cost points. The four lines of the slide about how organizers work today got "solution", the label of the slides around it, so the problem counted as missing. And the tagline on the title slide got "solution" and no line got "what it does", so the title slide rated 0. The deck scored 55.
- Feedback: with the signal measurements in its prompt, Gemma advised fewer filler words at one a minute, which is the top level, and a higher "voiced share of frames".

What changed after it: the labelling prompt carries a worked example from another company, with a statement about how things are today labelled as the problem. "What it does" and "solution" are read together: the first statement about the product is where a pitch or a deck says what it does, and the product counts as explained when there is more than that one. A slide title of one or two words is not offered for labelling. And the feedback prompt gets the weakest criteria as numbered findings and no measurements; an item that answers no finding is dropped, and each item on the page names the criterion it is about.

**The third run**, again the same files, in 5 minutes 11 seconds.

- Pitch: the same labels as in the second run and the same score, 60. The feedback was three items, one for each finding, in order.
- Deck: the title slide was found. The slide about how organizers work today was mislabelled again, line by line: two lines "traction", two "solution". So the problem still counted as missing, and "Organizers review 50 decks in two days" counted as traction with a number. The deck scored 70, with a wrong reason on both sides.
- Deck feedback: asked for the number of the finding each item answers, Gemma numbered its six items one to six, and its advice on word count ended up under "Numbers".

What changed after it: a slide is labelled as a whole, from its title, its point in a sentence and its lines, with one label for a slide. A bullet such as "Organizers review 50 decks in two days" says too little alone; with the whole slide in view Gemma put the main topics of this deck on the right slides in the first version of the rubric. The statements of the speaker are still labelled one by one. On a slide a number is a figure, so that "two developers" on a team slide is not one. And feedback is tied to a finding by the finding's name, which can be checked, where a number could not.

**The fourth run**, again the same files, in 5 minutes 17 seconds.

- Pitch: the same labels as in the second and the third run and the same score, 60 (content 40, delivery 90).
- Deck: with one label for a slide, slides 3 to 8 came out right: solution, market, business model, unique insight, team, ask. Slides 1 and 2, the title slide and the slide about how organizers work today, came out as "none". So the problem counted as missing again, the title slide rated 2 of 4 because the first slide about the product was the third, and the deck scored 50 (content 30, design 65).
- The result could not tell why. A slide shows as "none" when Gemma wrote none, when it wrote a label that code cannot read, and when its reply left the slide out. A run of the deck alone, with the reply kept, showed that Gemma had written "none" for both.

What changed after it: each summary keeps Gemma's replies to the labelling prompt as it wrote them (`label_replies`). And the line for "none" and the advice under the labels are worded for a deck apart from a talk. The two slides have a title that names no topic ("PitchCheck", "Organizers review 50 decks in two days"), and "none" took any slide "that fits no line above". For a deck, "none" is now a slide that only closes the deck, and the advice says to go by the whole slide and not by its title, that a first slide with the name and a line on what the company makes is "what it does", and that a slide about how things are today is the problem even when it does not use the word. The price is that a slide which fits no topic, an agenda or a roadmap, is pushed towards the closest one. The prompt for a talk did not change: built from the statements of this run it is the same, character for character.

**What is not tested.** The wording for a deck written after the fourth run has not run with the real model, so whether it cures the two wrong labels is not known. Nothing has been tried on a real pitch or a real deck.

### Where the standards come from

Read on 11 October 2026. Each result shows, next to every criterion, the sentence it rests on and what level 4 takes.

| Source | What the rubrics take from it |
| --- | --- |
| Michael Seibel, [How to Pitch Your Company](https://www.ycombinator.com/library/4b-how-to-pitch-your-company) | The seven questions a pitch answers; "eliminate jargon, acronyms, marketing speak, and any ambiguous terms such as 'platform'" |
| Geoff Ralston, [A Guide to Demo Day Presentations](https://www.ycombinator.com/blog/guide-to-demo-day-pitches) | Say what you do first; the problem and the product; bottom-up numbers; speak slowly, pause, no monotone, project; one point per slide, few words, important text at the top |
| Aaron Harris, [How to build your seed round pitch deck](https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck) | The slides of a seed deck, from the title slide with a one-line description to the ask; "Make the numbers clear and meaningful" |
| Kevin Hale, [How to design a better pitch deck](https://www.ycombinator.com/library/4T-how-to-design-a-better-pitch-deck) | Legible, simple, obvious: large type, good contrast, one idea per slide |

Y Combinator gives almost no numbers, so the limits that turn a standard into levels are this team's choice, and the code says so next to each one. Three limits come from elsewhere: the filler word levels end at the two rates one study tested (Laske and DiGennaro Reed 2024, in English: 5 a minute did no harm, 12 did), the contrast limit is WCAG 2.2, and the smallest text is 24 pt on a standard slide, the minimum [Penn State's accessibility guidance](https://accessibility.psu.edu/legibility/fontsize) gives for slides projected to an audience. Visual consistency is not in Y Combinator's guides at all; it is kept from the first version of the rubric.

What changed in the limits: a slide is marked from 40 words (was 60) and from text under 24 pt (was 18 pt), a segment counts as fast from 5.0 syllables a second (was 5.5), filler words reach the top level at 2 a minute (was 5), and a pitch with fewer than 3 pauses a minute is marked. The shares of marked slides, or of marked time, that separate the levels are 10%, 25% and 50%; they were 15%, 35% and 60% for slides and 20%, 50% and 100% for time.

Plain language is a count of marketing and jargon words from a short fixed list (`BUZZWORD` in `services/analysis/app/rubric.py`), in English only. It marks "platform" and "AI-powered"; it does not recognise jargon that is not on the list.

## What Gemma did not hear

One test, on 11 October 2026, with a text-to-speech voice. The same 56 words were spoken at three rates: 124, 169 and 343 words a minute. Gemma 4 E2B got each clip through the per-segment prompt, once with the audio alone and once with the signal measurements in the prompt.

| Clip | Gemma's pace, audio alone | Gemma's pace, with measurements | Measured speaking rate |
| --- | --- | --- | --- |
| 124 words a minute | conversational | conversational | 3.49 syllables a second |
| 169 words a minute | conversational | conversational | 4.23 syllables a second |
| 343 words a minute | conversational | conversational | 7.05 syllables a second |

Gemma's description of the tone was nearly the same sentence for all three clips, and it listed the word "like" in "like tiny fonts" as a filler word every time. So pace is no longer asked of Gemma. It is measured from the signal: syllables are counted as voiced peaks in loudness (de Jong and Wempe 2009) and divided by the seconds of speaking. A segment under 2.7 syllables a second counts as slow and one over 5.0 as fast. Those limits are a convention: on a line through the three clips above they are about 75 and 215 words a minute for this voice, and they have not been checked on human voices. The fast limit is the tighter one because Y Combinator's advice is to speak slowly.

The test says nothing about tone: a synthetic voice at three speeds does not change its tone. Whether Gemma hears flat against lively delivery is still open, and it needs human recordings (see [Limitations](limitations.md)).

Pauses, pitch variation and loudness had been rated by Gemma from the sound and the measurements in its prompt. On the same steady synthetic voice it gave loudness level 3 in one run and level 2 in the next. Those three are now rated in code as well, from the measurements alone, with limits the team chose: a pause over 2 seconds is long, a segment whose pitch varies by under 2 semitones is even, a segment 6 dB quieter than the whole recording is quiet, and a segment whose loudness swings by over 9 dB is uneven. None of the four has a study behind it. What Gemma does for the pitch is hear the filler sounds and the statements, say which statements explain each expected topic, and write the insights and the feedback from the rated findings.

Only sounds that fill a pause (um, uh, er, hmm) are counted as filler words. Gemma also listed words such as "like" and "so" where they were part of the sentence, so words are left out of the count.

The rubrics rate what is said and what can be heard, seen or measured. They have no criterion for emotion, confidence, accent or pronunciation, and the results cards say so. Y Combinator's advice also covers things the product cannot see or hear in its input, such as facing the audience, standing still and practising; those are left out. Where each standard and each limit comes from is in "Where the standards come from" above, in the code, and next to every criterion on the results cards.

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
