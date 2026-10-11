import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Checklist,
  CriteriaList,
  Score,
  ScoreNotes,
  Stat,
  Subscores,
  formatTime,
  weakest,
} from "@/components/result-parts";
import type { AudioAnalysis } from "@/lib/analysis";

// Criteria named when Gemma returned no feedback to show
const WEAKEST_SHOWN = 3;

// The full report on the recording; the overview opens it
export function PitchResults({ result }: { result: AudioAnalysis }) {
  const { prosody, pauses, segments, summary } = result;
  const feedback = summary?.feedback ?? [];

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Pitch score</CardTitle>
          <CardDescription>
            What you say and how you say it, against Y Combinator&apos;s advice on pitching.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {summary?.pitch_score != null ? (
            <Score value={summary.pitch_score} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Gemma did not return what is needed to score this recording. What could be measured is below.
            </p>
          )}
          {summary && (
            <>
              <Subscores subscores={summary.subscores} />
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">What to improve</h3>
                {feedback.length ? (
                  <ul className="flex flex-col gap-2 text-sm">
                    {feedback.map((item) => (
                      <li key={item.text} className="flex items-start gap-2">
                        {item.at_s != null && (
                          <Badge variant="outline" className="tabular-nums">
                            {formatTime(item.at_s)}
                          </Badge>
                        )}
                        <span>
                          {item.criterion && <span className="font-medium">{item.criterion}: </span>}
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {weakest(summary.criteria, WEAKEST_SHOWN).map((c) => (
                      <li key={c.name}>
                        <span className="font-medium">{c.name}:</span> {c.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium">How the score is built</h3>
                <CriteriaList criteria={summary.criteria} />
              </div>
              {!!summary.checklist.length && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium">What a pitch is expected to say</h3>
                  <Checklist items={summary.checklist} />
                </div>
              )}
              {!!summary.insights.length && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Insights</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                    {summary.insights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
              <ScoreNotes>
                <li>
                  The score rates what the pitch says and how it is delivered. It does not rate the business
                  idea, its investment potential or the speaker&apos;s emotions.
                </li>
                <li>
                  What the pitch says counts for 60% of the score and the delivery for 40%. The expected
                  topics and most standards are Y Combinator&apos;s advice to founders; the limits that turn
                  them into levels are this rubric&apos;s own, and none is checked on real pitches.
                </li>
                <li>
                  Gemma ({result.model}) listens to the recording and labels each statement with the
                  expected topic it says; a topic with no statement counts as missing. Pauses, pitch,
                  loudness and speaking rate are measured from the signal with Praat, and every level is
                  arithmetic.
                </li>
                <li>Marketing words are counted from a short fixed list, in English only.</li>
                <li>The score has not been validated against jury decisions or funding outcomes.</li>
                <li>
                  It can be less accurate for speakers with an accent, non-native speakers and people
                  with speech differences.
                </li>
              </ScoreNotes>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cadence</CardTitle>
          <CardDescription>{formatTime(result.duration_s)} of audio</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Stat label="Pauses" value={String(pauses.pause_count)} hint={`${pauses.total_pause_s}s total`} />
          <Stat label="Longest pause" value={`${pauses.longest_pause_s}s`} hint={`mean ${pauses.mean_pause_s}s`} />
          <Stat
            label="Speaking time"
            value={`${Math.round(pauses.speaking_ratio * 100)}%`}
            hint="of the time between first and last word"
          />
          {prosody?.syllable_rate != null && (
            <Stat
              label="Speaking rate"
              value={`${prosody.syllable_rate} /s`}
              hint="syllables per second of speaking, measured"
            />
          )}
          <Stat label="Segments" value={String(segments.length)} hint="each one sent to Gemma on its own" />
          <Stat
            label="Filler words"
            value={String(result.filler_words.count)}
            hint={`${result.filler_words.per_minute} per minute, as heard by Gemma`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tonality</CardTitle>
          <CardDescription>Pitch and loudness</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {prosody ? (
            <>
              <Stat
                label="Pitch variation"
                value={`${prosody.pitch_std_semitones} st`}
                hint="Measured pitch variation"
              />
              <Stat
                label="Pitch range"
                value={`${prosody.pitch_range_semitones} st`}
                hint={`${prosody.pitch_p5_hz.toFixed(0)}–${prosody.pitch_p95_hz.toFixed(0)} Hz`}
              />
              <Stat label="Median pitch" value={`${prosody.pitch_median_hz.toFixed(0)} Hz`} />
              <Stat
                label="Loudness variation"
                value={`${prosody.intensity_std_db} dB`}
                hint={`avg ${prosody.intensity_mean_db} dB`}
              />
            </>
          ) : (
            <p className="text-muted-foreground col-span-2 text-sm">No voiced speech detected.</p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>What Gemma heard in each segment</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {segments.map((segment) => {
            const o = segment.observations;
            return (
              <div key={segment.start_s} className="flex flex-col gap-1.5 border-b pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {formatTime(segment.start_s)}–{formatTime(segment.end_s)}
                  </span>
                  {segment.pace && (
                    <Badge variant="outline">
                      {segment.pace} pace
                      {segment.measurements?.syllable_rate != null && ` · ${segment.measurements.syllable_rate} syllables/s`}
                    </Badge>
                  )}
                </div>
                {o ? (
                  <>
                    {o.tone && <p className="text-muted-foreground text-xs">Tone: {o.tone}</p>}
                    {o.observations && <p className="text-sm">{o.observations}</p>}
                    {!!o.filler_words?.length && (
                      <p className="text-muted-foreground text-xs">
                        Filler words: {o.filler_words.join(", ")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Gemma&apos;s reply for this segment did not parse.</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
