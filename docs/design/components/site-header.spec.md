# SiteHeader

Target: `apps/web/src/components/site-header.tsx`. Reference: `docs/design/inspiration.webp`.
Interaction model: click-driven mobile menu and same-page anchor navigation.
Source CSS unavailable; values are specified adaptations.

Structure: header > home logo link + nav + CTA + mobile menu toggle.
Desktop: 1200px container, 96px height; logo 164px wide; nav gap 32px;
14px nav type. Black 48px pill CTA: "Check your pitch" with lucide ArrowUpRight.
Asset: `/brand/pitchcheck.png`, native aspect ratio 1210/340, multiply blend.
Nav: "Pitch checker", "Deck checker", "How it works", "FAQ".
Hover: foreground opacity 1 to .65 over 180ms. SVG icons aria-hidden.
Mobile under 960px: hide desktop nav, show accessible menu toggle; reveal
nav in a bordered panel, close on link click or Escape. At 640px logo 138px.
No per-state content beyond opened nav. Main logo label: "PitchCheck home".
