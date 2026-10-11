import { Progress } from "@/components/ui/progress";
import type { AnalysisStage } from "@/lib/analysis";

export type AnalysisStatus = { stage: AnalysisStage | "uploading"; progress: number };

const STAGE_LABELS: Record<AnalysisStatus["stage"], string> = {
  uploading: "Uploading your files",
  measuring: "Measuring pitch, loudness and pauses",
  listening: "Gemma is listening to each segment",
  scoring: "Scoring the pitch",
  reading: "Gemma is reading each slide",
  reviewing: "Reviewing the deck",
  aligning: "Comparing what you say with what your slides show",
};

export function AnalysisProgress({ status }: { status: AnalysisStatus }) {
  return (
    <div className="analysis-status" role="status" aria-live="polite">
      <div className="analysis-status-label">
        <span>{STAGE_LABELS[status.stage]}…</span>
        <span>{Math.round(status.progress * 100)}%</span>
      </div>
      <Progress value={status.progress * 100} />
    </div>
  );
}
