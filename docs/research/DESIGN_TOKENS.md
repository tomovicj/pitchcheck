# PitchCheck reference adaptation

Source: `FRONT/inspo.webp` (2048 × 1536 raster), inspected locally and in Chrome.
Brand asset: `FRONT/PITCHCHECK.png`, preserved at `public/brand/pitchcheck.png`.

The user requested the reference's colors, spacing and typography adapted to
PitchCheck, rather than the reference's product or content. There is no source
URL or DOM. Source computed CSS, exact font identity, responsive layouts and
animations cannot be recovered from a screenshot. Values below are deliberate
implementation choices based on the visible reference, not extracted CSS.

## Foundation

- Canvas: warm white `#fdfdfb`; primary text: `#191918`.
- Secondary text: `#737570`; borders: `#e6e7e1`.
- Accent palette: acid yellow `#e9ef45`, mint `#c6dfb9`, sky `#c9deeb`.
- Main content: 1200px maximum width, 48px desktop outer gutters.
- Typography: existing Geist variable sans; Geist Mono for small technical labels.
- Desktop hero: 88px, weight 500, line height 1.05, tracking -5px.
- Section headings: 48px, weight 500, line height 1.1, tracking -2px.
- Body: 16px, line height 1.6; eyebrow: 11px uppercase, tracking 1.6px.
- Buttons: black or white outlined pills, 48–52px tall, 14px text.
- Large showcase: 28px radius, soft yellow/mint/sky layered gradient.
- Upload cards: 24px radius; drop zones: 16px radius, dashed border.
- Layout breakpoints: 960px and 640px; mobile outer gutters: 22px.
- All arrows and interface icons use the existing lucide-react SVG system.

No source assets are downloaded from an unrelated website. No mock scores or
model feedback are presented as analysis results. The hero illustration is a
conceptual product preview. PDF selection and preview are frontend only.
