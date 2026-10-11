# Interaction specification

Source is a static screenshot. Original behaviors are unknown. These are the
PitchCheck adaptation's specified behaviors, to verify in browser QA.

- Header and hero links scroll to the corresponding real section.
- Mobile menu opens on click, closes on navigation and Escape.
- Pill buttons change background over 180ms; focus has a visible outline.
- Both upload inputs support browsing, keyboard access and file drag and drop.
- Recording accepts audio/video, displays filename, size and media preview.
- Recording input is disabled during analysis; existing NDJSON progress and
  real results are retained. Backend errors appear in an accessible alert.
- Deck accepts PDF only, validates type, extension and PDF signature, shows
  filename and size, supports replacement/removal and opens a local preview.
- PDF files remain in browser memory; no nonexistent deck API is called.
- PDF analysis is clearly labeled coming soon; no fictional score is shown.
- FAQ details open/close through native summary controls; SVG plus/minus icons.
- Mobile: navigation collapses at 960px, cards stack at 960px, hero title and
  artwork simplify at 640px. No content may overflow at 390px.
- Reduced motion disables smooth scrolling and decorative transitions.
