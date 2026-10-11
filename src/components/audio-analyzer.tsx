"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, AudioLines, Check, Info, Loader2, Sparkles } from "lucide-react";
import { AnalysisResults } from "@/components/analysis-results";
import { UploadDropzone } from "@/components/upload-dropzone";

import { Progress } from "@/components/ui/progress";
import type { AnalysisEvent, AnalysisStage, AudioAnalysis } from "@/lib/analysis";

const STAGE_LABELS: Record<AnalysisStage | "uploading", string> = {
  uploading: "Preparing your recording",
  measuring: "Finding the rhythm of your pitch",
  listening: "Gemma is listening to your pitch",
  scoring: "Putting your feedback together",
};

type Status = { stage: AnalysisStage | "uploading"; progress: number };

async function* readEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as AnalysisEvent;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield JSON.parse(buffer) as AnalysisEvent;
  } finally {
    reader.releaseLock();
  }
}

export function AudioAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestInFlight = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AudioAnalysis | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(next: File) {
    if (status || requestInFlight.current) return;
    const mediaExtension = /\.(mp3|wav|m4a|aac|ogg|flac|mp4|mov|webm|mkv|avi)$/i;
    if (!(next.type.startsWith("audio/") || next.type.startsWith("video/") || (!next.type && mediaExtension.test(next.name)))) {
      setError("Please choose an audio or video recording.");
      return;
    }
    if (next.size === 0) {
      setError("This recording is empty. Please choose a file with content.");
      return;
    }
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setResult(null);
    setError(null);
  }

  function removeFile() {
    if (status || requestInFlight.current) return;
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  }

  const isVideo = !!file && (file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name));

  async function analyze() {
    if (!file || requestInFlight.current) return;
    requestInFlight.current = true;
    setStatus({ stage: "uploading", progress: 0 });
    setError(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body }).catch(() => {
        throw new Error("Could not reach PitchCheck. Check your connection and try again.");
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Analysis failed");
      }

      for await (const event of readEvents(res.body)) {
        if (event.type === "progress") setStatus({ stage: event.stage, progress: event.progress });
        else if (event.type === "error") throw new Error(event.message);
        else {
          setResult(event.data);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const heading = document.getElementById("results-title");
              heading?.focus({ preventScroll: true });
              heading?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
            });
          });
          return;
        }
      }
      throw new Error("Analysis ended without a result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      requestInFlight.current = false;
      setStatus(null);
    }
  }

  function seekTo(seconds: number) {
    const media = videoRef.current ?? audioRef.current;
    if (!media) return;
    const end = Number.isFinite(media.duration) ? media.duration : result?.duration_s ?? seconds;
    media.currentTime = Math.max(0, Math.min(seconds, end));
    media.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
    void media.play().catch(() => {});
  }

  return (
    <div className="recording-column min-w-0">
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
          disabled={!!status}
          kind="recording"
        />
        {previewUrl && (isVideo ? (
          <video ref={videoRef} controls src={previewUrl} className="media-preview" />
        ) : (
          <audio ref={audioRef} controls src={previewUrl} className="media-preview" />
        ))}
        <div className="checker-actions">
          <button type="button" onClick={analyze} disabled={!file || !!status} className="pill-button">
            {status ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {status ? "Analyzing your pitch…" : "Analyze delivery"}
            {!status && <ArrowUpRight aria-hidden="true" />}
          </button>
        </div>
        <div className="checker-bottomline"><span><Sparkles aria-hidden="true" />Powered by Gemma</span><span><Info aria-hidden="true" />Audio-based feedback</span></div>
        {status && (
          <div className="analysis-status" role="status" aria-live="polite">
            <div className="analysis-status-label"><span>{STAGE_LABELS[status.stage]}…</span><span>{Math.round(status.progress * 100)}%</span></div>
            <Progress value={status.progress * 100} />
            <ol className="analysis-stage-steps" role="list">{["Prepare", "Listen", "Score"].map((label, index) => {
              const current = status.stage === "scoring" ? 2 : status.stage === "listening" ? 1 : 0;
              return <li key={label} className={index === current ? "is-current" : index < current ? "is-complete" : ""} aria-current={index === current ? "step" : undefined}>{index < current ? <Check aria-hidden="true" /> : <span className="analysis-stage-dot" aria-hidden="true" />}{label}</li>;
            })}</ol>
          </div>
        )}
        {error && <p className="checker-error" role="alert">{error}</p>}
      </article>
      <AnalysisResults result={result} fileName={file?.name} busy={!!status} onSeek={seekTo} />
    </div>
  );
}
