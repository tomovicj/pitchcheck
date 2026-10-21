# PitchHero

Target: `apps/web/src/components/pitch-hero.tsx`. Reference: `docs/design/inspiration.webp`.
Interaction model: static presentation with click-to-scroll CTAs.
Source CSS unavailable; values are specified adaptations.

Structure: section > eyebrow > h1 > subtitle > CTA row > product showcase.
Eyebrow: "A LITTLE PRACTICE. A BETTER PITCH." with small acid-yellow dot.
Title: "Your next pitch." / "Your best pitch."; 88px/1.05, weight 500,
-5px tracking; desktop top padding 56px; subtitle margin 26px.
Subtitle: "Find your rhythm. Sharpen your slides. Walk in ready."
CTA: black "Check your pitch" and outlined "Explore deck checker";
48px tall, 14px type, gap 12px, margin-top 30px; lucide SVG arrows.
Privacy notice below CTAs: compact "Privacy first" mint badge with a decorative
lucide ShieldCheck SVG and "Your files stay on the organizer's server."
One inline row on desktop; badge above a single line of reassurance on mobile.
No card or additional support paragraph; Gemma is credited in the showcase.
Showcase starts 54px after CTAs. Mobile title 50px, -2.7px tracking;
CTAs wrap, subtitle 16px; section top padding 38px.
Assets: ProductShowcase component. N/A per-state content.
Hover pills: 180ms background/color change. Reduced-motion respected.
