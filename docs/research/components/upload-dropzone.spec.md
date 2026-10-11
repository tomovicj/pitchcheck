# UploadDropzone

Target: `src/components/upload-dropzone.tsx`.
Interaction model: click/file browsing, keyboard and file drag/drop.
Source CSS unavailable; values are specified adaptations.

Reusable client component used by both recording and deck.
Props: id: string; accept: string; title: string; hint: string;
file: File|null; onSelect(file: File): void; onRemove(): void;
disabled?: boolean; kind: "recording"|"deck".
Structure: relative drop area with full-size real native file input, decorative
icon, label, hint. Separate remove button outside input overlay when selected.
Area: min-height 178px, 1px dashed #cccec4, 16px radius; background #fafbf6.
Icon wrapper: 48px square, white, 12px radius, subtle shadow; Upload SVG.
Default title 14px/500; hint 12px #737570; selected filename wraps anywhere.
On hover/drag: border #919646, background #f4f7df, 180ms transition.
Keyboard focus-within outline 2px #858e37. Disabled cursor/proper native disabled.
Input reset on change enables selecting same file again. Multiple drop files
use first. Busy drop ignored; dragleave checks containment, no nested flicker.
Selected: FileVideo/AudioLines or FileText SVG and file size, remove SVG button
with aria-label. No nested buttons in label; keyboard upload accessible.
Mobile: same layout, smaller padding; long filenames never overflow.
Assets: lucide SVGs. Text is supplied via props; no per-state content beyond file.
