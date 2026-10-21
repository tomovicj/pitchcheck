# PitchCheck

Monorepo: the Next.js app is in `apps/web` (pnpm workspace; run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` from the root), the FastAPI + Gemma service is in `services/analysis`.

Read [docs/how-it-works.md](docs/how-it-works.md) and [docs/limitations.md](docs/limitations.md) before changing the analysis pipeline. Next.js specifics are in [apps/web/AGENTS.md](apps/web/AGENTS.md).

Fixed requirements:

- Every judgement and every piece of feedback comes from a Gemma model. Do not add another AI model to the analysis path. Code gives a rubric level only where the level is a count, a share or a measurement of what Gemma heard or read or of the file. Since 11 October 2026 that is every level: Gemma says which statements explain each expected topic, and code counts. See "How the scores are built" in docs/how-it-works.md before adding a criterion or handing a level back to Gemma.
- The rubrics rest on Y Combinator's published advice to founders. A new criterion names the sentence it rests on and its source (`SOURCES` in `services/analysis/app/rubric.py`), or says that it is a convention.
- The pitch is analyzed from the audio signal itself, so that tone of voice and delivery count. A transcript is never the only input for judging delivery. Prompts and UI describe how the delivery sounds; they do not label the speaker's emotions or state of mind (working decision, 11 October 2026; see docs/limitations.md).
- Input is a pitch video plus the slide deck. Output is a score for the slides, a score for the pitch, insights, and feedback for improvement.
- Scores rate the deck and the delivery, never the business idea.

Gemma takes audio only in clips of at most 30 seconds (16 kHz mono), and only in Gemma 3n and the E2B, E4B and 12B Unified variants of Gemma 4. Check the [audio documentation](https://ai.google.dev/gemma/docs/capabilities/audio) before assuming more.
