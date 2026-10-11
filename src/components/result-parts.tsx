import type { ReactNode } from "react";

import { Progress } from "@/components/ui/progress";
import type { Criterion } from "@/lib/analysis";

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

export function Score({ value }: { value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-5xl font-semibold tabular-nums">{Math.round(value)}</span>
      <span className="text-muted-foreground">/ 100</span>
    </div>
  );
}

// Each criterion with its level from 0 to 4 and the measurement or observation behind it
export function CriteriaList({ criteria }: { criteria: Criterion[] }) {
  return (
    <div className="flex flex-col gap-3">
      {criteria.map((c) => (
        <div key={c.name} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="w-full text-sm sm:w-36 sm:shrink-0">{c.name}</span>
            <Progress value={c.level * 25} className="flex-1" />
            <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">{c.level}/4</span>
          </div>
          {c.reason && <p className="text-muted-foreground text-xs">{c.reason}</p>}
        </div>
      ))}
    </div>
  );
}

// What the score does and does not say; shown under every score
export function ScoreNotes({ children }: { children: ReactNode }) {
  return (
    <ul className="text-muted-foreground flex list-disc flex-col gap-1 border-t pt-4 pl-5 text-xs">{children}</ul>
  );
}
