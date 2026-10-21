"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ExternalLink, Info, Loader2, PanelsTopLeft, Sparkles } from "lucide-react";

import { AnalysisProgress, type AnalysisStatus } from "@/components/analysis-progress";
import { UploadDropzone } from "@/components/upload-dropzone";

const MAX_DECK_SIZE = 25 * 1024 * 1024;

type DeckUploaderProps = {
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onAnalyze: () => void;
  // An analysis is running, this one or another: files and buttons are locked
  busy: boolean;
  // Progress of this card's own analysis
  status: AnalysisStatus | null;
  error?: string;
};

export function DeckUploader({ file, onSelect, onRemove, onAnalyze, busy, status, error }: DeckUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const validationId = useRef(0);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => () => {
    validationId.current += 1;
  }, []);

  async function selectFile(next: File) {
    if (busy) return;

    const currentValidation = ++validationId.current;
    setInvalid(null);

    if (!/\.pdf$/i.test(next.name) || !["", "application/pdf", "application/x-pdf"].includes(next.type.toLowerCase())) {
      setInvalid("Please choose a PDF presentation (.pdf).");
      return;
    }
    if (next.size === 0) {
      setInvalid("This PDF is empty. Please choose a presentation with content.");
      return;
    }
    if (next.size > MAX_DECK_SIZE) {
      setInvalid("This PDF is too large. Please choose a file of 25 MB or less.");
      return;
    }

    try {
      const header = new TextDecoder().decode(await next.slice(0, 1024).arrayBuffer());
      if (currentValidation !== validationId.current) return;
      if (!header.includes("%PDF-")) {
        setInvalid("This file does not appear to be a PDF. Please export your presentation as a PDF and try again.");
        return;
      }

      setPreviewUrl(URL.createObjectURL(new Blob([next], { type: "application/pdf" })));
      onSelect(next);
    } catch {
      if (currentValidation === validationId.current) {
        setInvalid("We couldn't read this PDF. Please choose the file again.");
      }
    }
  }

  function removeFile() {
    if (busy) return;
    validationId.current += 1;
    setPreviewUrl(null);
    setInvalid(null);
    onRemove();
  }

  const message = invalid ?? error;

  return (
    <article id="pitch-deck" className="checker-card deck-checker">
      <div className="checker-heading">
        <span className="checker-category"><span className="checker-icon"><PanelsTopLeft aria-hidden="true" /></span>Pitch deck</span>
        <span className="checker-step" aria-hidden="true">02</span>
      </div>
      <h3>Let your slides speak.</h3>
      <p className="checker-description">Your story, ready for a closer look.</p>
      <div className="checker-features" aria-label="Deck analysis includes"><span><Check aria-hidden="true" />Slide score</span><span><Check aria-hidden="true" />Slide-by-slide notes</span><span><Check aria-hidden="true" />PDF up to 25 MB</span></div>
      <UploadDropzone
        id="deck-file"
        accept="application/pdf,.pdf"
        title="Drop your deck here"
        hint="PDF presentation · up to 25 MB"
        file={file}
        onSelect={selectFile}
        onRemove={removeFile}
        disabled={busy}
        kind="deck"
      />
      <div className="checker-actions">
        <button type="button" onClick={onAnalyze} disabled={!file || busy} className="pill-button">
          {status ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {status ? "Reading your slides…" : "Check my slides"}
          {!status && <ArrowUpRight aria-hidden="true" />}
        </button>
        {file && previewUrl ? (
          <a className="pill-button pill-secondary" href={previewUrl} target="_blank" rel="noopener noreferrer">
            Preview PDF <ExternalLink aria-hidden="true" />
          </a>
        ) : <button type="button" className="pill-button pill-secondary" disabled>Preview PDF <ExternalLink aria-hidden="true" /></button>}
      </div>
      <div className="checker-bottomline"><span><Sparkles aria-hidden="true" />Gemma reads every slide</span><span><Info aria-hidden="true" />Text size and contrast measured</span></div>
      {status && <AnalysisProgress status={status} />}
      {message && <p className="checker-error" role="alert">{message}</p>}
    </article>
  );
}
