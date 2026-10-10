"use client";

import { useState } from "react";
import { FileAudio, FileVideo, Loader2, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AnalysisEvent, AnalysisStage, AudioAnalysis } from "@/lib/analysis";

// Rough guide for spoken presentations, not a hard rule
function variationLabel(semitones: number) {
  if (semitones < 2) return "Monotone";
  if (semitones > 4) return "Expressive";
  return "Moderate";
}

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
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AudioAnalysis | null>(null);

  function selectFile(next: File | undefined) {
    if (!next) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setResult(null);
    setError(null);
  }

  const isVideo = file?.type.startsWith("video/") ?? false;

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
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload a recording</CardTitle>
          <CardDescription>
            Audio (MP3, WAV, M4A…) or video (MP4, MOV, WebM…). For video, only the audio track is
            analyzed. Everything runs locally.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              selectFile(e.dataTransfer.files[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragging ? "border-primary bg-muted" : "border-border hover:bg-muted/50"
            }`}
          >
            {file ? (
              <>
                {isVideo ? (
                  <FileVideo className="text-muted-foreground size-8" />
                ) : (
                  <FileAudio className="text-muted-foreground size-8" />
                )}
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground text-xs">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · click or drop to replace
                </span>
              </>
            ) : (
              <>
                <Upload className="text-muted-foreground size-8" />
                <span className="font-medium">Drop an audio or video file here or click to browse</span>
              </>
            )}
            <input
              type="file"
              accept="audio/*,video/*"
              className="sr-only"
              onChange={(e) => selectFile(e.target.files?.[0])}
            />
          </label>

          {previewUrl &&
            (isVideo ? (
              <video controls src={previewUrl} className="max-h-96 w-full rounded-lg bg-black" />
            ) : (
              <audio controls src={previewUrl} className="w-full" />
            ))}

          <Button onClick={analyze} disabled={!file || !!status} className="self-start">
            {status && <Loader2 className="animate-spin" />}
            {status ? "Analyzing…" : "Analyze"}
          </Button>

          {status && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span>{STAGE_LABELS[status.stage]}…</span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.round(status.progress * 100)}%
                </span>
              </div>
              <Progress value={status.progress * 100} />
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && <Results result={result} />}
    </div>
  );
}

function Results({ result }: { result: AudioAnalysis }) {
  const { prosody, pauses, segments, summary } = result;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2">
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
                      <div className="flex items-center gap-3">
                        <span className="w-40 shrink-0 text-sm">{c.name}</span>
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
                hint={variationLabel(prosody.pitch_std_semitones)}
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

      <Card className="md:col-span-2">
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
