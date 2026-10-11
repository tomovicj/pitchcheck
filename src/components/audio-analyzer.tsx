"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, AudioLines, Info, Loader2 } from "lucide-react";

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
  // An analysis is running, this one or another: files and buttons are locked
  busy: boolean;
  // Progress of this card's own analysis
  status: AnalysisStatus | null;
  error?: string;
};

export function AudioAnalyzer({
  file, onSelect, onRemove, onAnalyze, timeLimit, onTimeLimitChange, busy, status, error,
}: AudioAnalyzerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
    setPreviewUrl(URL.createObjectURL(next));
    setInvalid(null);
    onSelect(next);
  }

  function removeFile() {
    if (busy) return;
    setPreviewUrl(null);
    setInvalid(null);
    onRemove();
  }

  const isVideo = !!file && (file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name));
  const message = invalid ?? error;

  return (
    <article id="pitch-video" className="checker-card recording-checker">
      <div className="checker-heading">
        <span className="checker-icon"><AudioLines aria-hidden="true" /></span>
        <span className="status-pill">READY TO CHECK</span>
      </div>
      <p className="checker-kicker">01 / THE DELIVERY</p>
      <h3>Pitch delivery checker.</h3>
      <p className="checker-description">Find your pace, hear your tone and make your next take more confident.</p>
      <UploadDropzone
        id="recording-file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.webm,.mkv,.avi"
        title="Drop your pitch recording here"
        hint="Video or audio · MP4, MOV, MP3, WAV & more"
        file={file}
        onSelect={selectFile}
        onRemove={removeFile}
        disabled={busy}
        kind="recording"
      />
      {file && previewUrl && (isVideo ? (
        <video controls src={previewUrl} className="media-preview" />
      ) : (
        <audio controls src={previewUrl} className="media-preview" />
      ))}
      <label className="checker-field" htmlFor="time-limit">
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
      </label>
      <div className="checker-actions">
        <button type="button" onClick={onAnalyze} disabled={!file || busy} className="pill-button">
          {status ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {status ? "Analyzing your pitch…" : "Analyze my pitch"}
          {!status && <ArrowUpRight aria-hidden="true" />}
        </button>
        <span>Feedback powered by Gemma</span>
      </div>
      <p className="checker-note"><Info aria-hidden="true" /><span>For video, the audio track is analyzed. Delivery matters.</span></p>
      {status && <AnalysisProgress status={status} />}
      {message && <p className="checker-error" role="alert">{message}</p>}
    </article>
  );
}
