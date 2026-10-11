"use client";

import { useState } from "react";
import { AudioLines, FileText, Upload, X } from "lucide-react";

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
  const Icon = file ? (kind === "deck" ? FileText : AudioLines) : Upload;

  return (
    <div
      className={`upload-zone${dragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}`}
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
      <span className="upload-icon"><Icon aria-hidden="true" /></span>
      <span className="upload-title">{file?.name ?? title}</span>
      <span id={`${id}-hint`} className="upload-hint">
        {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Browse to replace` : hint}
      </span>
      {file && (
        <button type="button" className="upload-remove" onClick={onRemove} disabled={disabled} aria-label={`Remove ${file.name}`}>
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
