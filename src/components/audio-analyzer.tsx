"use client";

import { useState } from "react";
import { FileAudio, Loader2, Upload } from "lucide-react";

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
import type { AudioAnalysis } from "@/lib/analysis";

// Rough guides for spoken presentations, not hard rules
function paceLabel(wpm: number) {
  if (wpm < 110) return "Slow";
  if (wpm > 170) return "Fast";
  return "Conversational";
}

function variationLabel(semitones: number) {
  if (semitones < 2) return "Monotone";
  if (semitones > 4) return "Expressive";
  return "Moderate";
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AudioAnalysis | null>(null);

  function selectFile(next: File | undefined) {
    if (!next) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(next);
    setAudioUrl(URL.createObjectURL(next));
    setResult(null);
    setError(null);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/analyze", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload a recording</CardTitle>
          <CardDescription>
            MP3, WAV, M4A, OGG or any other audio format. Everything is analyzed locally.
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
                <FileAudio className="text-muted-foreground size-8" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground text-xs">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · click or drop to replace
                </span>
              </>
            ) : (
              <>
                <Upload className="text-muted-foreground size-8" />
                <span className="font-medium">Drop an audio file here or click to browse</span>
              </>
            )}
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => selectFile(e.target.files?.[0])}
            />
          </label>

          {audioUrl && <audio controls src={audioUrl} className="w-full" />}

          <Button onClick={analyze} disabled={!file || loading} className="self-start">
            {loading && <Loader2 className="animate-spin" />}
            {loading ? "Analyzing…" : "Analyze"}
          </Button>
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
  const { speech, prosody, emotion } = result;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Cadence</CardTitle>
          <CardDescription>{formatTime(result.duration_s)} of audio</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {speech.words_per_minute != null ? (
            <>
              <Stat
                label="Words per minute"
                value={speech.words_per_minute.toFixed(0)}
                hint={paceLabel(speech.words_per_minute)}
              />
              <Stat
                label="Speaking rate"
                value={speech.articulation_rate_wpm?.toFixed(0) ?? "–"}
                hint="wpm, excluding pauses"
              />
              <Stat
                label="Pauses"
                value={String(speech.pause_count)}
                hint={`${speech.total_pause_s}s total · longest ${speech.longest_pause_s}s`}
              />
              <Stat
                label="Filler words"
                value={String(speech.filler_count)}
                hint={speech.fillers?.length ? speech.fillers.join(", ") : "none detected"}
              />
            </>
          ) : (
            <p className="text-muted-foreground col-span-2 text-sm">No speech detected.</p>
          )}
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
          <CardTitle>Emotion</CardTitle>
          <CardDescription>
            Average over the recording, then per {emotion.timeline[0]?.end_s ?? 5}s window. The
            model tends to read high energy as &quot;angry&quot;, so treat it as a rough signal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            {Object.entries(emotion.overall).map(([label, score]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-16 text-sm capitalize">{label}</span>
                <Progress value={score * 100} className="flex-1" />
                <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">
                  {Math.round(score * 100)}%
                </span>
              </div>
            ))}
          </div>
          {emotion.timeline.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {emotion.timeline.map((w) => (
                <Badge key={w.start_s} variant="outline" className="capitalize">
                  {formatTime(w.start_s)} {w.label}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
          <CardDescription>
            {speech.word_count} words · language: {speech.language}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="leading-7">{speech.transcript || "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
