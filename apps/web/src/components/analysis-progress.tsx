import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import type { ProgressStage } from "@/lib/analysis";

export type AnalysisStatus = { stage: ProgressStage; progress: number };

const STAGE_LABELS: Record<AnalysisStatus["stage"], string> = {
  uploading: "Uploading your files",
  preparing: "Preparing your files for Gemma",
  measuring: "Measuring pitch, loudness and pauses",
  listening: "Gemma is listening to each segment",
  scoring: "Scoring the pitch",
  reading: "Gemma is reading each slide",
  reviewing: "Reviewing the deck",
  aligning: "Comparing what you say with what your slides show",
};

export function AnalysisProgress({ status }: { status: AnalysisStatus }) {
  const preparing = status.stage === "preparing";
  return (
    <div className="analysis-status" role="status" aria-live="polite">
      <div className="analysis-status-label">
        <span>{STAGE_LABELS[status.stage]}…</span>
        {preparing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <span>{Math.round(status.progress * 100)}%</span>}
      </div>
      <Progress value={preparing ? null : status.progress * 100} />
      {status.stage === "uploading" && <p className="analysis-upload-note">Upload progress. The analysis starts once your files reach Gemma.</p>}
    </div>
  );
}
