"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, PanelsTopLeft, ShieldCheck, Sparkles } from "lucide-react";
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
        <span className="checker-category"><span className="checker-icon"><PanelsTopLeft aria-hidden="true" /></span>Pitch deck</span>
        <span className="checker-step" aria-hidden="true">02</span>
      </div>
      <h3>Let your slides speak.</h3>
      <p className="checker-description">Your story, ready for a closer look.</p>
      <div className="checker-features" aria-label="Deck features"><span><Check aria-hidden="true" />PDF preview</span><span><Check aria-hidden="true" />25 MB max</span><span className="checker-feature-soon">Scoring soon</span></div>
      <UploadDropzone
        id="deck-file"
        accept="application/pdf,.pdf"
        title="Drop your deck here"
        hint="PDF presentation · up to 25 MB"
        file={selection?.file ?? null}
        onSelect={selectFile}
        onRemove={removeFile}
        disabled={disabled}
        kind="deck"
      />
      {error && <p className="checker-error" role="alert">{error}</p>}
      <div className="checker-actions">
        {selection ? (
          <a className="pill-button pill-secondary" href={selection.previewUrl} target="_blank" rel="noopener noreferrer">
            Preview PDF <ExternalLink aria-hidden="true" />
          </a>
        ) : <button type="button" className="pill-button pill-secondary" disabled>Preview PDF <ExternalLink aria-hidden="true" /></button>}
      </div>
      <div className="checker-bottomline"><span><ShieldCheck aria-hidden="true" />Browser-local preview</span><span><Sparkles aria-hidden="true" />Analysis coming soon</span></div>
    </article>
  );
}
