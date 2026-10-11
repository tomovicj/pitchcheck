"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Info, PanelsTopLeft } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";

const MAX_DECK_SIZE = 25 * 1024 * 1024;

type SelectedDeck = {
  file: File;
  previewUrl: string;
};

export function DeckUploader({ disabled = false }: { disabled?: boolean }) {
  const [selection, setSelection] = useState<SelectedDeck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const validationId = useRef(0);

  useEffect(() => {
    const previewUrl = selection?.previewUrl;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [selection?.previewUrl]);

  useEffect(() => () => {
    validationId.current += 1;
  }, []);

  async function selectFile(file: File) {
    if (disabled) return;

    const currentValidation = ++validationId.current;
    setError(null);

    if (!/\.pdf$/i.test(file.name) || !["", "application/pdf", "application/x-pdf"].includes(file.type.toLowerCase())) {
      setError("Please choose a PDF presentation (.pdf).");
      return;
    }
    if (file.size === 0) {
      setError("This PDF is empty. Please choose a presentation with content.");
      return;
    }
    if (file.size > MAX_DECK_SIZE) {
      setError("This PDF is too large. Please choose a file of 25 MB or less.");
      return;
    }

    try {
      const header = new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer());
      if (currentValidation !== validationId.current) return;
      if (!header.includes("%PDF-")) {
        setError("This file does not appear to be a PDF. Please export your presentation as a PDF and try again.");
        return;
      }

      const preview = new Blob([file], { type: "application/pdf" });
      setSelection({ file, previewUrl: URL.createObjectURL(preview) });
    } catch {
      if (currentValidation === validationId.current) {
        setError("We couldn't read this PDF. Please choose the file again.");
      }
    }
  }

  function removeFile() {
    validationId.current += 1;
    setSelection(null);
    setError(null);
  }

  return (
    <article id="pitch-deck" className="checker-card deck-checker">
      <div className="checker-heading">
        <span className="checker-icon"><PanelsTopLeft aria-hidden="true" /></span>
        <span className="status-pill coming-soon">COMING SOON</span>
      </div>
      <p className="checker-kicker">02 / THE STORY</p>
      <h3>Pitch deck checker.</h3>
      <p className="checker-description">A clearer story starts with stronger slides. Add your presentation here.</p>
      <UploadDropzone
        id="deck-file"
        accept="application/pdf,.pdf"
        title="Drop your pitch deck here"
        hint="PDF presentation · up to 25 MB"
        file={selection?.file ?? null}
        onSelect={selectFile}
        onRemove={removeFile}
        disabled={disabled}
        kind="deck"
      />
      {error && <p className="checker-error" role="alert">{error}</p>}
      {selection && (
        <div className="checker-actions">
          <a className="pill-button pill-secondary" href={selection.previewUrl} target="_blank" rel="noopener noreferrer">
            Preview PDF <ExternalLink aria-hidden="true" />
          </a>
          <span>Stored in this browser only.</span>
        </div>
      )}
      {!selection && (
        <div className="checker-actions">
          <span className="deck-placeholder">Slide analysis coming soon</span>
          <span>Upload &amp; preview available</span>
        </div>
      )}
      <p className="checker-note">
        <Info aria-hidden="true" />
        <span>PDF upload and preview are ready. Slide scoring will be connected in the next step.</span>
      </p>
    </article>
  );
}
