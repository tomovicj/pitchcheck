# AudioAnalyzer adaptation

Target: existing `src/components/audio-analyzer.tsx`.
Model: existing upload/request/progress/results behavior, visual adaptation only.
Uses shared UploadDropzone, class checker-card, same proportions as DeckUploader.
Header AudioLines SVG, READY TO CHECK pill, 01 / THE DELIVERY label,
"Pitch delivery checker." heading, concise supporting copy.
Dropzone accepts audio/video. Reject non-media and empty files; retain valid
selection when invalid replacement is supplied. Blob media previews cleaned up
on replacement/removal/unmount. File replacement blocked while analysis runs.
Analyze button uses existing `/api/analyze` request and live progress. Existing
Gemma result cards preserved; static pitch-variation judgments removed in favor
of a measurement label. No new scores or AI model. Narrow cards wrap criteria.
Clear error alert when service fails. No mock results in the default interface.
Reference: `docs/design-references/inspiration.webp`; styling values specified
in globals.css because raster source provides no computed CSS.
Mobile remains single column. Assets: existing lucide SVG icon library.
