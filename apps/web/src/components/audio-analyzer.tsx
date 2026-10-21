"use client";

import { useState } from "react";
import { ArrowUpRight, AudioLines, Check, Info, Loader2, Sparkles } from "lucide-react";

import { AnalysisProgress, type AnalysisStatus } from "@/components/analysis-progress";
import { UploadDropzone } from "@/components/upload-dropzone";

type AudioAnalyzerProps = {
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onAnalyze: () => void;
  // The event's limit for the pitch in minutes, as typed; empty when the event has none
  timeLimit: string;
  onTimeLimitChange: (minutes: string) => void;
  showTimeLimit: boolean;
  // An analysis is running, this one or another: files and buttons are locked
  busy: boolean;
  // Progress of this card's own analysis
  status: AnalysisStatus | null;
  error?: string;
};

export function AudioAnalyzer({
  file, onSelect, onRemove, onAnalyze, timeLimit, onTimeLimitChange, showTimeLimit, busy, status, error,
}: AudioAnalyzerProps) {
  const [invalid, setInvalid] = useState<string | null>(null);

  function selectFile(next: File) {
    if (busy) return;
    const mediaExtension = /\.(mp3|wav|m4a|aac|ogg|flac|mp4|mov|webm|mkv|avi)$/i;
    if (!(next.type.startsWith("audio/") || next.type.startsWith("video/") || (!next.type && mediaExtension.test(next.name)))) {
      setInvalid("Please choose an audio or video recording.");
      return;
    }
    if (next.size === 0) {
      setInvalid("This recording is empty. Please choose a file with content.");
      return;
    }
    setInvalid(null);
    onSelect(next);
  }

  function removeFile() {
    if (busy) return;
    setInvalid(null);
    onRemove();
  }

  const message = invalid ?? error;

  return (
    <article id="pitch-video" className="checker-card recording-checker">
      <div className="checker-heading">
        <span className="checker-category"><span className="checker-icon"><AudioLines aria-hidden="true" /></span>Pitch delivery</span>
        <span className="checker-step" aria-hidden="true">01</span>
      </div>
      <h3>Make yourself heard.</h3>
      <p className="checker-description">A fresh perspective on how you present.</p>
      <div className="checker-features" aria-label="Delivery analysis includes"><span><Check aria-hidden="true" />Delivery score</span><span><Check aria-hidden="true" />Insights</span><span><Check aria-hidden="true" />Next steps</span></div>
      <UploadDropzone
        id="recording-file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.webm,.mkv,.avi"
        title="Drop your recording here"
        hint="MP4, MOV, MP3, WAV & more"
        file={file}
        onSelect={selectFile}
        onRemove={removeFile}
        disabled={busy}
        kind="recording"
      />
      {showTimeLimit && <label className="checker-field" htmlFor="time-limit">
        <span>Time limit at your event</span>
        <input
          id="time-limit"
          type="number"
          inputMode="decimal"
          min="0.5"
          step="0.5"
          placeholder="3"
          value={timeLimit}
          onChange={(event) => onTimeLimitChange(event.target.value)}
          disabled={busy}
        />
        <span>minutes · optional</span>
      </label>}
      <div className="checker-actions">
        <button type="button" onClick={onAnalyze} disabled={!file || busy} className="pill-button">
          {status ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {status ? "Analyzing your pitch…" : "Analyze delivery"}
          {!status && <ArrowUpRight aria-hidden="true" />}
        </button>
      </div>
      <div className="checker-bottomline"><span><Sparkles aria-hidden="true" />Powered by Gemma</span><span><Info aria-hidden="true" />Audio-based feedback</span></div>
      {status && <AnalysisProgress status={status} />}
      {message && <p className="checker-error" role="alert">{message}</p>}
    </article>
  );
}
