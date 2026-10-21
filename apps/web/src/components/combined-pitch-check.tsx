"use client";

import { useState } from "react";
import { ArrowUpRight, AudioLines, Loader2, PanelsTopLeft } from "lucide-react";

import { AnalysisProgress, type AnalysisStatus } from "@/components/analysis-progress";

type CombinedPitchCheckProps = {
  // What is still needed before the check can run, e.g. "a PDF deck"; null when both files are there
  missing: string | null;
  onRun: () => void;
  // An analysis is running, this one or another
  busy: boolean;
  // Progress of the combined check itself
  status: AnalysisStatus | null;
  error?: string;
};

export function CombinedPitchCheck({ missing, onRun, busy, status, error }: CombinedPitchCheckProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="combined-check">
      <button
        type="button"
        className="combined-check-button"
        aria-expanded={missing ? expanded : undefined}
        aria-controls={missing ? "combined-check-details" : undefined}
        aria-describedby="combined-check-description combined-check-availability"
        disabled={busy}
        onClick={() => (missing ? setExpanded((value) => !value) : onRun())}
      >
        <span className="combined-check-icons" aria-hidden="true">
          <span><AudioLines /></span>
          <span><PanelsTopLeft /></span>
        </span>
        <span>{status ? "Checking pitch + deck…" : "Check pitch + deck"}</span>
        <span className="combined-check-arrow">
          {status ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
        </span>
      </button>
      <p id="combined-check-description" className="combined-check-description">
        Two scores. See how your pitch follows your slides.
      </p>
      <p id="combined-check-availability" className="combined-check-availability">
        {missing ? `Add ${missing} to run it` : "Ready"} <span aria-hidden="true">·</span> Powered by Gemma
      </p>
      {status && (
        <div className="combined-check-progress">
          <AnalysisProgress status={status} />
        </div>
      )}
      {error && <p className="checker-error" role="alert">{error}</p>}
      <div id="combined-check-details" className="combined-check-details" hidden={!missing || !expanded}>
        <p>
          Gemma scores your delivery and your deck separately, then compares
          what you say with what your slides show. You get the deck points you
          never explained and the places where the talk and the slides disagree.
        </p>
        <p className="combined-check-details-note">
          Add {missing} above to run the combined check. You can also check the
          recording or the deck on its own.
        </p>
      </div>
    </div>
  );
}
