# ProductShowcase

Target: `apps/web/src/components/product-showcase.tsx`, styles in `apps/web/src/components/product-showcase.css`.
Reference: `docs/design/inspiration.webp`.
Interaction model: static conceptual product illustration, decorative.
Source is raster; the supplied screenshot has no extractable computed styles.

Create a premium, balanced 1200px-wide, 420px-tall rounded panel inspired by
the reference's yellow/mint/sky gradient and floating white UI cards. This is
PitchCheck artwork, not a recreation of the reference's portrait/content.
Panel: border-radius 28px, overflow hidden, yellow left, pale mint center,
sky right. Add delicate oversized translucent oval/orb layers with CSS.
Top left label: "YOUR PITCH, IN FOCUS" in 10px monospace uppercase;
top right small rounded white badge: Sparkles SVG + "Powered by Gemma".
Main layout: floating left recording card (~340x235px) slightly rotated -4deg;
right deck card (~300x260px) rotated 5deg; connecting center sparkle/plus
SVG or small pill saying "One stronger pitch". Cards warm white, 18px
radius, fine border, soft shadow. Keep clean legible typography.
Recording card: "Pitch delivery", small "AUDIO + VIDEO" label, abstract black
waveform bars, a noninteractive play SVG circle, "Make every word count."
Deck card: "Pitch deck", small "PDF" label, stylized miniature slide with
black title "A clear story. A confident pitch." and yellow/mint chart blocks.
Do not invent a model score, findings, testimonials or functionality.
Bottom left small transparent pill: AudioLines SVG + "Delivery".
Bottom right pill: PanelsTopLeft SVG + "Slides".
All iconography via lucide-react SVG, decorative aria-hidden. No Unicode arrows.
Export a server-safe named ProductShowcase component; deterministic content,
no random generators, browser APIs or client state. Illustration has an
accessible label identifying it as a conceptual illustration.

Responsive: at 960px panel 380px high, smaller cards; at 640px panel 360px,
cards overlap lightly with appropriate z-index (left top, right lower), reduce
font sizes but keep card titles readable; hide optional bottom pills if needed.
No transforms may create horizontal document overflow.
Hover states: N/A (illustration is not interactive). N/A per-state content.
Assets: CSS gradients and shared lucide-react icons only; no downloads.
