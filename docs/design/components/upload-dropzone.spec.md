# UploadDropzone

Targets: `apps/web/src/components/upload-dropzone.tsx`, `pitch-workspace.css`.
Shared client component; existing props and native input behavior are preserved.

Empty state: mint recording or sky deck accents, decorative layered file artwork,
short title, browse-files treatment and format hint. HTML/CSS artwork and lucide
SVGs are hidden from assistive technology. Selected: file-kind icon with a check,
filename, KB/MB size and labeled remove button.

Real native input covers the drop area; visible focus-within outline. Click,
keyboard and drag/drop selection are supported. First dropped file wins. Disabled
input/drop are ignored; dragleave checks containment. Reset input on change so
the same file can be chosen again. Separate remove button sits above the overlay
and has a filename-specific accessible label.

Minimum height 276px, 20px corners; 260px on mobile. Long filenames wrap. Hover/
drag adjust border and artwork gently; reduced motion disables transitions.
