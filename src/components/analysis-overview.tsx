"use client";

import { useState, type CSSProperties } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowUpRight, AudioLines, Check, FileText, Layers, MessageCircle,
  Mic2, Sparkles, Timer, Type, X, type LucideIcon,
} from "lucide-react";

import { AlignmentResults } from "@/components/alignment-results";
import { DeckResults } from "@/components/deck-results";
import { PitchResults } from "@/components/pitch-results";
import { formatTime } from "@/components/result-parts";
import { VerdictCard } from "@/components/verdict-card";
import type { Results } from "@/lib/results-store";
import "./analysis-overview.css";

type Metric = { label: string; value: string; unit?: string; hint: string; icon: LucideIcon };

function ScoreCard({ kind, score, insight, detail }: {
  kind: "pitch" | "deck";
  score: number | null | undefined;
  insight?: string;
  detail: string;
}) {
  const Icon = kind === "pitch" ? AudioLines : Layers;
  const label = kind === "pitch" ? "Pitch delivery" : "Slide deck";
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <article className={`overview-score overview-score-${kind}`} aria-label={`${label} score`}>
      <div className="overview-score-label">
        <Icon aria-hidden="true" /><h4>{label}</h4><span>{detail}</span>
      </div>
      <div className="overview-score-content">
        <div className="overview-dial">
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle className="overview-dial-track" cx="64" cy="64" r={radius} />
            {score != null && (
              <circle
                className="overview-dial-fill" cx="64" cy="64" r={radius}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, score)) / 100)}
              />
            )}
          </svg>
          <div className="overview-dial-number">
            <strong>{score != null ? Math.round(score) : "N/A"}</strong>
            <span>{score != null ? "out of 100" : "No usable score"}</span>
          </div>
        </div>
        <div className="overview-score-copy">
          <span className="overview-score-eyebrow">
            {kind === "pitch" ? "How your pitch sounds" : "How your slides communicate"}
          </span>
          <p>{insight ?? "Open the full report to explore the analysis and feedback."}</p>
        </div>
      </div>
    </article>
  );
}

