# DeckUploader

Target: `src/components/deck-uploader.tsx`.
Interaction model: click/drop PDF selection, local preview, replace/remove.
Source CSS unavailable; values are specified adaptations.

Reuse UploadDropzone from `@/components/upload-dropzone` with these props:
id="deck-file", accept="application/pdf,.pdf", title="Drop your pitch deck here",
hint="PDF presentation · up to 25 MB", file, onSelect, onRemove, kind="deck".
Optional disabled prop supported by the shared component.

Wrapper article id="pitch-deck" className="checker-card deck-checker".
Header div class checker-heading: icon box (PanelsTopLeft SVG) and
small span class status-pill coming-soon: "COMING SOON".
Eyebrow p class checker-kicker: "02 / THE STORY".
h3: "Pitch deck checker". Description p class checker-description:
"A clearer story starts with stronger slides. Add your presentation here."
Then dropzone. Bottom p class checker-note: "PDF upload and preview are ready.
Slide scoring will be connected in the next step." Use info icon if helpful.

PDF validation: filename .pdf (case insensitive), MIME application/pdf or empty,
max 25MB, nonempty, actual file header contains %PDF- in first 1024 bytes.
Invalid file gives an accessible inline role=alert with explanatory text; keep
last valid selection. Do not call any backend and never produce scores.
Race protection for async validation if quickly replacing or removing files.
Generate a blob URL for valid file; revoke on replacement/unmount using effect.
Selected preview: link styled button secondary, target=_blank, rel=noopener
noreferrer, "Preview PDF" + ExternalLink SVG, text "Stored in this browser only".
Remove clears file/error and revokes URL, reselect same file works.
No iframe PDF embedding on mobile; a separate browser tab preview is sufficient.
Not an analysis button; avoid nonfunctional clickable "Analyze deck".

Desktop card CSS provided by root: padding 30px, radius 24px, border #e6e7e1,
white background, h3 26px, body 14px. At 960px cards stack, 640px padding 22px.
Icons via lucide-react SVG with aria-hidden; accessible labels for icon controls.
Imports: React hooks, lucide, shared UploadDropzone. Named export DeckUploader.
No other file edits; verify npx tsc --noEmit before finishing if dependencies ready.
