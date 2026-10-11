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
import type { Alignment, AudioAnalysis, DeckAnalysis, PitchCheck } from "@/lib/analysis";
import { runAnalysis } from "@/lib/run-analysis";

type JobKind = "pitch" | "deck" | "check";
type Job = AnalysisStatus & { kind: JobKind };

// An analysis service from before the rubric returns results this page cannot show
const OLDER_SERVICE = "The analysis service is an older version than this page. Update it and try again.";

export function PitchWorkspace() {
  const [recording, setRecording] = useState<File | null>(null);
  const [deck, setDeck] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [errors, setErrors] = useState<Partial<Record<JobKind, string>>>({});
  const [pitch, setPitch] = useState<AudioAnalysis | null>(null);
  const [slides, setSlides] = useState<DeckAnalysis | null>(null);
  // undefined until a combined check has run; null when it ran and the two could not be compared
  const [alignment, setAlignment] = useState<Alignment | null | undefined>(undefined);

  async function run<Result>(kind: JobKind, endpoint: string, body: FormData, onResult: (result: Result) => void) {
    setJob({ kind, stage: "uploading", progress: 0 });
    setErrors({});
    try {
      onResult(await runAnalysis<Result>(endpoint, body, (stage, progress) => setJob({ kind, stage, progress })));
    } catch (e) {
      setErrors({ [kind]: e instanceof Error ? e.message : "Analysis failed" });
    } finally {
      setJob(null);
    }
  }

  function analyzePitch() {
    if (!recording) return;
    const body = new FormData();
    body.append("file", recording);
    run<AudioAnalysis>("pitch", "/api/analyze", body, (result) => {
      if (!result.filler_words) throw new Error(OLDER_SERVICE);
      setPitch(result);
      setAlignment(undefined);
    });
  }

  function analyzeDeck() {
    if (!deck) return;
    const body = new FormData();
    body.append("file", deck);
    run<DeckAnalysis>("deck", "/api/deck", body, (result) => {
      setSlides(result);
      setAlignment(undefined);
    });
  }

  function checkBoth() {
    if (!recording || !deck) return;
    const body = new FormData();
    body.append("recording", recording);
    body.append("deck", deck);
    run<PitchCheck>("check", "/api/check", body, (result) => {
      setPitch(result.pitch);
      setSlides(result.deck);
      setAlignment(result.alignment);
    });
  }

  const busy = !!job;
  const statusOf = (kind: JobKind) => (job?.kind === kind ? job : null);
  const missing = !recording && !deck ? "a recording and a PDF deck" : !recording ? "a recording" : !deck ? "a PDF deck" : null;
  const hasResults = !!pitch || !!slides || alignment !== undefined;

  return (
    <>
      <div className="checker-grid">
        <AudioAnalyzer
          file={recording}
          onSelect={(file) => {
            setRecording(file);
            setPitch(null);
            setAlignment(undefined);
            setErrors({});
          }}
          onRemove={() => {
            setRecording(null);
            setPitch(null);
            setAlignment(undefined);
            setErrors({});
          }}
          onAnalyze={analyzePitch}
          busy={busy}
          status={statusOf("pitch")}
          error={errors.pitch}
        />
        <DeckUploader
          file={deck}
          onSelect={(file) => {
            setDeck(file);
            setSlides(null);
            setAlignment(undefined);
            setErrors({});
          }}
          onRemove={() => {
            setDeck(null);
            setSlides(null);
            setAlignment(undefined);
            setErrors({});
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
      {hasResults && (
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
        </div>
      )}
    </>
  );
}