// The overview presents existing scores and measurements; it adds no new ratings.
export function AnalysisOverview({ results }: { results: Results }) {
  const { pitch, slides, alignment, sample } = results;
  const [section, setSection] = useState("pitch");
  const sections = [
    ...(pitch ? [{ id: "pitch", label: "Pitch delivery", icon: AudioLines }] : []),
    ...(slides ? [{ id: "deck", label: "Slide deck", icon: Layers }] : []),
    ...(alignment !== undefined ? [{ id: "alignment", label: "Pitch + deck", icon: Sparkles }] : []),
    ...(!sample && alignment !== undefined && pitch?.file && slides?.file ? [{ id: "verdict", label: "Downloads", icon: FileText }] : []),
  ];
  const active = sections.some((item) => item.id === section) ? section : sections[0]?.id;
  const metrics: Metric[] = pitch ? [
    ...(alignment && alignment.deck_points > 0 ? [{
      label: "Deck coverage",
      value: String(Math.round((alignment.deck_points - alignment.unexplained.length) / alignment.deck_points * 100)),
      unit: "%",
      hint: `${alignment.deck_points - alignment.unexplained.length} of ${alignment.deck_points} slide points explained`,
      icon: Layers,
    }] : []),
    { label: "Speaking rate", value: pitch.prosody?.syllable_rate != null ? pitch.prosody.syllable_rate.toFixed(1) : "N/A", unit: pitch.prosody?.syllable_rate != null ? "syllables/s" : undefined, hint: "Measured from your audio", icon: Mic2 },
    { label: "Filler words", value: String(pitch.filler_words.per_minute), unit: "/ min", hint: `${pitch.filler_words.count} heard by Gemma`, icon: MessageCircle },
    ...(!alignment || alignment.deck_points === 0 ? [{ label: "Speaking time", value: String(Math.round(pitch.pauses.speaking_ratio * 100)), unit: "%", hint: "Between the first and last sound", icon: Timer }] : []),
    ...(!slides ? [{ label: "Recording length", value: formatTime(pitch.duration_s), hint: "Minutes and seconds", icon: Timer }] : []),
  ] : slides ? [
    { label: "Slides reviewed", value: String(slides.pages_analyzed), hint: `Of ${slides.page_count} slides in your deck`, icon: Layers },
    { label: "Words per slide", value: slides.measurements ? String(slides.measurements.words_median) : "N/A", hint: "Median across your deck", icon: FileText },
    { label: "Smallest text", value: slides.measurements ? String(slides.measurements.smallest_text_pct) : "N/A", unit: slides.measurements ? "%" : undefined, hint: "Of the slide height", icon: Type },
    { label: "Fonts used", value: slides.measurements ? String(slides.measurements.fonts.length) : "N/A", hint: slides.measurements ? "Across your deck" : "PDF text could not be measured", icon: Type },
  ] : [];

  return (
    <section className="analysis-results analysis-overview" id="results" aria-labelledby="overview-title">
      <div className="overview-heading">
        <div>
          <p className="overview-eyebrow"><span><Check aria-hidden="true" /></span>{sample ? "Sample analysis" : "Analysis complete"}</p>
          <h3 id="overview-title">Your pitch, a little clearer.</h3>
          <p className="overview-description">The essentials at a glance. A clearer next step.</p>
        </div>
        <span className="overview-gemma"><Sparkles aria-hidden="true" />Analyzed with Gemma</span>
      </div>
      {sample && <p className="overview-sample">A saved example using a synthetic voice and a test deck. Upload your files to see your own results.</p>}
      <div className={`overview-scores${pitch && slides ? "" : " is-single"}`}>
        {pitch && <ScoreCard kind="pitch" score={pitch.summary?.pitch_score} insight={pitch.summary?.insights?.[0]} detail={`${formatTime(pitch.duration_s)} recording`} />}
        {slides && <ScoreCard kind="deck" score={slides.summary?.slide_score} insight={slides.summary?.insights?.[0]} detail={`${slides.pages_analyzed} slides reviewed`} />}
      </div>
      <div className="overview-metrics" style={{ "--metric-count": metrics.length } as CSSProperties}>
        {metrics.map(({ label, value, unit, hint, icon: Icon }) => (
          <div className="overview-metric" key={label}>
            <span className="overview-metric-label"><Icon aria-hidden="true" />{label}</span>
            <p><strong>{value}</strong>{unit && <span>{unit}</span>}</p>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      <Dialog.Root onOpenChange={(open) => { if (open) setSection(sections[0]?.id ?? "pitch"); }}>
        <div className="overview-more">
          <Dialog.Trigger className="overview-more-button">SHOW MORE<ArrowUpRight aria-hidden="true" /></Dialog.Trigger>
          <p>All criteria, insights & recommendations</p>
        </div>
        <Dialog.Portal>
          <Dialog.Backdrop className="report-backdrop" />
          <Dialog.Popup className="report-popup">
            <header className="report-heading">
              <div>
                <p className="overview-eyebrow"><Sparkles aria-hidden="true" />Gemma analysis{sample ? " · Sample" : ""}</p>
                <Dialog.Title>Your full AI report.</Dialog.Title>
                <Dialog.Description>Explore your scores, the details behind them, and what to improve.</Dialog.Description>
              </div>
              <Dialog.Close className="report-close" aria-label="Close AI report"><X aria-hidden="true" /></Dialog.Close>
            </header>
            <nav className="report-navigation" aria-label="Report sections">
              {sections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id} type="button" aria-pressed={active === id}
                  className={active === id ? "is-active" : undefined}
                  onClick={() => setSection(id)}
                >
                  <Icon aria-hidden="true" />{label}
                </button>
              ))}
            </nav>
            <div className="report-content" key={active}>
              {active === "pitch" && pitch && <PitchResults result={pitch} />}
              {active === "deck" && slides && <DeckResults result={slides} />}
              {active === "alignment" && <AlignmentResults alignment={alignment ?? null} />}
              {active === "verdict" && pitch && slides && <VerdictCard check={{ pitch, deck: slides, alignment: alignment ?? null }} />}
            </div>
            <footer className="report-footer">
              <Sparkles aria-hidden="true" />Scores rate your delivery and slides, never your business idea.
            </footer>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
