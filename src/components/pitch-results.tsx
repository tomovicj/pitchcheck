import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CriteriaList, Score, ScoreNotes, Stat, formatTime } from "@/components/result-parts";
import type { AudioAnalysis } from "@/lib/analysis";

export function PitchResults({ result }: { result: AudioAnalysis }) {
  const { prosody, pauses, segments, summary } = result;

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Pitch score</CardTitle>
          <CardDescription>
            Rated by {result.model} from the audio, against a fixed rubric with levels from 0 to 4.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {summary?.pitch_score != null ? (
            <>
              <Score value={summary.pitch_score} />
              {!!summary.criteria?.length && <CriteriaList criteria={summary.criteria} />}
              {!!summary.missing_topics?.length && (
                <p className="text-sm">
                  <span className="font-medium">Expected topics not explained:</span>{" "}
                  {summary.missing_topics.join(", ")}
                </p>
              )}
              {!!summary.insights?.length && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Insights</h3>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                    {summary.insights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!summary.feedback?.length && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">What to improve</h3>
                  <ul className="flex flex-col gap-2 text-sm">
                    {summary.feedback.map((item) => (
                      <li key={item.text} className="flex items-start gap-2">
                        {item.at_s != null && (
                          <Badge variant="outline" className="tabular-nums">
                            {formatTime(item.at_s)}
                          </Badge>
                        )}
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Gemma did not return a usable score for this recording.
            </p>
          )}
          <ScoreNotes>
            <li>
              The score rates how the pitch is delivered. It does not rate the business idea, its
              investment potential or the speaker&apos;s emotions.
            </li>
            <li>
              Pauses, pitch, loudness and speaking rate are measured from the signal with Praat.
              Filler words and topics are what Gemma hears. Only the filler word levels rest on
              research (one study, in English); the other levels are conventions.
            </li>
            <li>The score has not been validated against jury decisions or funding outcomes.</li>
            <li>
              It can be less accurate for speakers with an accent, non-native speakers and people
              with speech differences.
            </li>
          </ScoreNotes>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cadence</CardTitle>
          <CardDescription>{formatTime(result.duration_s)} of audio</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Stat
            label="Pauses"
            value={String(pauses.pause_count)}
            hint={`${pauses.total_pause_s}s total`}
          />
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
