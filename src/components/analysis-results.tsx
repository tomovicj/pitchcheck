"use client";

import { useState } from "react";
import { AudioLines, Check, ChevronDown, Clock3, Lightbulb, PanelsTopLeft, Play, Sparkles, Target } from "lucide-react";
import type { AudioAnalysis } from "@/lib/analysis";

export function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${(safe % 60).toString().padStart(2, "0")}`;
}

function validScore(score: number | undefined) {
  return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;
}

function ScoreDial({ score }: { score: number | undefined }) {
  const scored = validScore(score);
  return (
    <div className="result-dial">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="result-dial-track" cx="70" cy="70" r="60" />
        {scored && <circle className="result-dial-fill" cx="70" cy="70" r="60" pathLength="100" strokeDasharray={`${score} 100`} />}
      </svg>
      <div className="result-dial-value"><strong>{scored ? Math.round(score!) : "—"}</strong><span>{scored ? "out of 100" : "Not scored"}</span></div>
    </div>
  );
}

function SignalStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="signal-stat"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}

export function AnalysisResults({ result, fileName, busy = false, onSeek }: { result: AudioAnalysis | null; fileName?: string; busy?: boolean; onSeek: (seconds: number) => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "moments" | "signal">("overview");

  if (!result) {
    return (
      <section id="analysis-results" className="analysis-results results-waiting" aria-labelledby="results-waiting-title">
        <span className="results-waiting-icon"><Sparkles aria-hidden="true" /></span>
        <div><h3 id="results-waiting-title">{busy ? "A fresh perspective is on its way." : "Your feedback starts here."}</h3><p>{busy ? "Gemma is working through your recording." : "Check your recording to see your score, insights and next steps."}</p></div>
        <span className="results-waiting-label"><AudioLines aria-hidden="true" />Delivery + feedback</span>
      </section>
    );
  }

  const { summary, prosody, pauses, segments } = result;
  const tabs = [{ id: "overview", label: "Overview", Icon: Sparkles }, { id: "moments", label: "Pitch moments", Icon: Play }, { id: "signal", label: "Audio details", Icon: AudioLines }] as const;

  return (
    <section id="analysis-results" className="analysis-results results-panel" aria-labelledby="results-title">
      <header className="results-heading">
        <div><p className="eyebrow">Your next take, a little clearer</p><h3 id="results-title" tabIndex={-1}>A fresh perspective.</h3><p className="results-file"><AudioLines aria-hidden="true" /><span>{fileName ?? "Your recording"}</span><span className="results-duration">{formatTime(result.duration_s)}</span></p></div>
        <span className="results-gemma"><Sparkles aria-hidden="true" />Analyzed by Gemma</span>
      </header>

      <div className="result-scores">
        <article className="result-score-card result-score-delivery" aria-labelledby="delivery-score-title">
          <div className="result-score-top"><span><AudioLines aria-hidden="true" /><h4 id="delivery-score-title">Pitch delivery</h4></span><span className="result-score-source">From your audio</span></div>
          <div className="result-score-body"><ScoreDial score={summary?.pitch_score} /><div><span className="result-score-eyebrow">Your delivery score</span><p>How your pitch<br />comes across.</p><small>{validScore(summary?.pitch_score) ? "Scored by Gemma from your recording." : "Gemma did not return a usable score."}</small></div></div>
        </article>
        <article className="result-score-card result-score-deck" aria-labelledby="deck-score-title">
          <div className="result-score-top"><span><PanelsTopLeft aria-hidden="true" /><h4 id="deck-score-title">Pitch deck</h4></span><span className="result-coming-soon">Coming soon</span></div>
          <div className="result-score-body"><div className="result-deck-art" aria-hidden="true"><PanelsTopLeft /><span /><span /></div><div><span className="result-score-eyebrow">A clearer story</span><p>Your slides,<br />in perspective.</p><small>Deck scores and feedback are coming soon.</small></div></div>
        </article>
      </div>

      <div className="results-tabs" role="tablist" aria-label="Pitch analysis views">
        {tabs.map(({ id, label, Icon }) => <button key={id} id={`results-tab-${id}`} type="button" role="tab" aria-selected={activeTab === id} aria-controls={`results-view-${id}`} tabIndex={activeTab === id ? 0 : -1} className={activeTab === id ? "is-active" : ""} onClick={() => setActiveTab(id)} onKeyDown={(event) => {
          const current = tabs.findIndex(tab => tab.id === id);
          let next = current;
          if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
          else if (event.key === "ArrowLeft") next = (current + tabs.length - 1) % tabs.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = tabs.length - 1;
          else return;
          event.preventDefault();
          setActiveTab(tabs[next].id);
          document.getElementById(`results-tab-${tabs[next].id}`)?.focus();
        }}><Icon aria-hidden="true" />{label}</button>)}
      </div>

      <div id="results-view-overview" className="results-view" role="tabpanel" aria-labelledby="results-tab-overview" hidden={activeTab !== "overview"} tabIndex={0}>
        <div className="result-overview-grid">
          <article className="result-detail-card result-criteria">
            <div className="result-detail-heading"><span className="result-detail-icon"><Target aria-hidden="true" /></span><div><h4>The delivery breakdown</h4><p>What went into your score.</p></div></div>
            {summary?.criteria?.length ? <div className="result-criteria-list">{summary.criteria.map((criterion, index) => <div className="result-criterion" key={`${criterion.name}-${index}`}><div className="result-criterion-heading"><h5>{criterion.name}</h5><span>{validScore(criterion.score) ? Math.round(criterion.score) : "—"}<small> / 100</small></span></div><div className="result-criterion-meter" role="meter" aria-label={criterion.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={validScore(criterion.score) ? criterion.score : undefined} aria-valuetext={validScore(criterion.score) ? `${Math.round(criterion.score)} out of 100` : "Not scored"}><span style={{ width: `${validScore(criterion.score) ? criterion.score : 0}%` }} /></div>{criterion.reason && <p>{criterion.reason}</p>}</div>)}</div> : <p className="result-empty-copy">Gemma did not return individual criteria for this recording.</p>}
          </article>
          <div className="result-guidance">
            <article className="result-detail-card result-insights">
              <div className="result-detail-heading"><span className="result-detail-icon"><Lightbulb aria-hidden="true" /></span><div><h4>What Gemma noticed</h4><p>A closer look at your delivery.</p></div></div>
              {summary?.insights?.length ? <ul className="result-insight-list">{summary.insights.map((insight, index) => <li key={index}><span className="result-insight-dot" aria-hidden="true" /><p>{insight}</p></li>)}</ul> : <p className="result-empty-copy">No insights were returned for this recording.</p>}
            </article>
            <article className="result-detail-card result-feedback">
              <div className="result-detail-heading"><span className="result-detail-icon"><Sparkles aria-hidden="true" /></span><div><h4>Make your next take count</h4><p>Small changes to practice next.</p></div></div>
              {summary?.feedback?.length ? <ol className="result-feedback-list" role="list">{summary.feedback.map((item, index) => <li key={index}><span className="result-feedback-number">{String(index + 1).padStart(2, "0")}</span><div>{item.at_s != null && Number.isFinite(item.at_s) && <button type="button" className="result-time-button" aria-label={`Play recording at ${formatTime(item.at_s)}`} onClick={() => onSeek(item.at_s!)}><Play aria-hidden="true" />{formatTime(item.at_s)}</button>}<p>{item.text}</p></div></li>)}</ol> : <p className="result-empty-copy">No improvement suggestions were returned.</p>}
            </article>
          </div>
        </div>
      </div>

      <div id="results-view-moments" className="results-view" role="tabpanel" aria-labelledby="results-tab-moments" hidden={activeTab !== "moments"} tabIndex={0}>
        <article className="result-detail-card result-timeline">
          <div className="result-detail-heading"><span className="result-detail-icon"><Clock3 aria-hidden="true" /></span><div><h4>Your pitch, moment by moment</h4><p>Jump back into the recording to hear what Gemma heard.</p></div></div>
          {segments.length ? <ol className="result-moments-list" role="list">{segments.map((segment, index) => <li key={`${segment.start_s}-${index}`}><div className="result-moment-time"><button type="button" className="result-time-button" onClick={() => onSeek(segment.start_s)} aria-label={`Play recording at ${formatTime(segment.start_s)}`}><Play aria-hidden="true" />{formatTime(segment.start_s)}</button><span>to {formatTime(segment.end_s)}</span></div><div className="result-moment-content">{segment.observations ? <><div className="result-moment-tags">{segment.observations.emotion && <span>{segment.observations.emotion}</span>}{segment.observations.energy && <span>{segment.observations.energy} energy</span>}{segment.observations.pace && <span>{segment.observations.pace} pace</span>}</div>{segment.observations.observations && <p>{segment.observations.observations}</p>}{segment.observations.tone && <p className="result-moment-note">Tone: {segment.observations.tone}</p>}{!!segment.observations.filler_words?.length && <p className="result-moment-note">Filler words: {segment.observations.filler_words.join(", ")}</p>}{!!segment.observations.topics?.length && <p className="result-moment-note">Topics: {segment.observations.topics.join(", ")}</p>}</> : <p className="result-empty-copy">Gemma&apos;s observations for this segment could not be read.</p>}</div></li>)}</ol> : <p className="result-empty-copy">No pitch segments were returned.</p>}
        </article>
      </div>

      <div id="results-view-signal" className="results-view" role="tabpanel" aria-labelledby="results-tab-signal" hidden={activeTab !== "signal"} tabIndex={0}>
        <div className="result-signal-grid">
          <article className="result-detail-card"><div className="result-detail-heading"><span className="result-detail-icon"><Clock3 aria-hidden="true" /></span><div><h4>The rhythm of your pitch</h4><p>Timing measured from your audio.</p></div></div><div className="signal-stats"><SignalStat label="Pauses" value={String(pauses.pause_count)} hint={`${pauses.total_pause_s}s total`} /><SignalStat label="Longest pause" value={`${pauses.longest_pause_s}s`} hint={`Average ${pauses.mean_pause_s}s`} /><SignalStat label="Speaking time" value={`${Math.round(pauses.speaking_ratio * 100)}%`} /><SignalStat label="Segments" value={String(segments.length)} hint="Up to 30 seconds each" /></div></article>
          <article className="result-detail-card"><div className="result-detail-heading"><span className="result-detail-icon"><AudioLines aria-hidden="true" /></span><div><h4>Your voice, in detail</h4><p>Pitch and loudness measurements.</p></div></div>{prosody ? <div className="signal-stats"><SignalStat label="Pitch variation" value={`${prosody.pitch_std_semitones} st`} /><SignalStat label="Pitch range" value={`${prosody.pitch_range_semitones} st`} hint={`${prosody.pitch_p5_hz.toFixed(0)}–${prosody.pitch_p95_hz.toFixed(0)} Hz`} /><SignalStat label="Median pitch" value={`${prosody.pitch_median_hz.toFixed(0)} Hz`} /><SignalStat label="Loudness variation" value={`${prosody.intensity_std_db} dB`} hint={`Average ${prosody.intensity_mean_db} dB`} /></div> : <p className="result-empty-copy">No voiced speech was detected.</p>}</article>
        </div>
      </div>
      <footer className="results-footer"><span><Check aria-hidden="true" />Delivery and slides, never your business idea.</span><details><summary>Model details <ChevronDown aria-hidden="true" /></summary><p>{result.model}</p></details></footer>
    </section>
  );
}
