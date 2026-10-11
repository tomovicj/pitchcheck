"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { AlignmentResults } from "@/components/alignment-results";
import type { AnalysisStatus } from "@/components/analysis-progress";
import { AudioAnalyzer } from "@/components/audio-analyzer";
import { CombinedPitchCheck } from "@/components/combined-pitch-check";
import { DeckResults } from "@/components/deck-results";
import { DeckUploader } from "@/components/deck-uploader";
import { PitchResults } from "@/components/pitch-results";
import { VerdictCard } from "@/components/verdict-card";
import type { AudioAnalysis, DeckAnalysis, PitchCheck } from "@/lib/analysis";
import { showResults, useResults } from "@/lib/results-store";
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

  const { pitch, slides, alignment } = results;
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
            show({ pitch: null, slides });
          }}
          onRemove={() => {
            setRecording(null);
            setErrors({});
            show({ pitch: null, slides });
          }}
          onAnalyze={analyzePitch}
          timeLimit={timeLimit}
          onTimeLimitChange={setTimeLimit}
          busy={busy}
          status={statusOf("pitch")}
          error={errors.pitch}
        />
        <DeckUploader
          file={deck}
          onSelect={(file) => {
            setDeck(file);
            setErrors({});
            show({ pitch, slides: null });
          }}
          onRemove={() => {
            setDeck(null);
            setErrors({});
            show({ pitch, slides: null });
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
      {(pitch || slides) && (
        <div className="analysis-results" id="results">
          <div className="results-intro">
            <Sparkles aria-hidden="true" className="size-5" />
            <h3>Your pitch, a little clearer.</h3>
          </div>
          {alignment !== undefined && (
            <div className="results-alignment">
              <AlignmentResults alignment={alignment} />
            </div>
          )}
          <div className={`results-grid${pitch && slides ? "" : " is-single"}`}>
            {pitch && <PitchResults result={pitch} />}
            {slides && <DeckResults result={slides} />}
          </div>
          {/* Only after a combined check: the verdict covers both files of one run. An older service sends no fingerprints. */}
          {alignment !== undefined && pitch?.file && slides?.file && (
            <div className="results-verdict">
              <VerdictCard check={{ pitch, deck: slides, alignment }} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
