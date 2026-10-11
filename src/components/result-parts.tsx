import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ChecklistItem, Criterion, Subscores as GroupScores } from "@/lib/analysis";

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

// The groups of criteria in the order they are shown, with what each one covers
const GROUPS = [
  { key: "content", label: "Content", covers: "what it says" },
  { key: "delivery", label: "Delivery", covers: "how it sounds" },
  { key: "design", label: "Design", covers: "how it looks" },
] as const;

// The score of each group of criteria, so that a team sees at a glance where the points went
export function Subscores({ subscores }: { subscores: GroupScores }) {
  return (
    <div className="flex flex-col gap-3">
      {GROUPS.filter((group) => subscores[group.key] != null).map((group) => (
        <div key={group.key} className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex w-full flex-col sm:w-36 sm:shrink-0">
            <span className="text-sm">{group.label}</span>
            <span className="text-muted-foreground text-xs">{group.covers}</span>
          </span>
          <Progress value={subscores[group.key] ?? null} className="flex-1" />
          <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">{subscores[group.key]}</span>
        </div>
      ))}
    </div>
  );
}

function CriterionRow({ criterion: c }: { criterion: Criterion }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="w-full text-sm sm:w-36 sm:shrink-0">{c.name}</span>
        <Progress value={c.level * 25} className="flex-1" />
        <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">{c.level}/4</span>
      </div>
      {c.reason && <p className="text-muted-foreground text-xs">{c.reason}</p>}
      {c.level < 4 && c.target && <p className="text-xs">For 4/4: {c.target}.</p>}
      {c.standard && (
        <p className="text-muted-foreground text-xs">
          {c.standard.quote && <span className="italic">&ldquo;{c.standard.quote}&rdquo; </span>}
          {c.standard.url ? (
            <a href={c.standard.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {c.standard.by}
            </a>
          ) : (
            c.standard.by
          )}
        </p>
      )}
    </div>
  );
}

// Each criterion with its level from 0 to 4, the measurement or observation behind it, what level 4
// takes and the advice it rests on. Criteria of one group sit under that group's name.
export function CriteriaList({ criteria }: { criteria: Criterion[] }) {
  const grouped = GROUPS.map((group) => ({ ...group, criteria: criteria.filter((c) => c.group === group.key) })).filter(
    (group) => group.criteria.length,
  );
  // A verdict made before the groups carries none
  const ungrouped = criteria.filter((c) => !c.group);
  return (
    <div className="flex flex-col gap-5">
      {grouped.map((group) => (
        <div key={group.key} className="flex flex-col gap-3">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{group.label}</h4>
          {group.criteria.map((c) => (
            <CriterionRow key={c.name} criterion={c} />
          ))}
        </div>
      ))}
      {ungrouped.map((c) => (
        <CriterionRow key={c.name} criterion={c} />
      ))}
    </div>
  );
}

// What a pitch or a deck is expected to say, each with the statement Gemma named for it and its place
export function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {items.map((item) => (
        <li key={item.item} className="flex items-start gap-3">
          <span className={`verdict-state ${item.found ? "verdict-match" : "verdict-mismatch"}`}>
            {item.found ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium first-letter:uppercase">{item.item}</span>
              {item.at_s != null && (
                <Badge variant="outline" className="tabular-nums">
                  {formatTime(item.at_s)}
                </Badge>
              )}
              {item.slide != null && (
                <Badge variant="outline" className="tabular-nums">
                  Slide {item.slide}
                </Badge>
              )}
              {item.found && item.number === false && <Badge variant="destructive">no number</Badge>}
            </span>
            <span className="text-muted-foreground text-xs">
              {item.found ? <>&ldquo;{item.quote}&rdquo;</> : "Not said."}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// The criteria that cost the most points, for when Gemma returned no feedback to lead with
export function weakest(criteria: Criterion[], count: number) {
  return criteria
    .filter((c) => c.level < 4)
    .sort((a, b) => a.level - b.level)
    .slice(0, count);
}

// What the score does and does not say; shown under every score
export function ScoreNotes({ children }: { children: ReactNode }) {
  return (
    <ul className="text-muted-foreground flex list-disc flex-col gap-1 border-t pt-4 pl-5 text-xs">{children}</ul>
  );
}
