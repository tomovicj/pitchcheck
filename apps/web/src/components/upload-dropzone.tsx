"use client";

import { useState } from "react";
import { AudioLines, CircleCheck, FileText, Video, X } from "lucide-react";
import "./pitch-workspace.css";

const waveform = [18, 32, 45, 26, 62, 42, 80, 54, 94, 66, 42, 72, 52, 35, 58, 24, 38];

function UploadArtwork({ kind }: { kind: "recording" | "deck" }) {
  return <div className={`upload-artwork upload-artwork-${kind}`} aria-hidden="true">
    <span className="upload-art-orbit" />
    <div className="upload-art-sheet upload-art-sheet-back" />
    <div className="upload-art-sheet upload-art-sheet-front">
      {kind === "recording" ? <><span className="upload-art-symbol"><Video /></span><div className="upload-art-waveform">{waveform.map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div></> : <><span className="upload-art-symbol"><FileText /></span><div className="upload-art-slide-lines"><span /><span /></div><div className="upload-art-slide-chart"><span /><span /><span /></div></>}
    </div>
    <span className="upload-art-badge">{kind === "recording" ? <AudioLines /> : <FileText />}</span>
  </div>;
}

type UploadDropzoneProps = {
  id: string;
  accept: string;
  title: string;
  hint: string;
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  kind: "recording" | "deck";
};

export function UploadDropzone({ id, accept, title, hint, file, onSelect, onRemove, disabled = false, kind }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const Icon = kind === "deck" ? FileText : AudioLines;

  return (
    <div
      className={`upload-zone upload-zone-${kind}${file ? " has-file" : ""}${dragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled && event.dataTransfer.files[0]) onSelect(event.dataTransfer.files[0]);
      }}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-label={title}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          const next = event.target.files?.[0];
          event.target.value = "";
          if (next) onSelect(next);
        }}
      />
      {file ? <span className="upload-selected-icon"><Icon aria-hidden="true" /><CircleCheck aria-hidden="true" className="upload-selected-check" /></span> : <UploadArtwork kind={kind} />}
      <span className="upload-title">{file?.name ?? title}</span>
      {!file && <span className="upload-browse">or <span>browse files</span></span>}
      <span id={`${id}-hint`} className="upload-hint">
        {file ? `${file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(file.size / 1024))} KB`} · Browse to replace` : hint}
      </span>
      {file && (
        <button type="button" className="upload-remove" onClick={onRemove} disabled={disabled} aria-label={`Remove ${file.name}`}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
