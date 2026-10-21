# DeckUploader

Targets: `apps/web/src/components/deck-uploader.tsx`, `pitch-workspace.css`.
Sky card: PanelsTopLeft SVG, step 02, "Let your slides speak." heading, preview/size
features, scoring-soon label and illustrated UploadDropzone.

Click/drop selection stays in browser memory. Validate .pdf extension (case
insensitive), application/pdf, application/x-pdf or empty MIME, nonempty, at most
25 MB, and %PDF- within the first 1024 bytes. Invalid replacements preserve the
previous selection and show role=alert. Async validation races are guarded.

Full-width Preview PDF button is disabled until a valid file is selected. Preview
opens its blob URL in a new tab with noopener/noreferrer. Remove/replace work,
including choosing the same file again. Revoke URLs on replacement/unmount.
Optional disabled prop is preserved. No iframe on mobile.

PDF analysis is coming soon. No backend call or invented score. The results
workspace includes a matching deck card, clearly marked coming soon.
Both upload cards share proportions and responsive breakpoints. Decorative SVGs
are hidden from accessibility; interactive icon controls have text labels.
