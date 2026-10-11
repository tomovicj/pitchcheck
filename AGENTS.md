# PitchCheck

Product requirements and the current state of the build are in [README.md](README.md). The work queue is [TODO.md](TODO.md). Read both before changing the analysis pipeline.

Fixed requirements:

- Every score and every piece of feedback comes from a Gemma model. Do not add another AI model to the analysis path. `faster-whisper` and the wav2vec2 emotion classifier in `services/audio` predate this rule and are scheduled for removal.
- The pitch is analyzed from the audio signal itself, so that tone of voice and delivery count. A transcript is never the only input for judging delivery. Prompts and UI describe how the delivery sounds; they do not label the speaker's emotions or state of mind (working decision, 11 October 2026; see TODO.md).
- Input is a pitch video plus the slide deck. Output is a score for the slides, a score for the pitch, insights, and feedback for improvement.
- Scores rate the deck and the delivery, never the business idea.

Gemma takes audio only in clips of at most 30 seconds (16 kHz mono), and only in Gemma 3n and the E2B, E4B and 12B Unified variants of Gemma 4. Check the [audio documentation](https://ai.google.dev/gemma/docs/capabilities/audio) before assuming more.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
