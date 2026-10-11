"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, AudioLines, Info, Loader2 } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AnalysisEvent, AnalysisStage, AudioAnalysis } from "@/lib/analysis";

const STAGE_LABELS: Record<AnalysisStage | "uploading", string> = {
  uploading: "Uploading and extracting audio",
  measuring: "Measuring pitch, loudness and pauses",
  listening: "Gemma is listening to each segment",
  scoring: "Scoring the pitch",
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

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

export function AudioAnalyzer() {
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
    if (status) return;
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
    if (status) return;
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  }

  const isVideo = !!file && (file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name));

  async function analyze() {
    if (!file) return;
    setStatus({ stage: "uploading", progress: 0 });
    setError(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Analysis failed");
      }

      for await (const event of readEvents(res.body)) {
        if (event.type === "progress") setStatus({ stage: event.stage, progress: event.progress });
        else if (event.type === "error") throw new Error(event.message);
        else return setResult(event.data);
      }
      throw new Error("Analysis ended without a result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setStatus(null);
    }
  }

  return (
    <div className="recording-column min-w-0">
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
          disabled={!!status}
          kind="recording"
        />
        {previewUrl && (isVideo ? (
          <video controls src={previewUrl} className="media-preview" />
        ) : (
          <audio controls src={previewUrl} className="media-preview" />
        ))}
        <div className="checker-actions">
          <button type="button" onClick={analyze} disabled={!file || !!status} className="pill-button">
            {status ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {status ? "Analyzing your pitch…" : "Analyze my pitch"}
            {!status && <ArrowUpRight aria-hidden="true" />}
          </button>
          <span>Feedback powered by Gemma</span>
        </div>
        <p className="checker-note"><Info aria-hidden="true" /><span>For video, the audio track is analyzed. Delivery matters.</span></p>
        {status && (
          <div className="analysis-status" role="status" aria-live="polite">
            <div className="analysis-status-label"><span>{STAGE_LABELS[status.stage]}…</span><span>{Math.round(status.progress * 100)}%</span></div>
            <Progress value={status.progress * 100} />
          </div>
        )}
        {error && <p className="checker-error" role="alert">{error}</p>}
      </article>
      {result && (
        <div className="analysis-results">
          <div className="results-intro"><AudioLines aria-hidden="true" className="size-5" /><h3>Your pitch, a little clearer.</h3></div>
          <Results result={result} />
        </div>
      )}
    </div>
  );
}

function Results({ result }: { result: AudioAnalysis }) {
  const { prosody, pauses, segments, summary } = result;

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Pitch score</CardTitle>
          <CardDescription>
            Scored by {result.model} from the audio. Scores rate the delivery, not the business idea.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {summary?.pitch_score != null ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold tabular-nums">
                  {Math.round(summary.pitch_score)}
                </span>
                <span className="text-muted-foreground">/ 100</span>
              </div>
              {!!summary.criteria?.length && (
                <div className="flex flex-col gap-3">
                  {summary.criteria.map((c) => (
                    <div key={c.name} className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="w-full text-sm sm:w-32 sm:shrink-0">{c.name}</span>
                        <Progress value={c.score} className="flex-1" />
                        <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">
                          {Math.round(c.score)}
                        </span>
                      </div>
                      {c.reason && <p className="text-muted-foreground text-xs">{c.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
              {!!summary.insights?.length && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Insights</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                    {summary.insights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!summary.feedback?.length && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">What to improve</h3>
                  <ul className="flex flex-col gap-2 text-sm">
                    {summary.feedback.map((item) => (
                      <li key={item.text} className="flex items-start gap-2">
                        {item.at_s != null && (
                          <Badge variant="outline" className="tabular-nums">
                            {formatTime(item.at_s)}
                          </Badge>
                        )}
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Gemma did not return a usable score for this recording.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cadence</CardTitle>
          <CardDescription>{formatTime(result.duration_s)} of audio</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Stat
            label="Pauses"
            value={String(pauses.pause_count)}
            hint={`${pauses.total_pause_s}s total`}
          />
          <Stat label="Longest pause" value={`${pauses.longest_pause_s}s`} hint={`mean ${pauses.mean_pause_s}s`} />
          <Stat
            label="Speaking time"
            value={`${Math.round(pauses.speaking_ratio * 100)}%`}
            hint="of the time between first and last word"
          />
          <Stat label="Segments" value={String(segments.length)} hint="up to 30s each" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tonality</CardTitle>
          <CardDescription>Pitch and loudness</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {prosody ? (
            <>
              <Stat
                label="Pitch variation"
                value={`${prosody.pitch_std_semitones} st`}
                hint="Measured pitch variation"
              />
              <Stat
                label="Pitch range"
                value={`${prosody.pitch_range_semitones} st`}
                hint={`${prosody.pitch_p5_hz.toFixed(0)}–${prosody.pitch_p95_hz.toFixed(0)} Hz`}
              />
              <Stat label="Median pitch" value={`${prosody.pitch_median_hz.toFixed(0)} Hz`} />
              <Stat
                label="Loudness variation"
                value={`${prosody.intensity_std_db} dB`}
                hint={`avg ${prosody.intensity_mean_db} dB`}
              />
            </>
          ) : (
            <p className="text-muted-foreground col-span-2 text-sm">No voiced speech detected.</p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>What Gemma heard in each segment</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {segments.map((segment) => {
            const o = segment.observations;
            return (
              <div key={segment.start_s} className="flex flex-col gap-1.5 border-b pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {formatTime(segment.start_s)}–{formatTime(segment.end_s)}
                  </span>
                  {o?.emotion && <Badge variant="outline" className="capitalize">{o.emotion}</Badge>}
                  {o?.energy && <Badge variant="outline">{o.energy} energy</Badge>}
                  {o?.pace && <Badge variant="outline">{o.pace} pace</Badge>}
                </div>
                {o ? (
                  <>
                    {o.tone && <p className="text-muted-foreground text-xs">Tone: {o.tone}</p>}
                    {o.observations && <p className="text-sm">{o.observations}</p>}
                    {!!o.filler_words?.length && (
                      <p className="text-muted-foreground text-xs">
                        Filler words: {o.filler_words.join(", ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Gemma&apos;s reply for this segment did not parse.</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
