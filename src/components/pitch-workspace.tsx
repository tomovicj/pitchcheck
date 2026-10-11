"use client";

import { useState } from "react";
import { AnalysisOverview } from "@/components/analysis-overview";
import type { AnalysisStatus } from "@/components/analysis-progress";
import { AudioAnalyzer } from "@/components/audio-analyzer";
import { CombinedPitchCheck } from "@/components/combined-pitch-check";
import { DeckUploader } from "@/components/deck-uploader";
import type { AudioAnalysis, DeckAnalysis, PitchCheck } from "@/lib/analysis";
import { type Results, showResults, useResults } from "@/lib/results-store";
import { runAnalysis } from "@/lib/run-analysis";

type JobKind = "pitch" | "deck" | "check";
type Job = AnalysisStatus & { kind: JobKind };

// An analysis service from before the rubric returns results this page cannot show
const OLDER_SERVICE = "The analysis service is an older version than this page. Update it and try again.";

export function PitchWorkspace() {
  const [recording, setRecording] = useState<File | null>(null);
  const [deck, setDeck] = useState<File | null>(null);
  // Minutes, as typed; with it the length of the recording is rated against the event's limit
  const [timeLimit, setTimeLimit] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [errors, setErrors] = useState<Partial<Record<JobKind, string>>>({});
  const results = useResults();
  const show = showResults;

  async function run<Result>(kind: JobKind, endpoint: string, body: FormData, onResult: (result: Result) => void) {
    setJob({ kind, stage: "uploading", progress: 0 });
    setErrors({});
    try {
      onResult(await runAnalysis<Result>(endpoint, body, (stage, progress) => setJob({ kind, stage, progress })));
      // The results render below the cards, out of sight after a long wait
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setErrors({ [kind]: e instanceof Error ? e.message : "Analysis failed" });
    } finally {
      setJob(null);
    }
  }

  function withTimeLimit(body: FormData) {
    const minutes = Number(timeLimit);
    if (minutes > 0) body.append("time_limit_s", String(minutes * 60));
    return body;
  }

  function analyzePitch() {
    if (!recording) return;
    const body = withTimeLimit(new FormData());
    body.append("file", recording);
    run<AudioAnalysis>("pitch", "/api/analyze", body, (pitch) => {
      if (!pitch.filler_words) throw new Error(OLDER_SERVICE);
      show({ pitch, slides: results.slides });
    });
  }

  function analyzeDeck() {
    if (!deck) return;
    const body = new FormData();
    body.append("file", deck);
    run<DeckAnalysis>("deck", "/api/deck", body, (slides) => show({ pitch: results.pitch, slides }));
  }

  function checkBoth() {
    if (!recording || !deck) return;
    const body = withTimeLimit(new FormData());
    body.append("recording", recording);
    body.append("deck", deck);
    run<PitchCheck>("check", "/api/check", body, (check) => {
      if (!check.pitch?.filler_words) throw new Error(OLDER_SERVICE);
      show({ pitch: check.pitch, slides: check.deck, alignment: check.alignment });
    });
  }

  // A saved result of a real run, for showing the results without waiting for an analysis
  async function showSample() {
    const sample: PitchCheck | null = await fetch("/sample-check.json")
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    if (!sample) return setErrors({ check: "The sample result could not be loaded." });
    setErrors({});
    show({ pitch: sample.pitch, slides: sample.deck, alignment: sample.alignment, sample: true });
    requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const { pitch, slides } = results;
  // A new file makes its own result stale, and with it the comparison and any sample on show
  const drop = (part: "pitch" | "slides"): Results =>
    results.sample ? { pitch: null, slides: null } : part === "pitch" ? { pitch: null, slides } : { pitch, slides: null };
  const busy = !!job;
  const statusOf = (kind: JobKind) => (job?.kind === kind ? job : null);
  const missing = !recording && !deck ? "a recording and a PDF deck" : !recording ? "a recording" : !deck ? "a PDF deck" : null;

  return (
    <>
      <div className="checker-grid">
        <AudioAnalyzer
          file={recording}
          onSelect={(file) => {
            setRecording(file);
            setErrors({});
            show(drop("pitch"));
          }}
          onRemove={() => {
            setRecording(null);
            setErrors({});
            show(drop("pitch"));
          }}
          onAnalyze={analyzePitch}
          timeLimit={timeLimit}
          onTimeLimitChange={setTimeLimit}
          showTimeLimit={!pitch}
          busy={busy}
          status={statusOf("pitch")}
          error={errors.pitch}
        />
        <DeckUploader
          file={deck}
          onSelect={(file) => {
            setDeck(file);
            setErrors({});
            show(drop("slides"));
          }}
          onRemove={() => {
            setDeck(null);
            setErrors({});
            show(drop("slides"));
          }}
          onAnalyze={analyzeDeck}
          busy={busy}
          status={statusOf("deck")}
          error={errors.deck}
        />
      </div>
      <CombinedPitchCheck
        missing={missing}
        onRun={checkBoth}
        busy={busy}
        status={statusOf("check")}
        error={errors.check}
      />
      <p className="sample-link">
        No files at hand?{" "}
        <button type="button" onClick={showSample} disabled={busy}>
          See a sample result
        </button>
      </p>
      {(pitch || slides) && (
        <AnalysisOverview results={results} />
      )}
    </>
  );
}
