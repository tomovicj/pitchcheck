# HowItWorks

Target: `apps/web/src/components/how-it-works.tsx`. Server-rendered section with an upload anchor CTA.

An inset warm olive panel with 32px corners and 42px desktop padding. Heading
"Small steps." / "Stronger pitches." uses 54px type and an olive second line.
The "Start your first check" link scrolls to the recording uploader.

Three ordered cards, 20px gaps, 22px corners, short descriptions and step numbers:

- 01 Upload / "Bring your pitch.": two overlapping recording and PDF file cards.
- 02 Discover / "Find your focus.": Gemma listening preview with a colored waveform.
- 03 Refine / "Come back stronger.": feedback and next-take chips around a repeat loop.

Illustrations are decorative HTML/CSS with lucide SVG icons and aria-hidden.
No fabricated scores or model results. PDF copy describes preview only.
SVG ArrowRight connectors link the cards on desktop. Hover treatments straighten
the file/listening illustrations and turn the repeat icon; reduced motion respected.

Under 960px, cards stack with illustrations beside their text. Under 640px, cards
become vertical, with compact panel padding and a responsive 30–44px heading.
The small closing line reads "A simple loop. A little more confidence."
