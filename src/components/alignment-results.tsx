import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScoreNotes, formatTime } from "@/components/result-parts";
import type { Alignment } from "@/lib/analysis";

export function AlignmentResults({ alignment }: { alignment: Alignment | null }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Does your talk follow your deck?</CardTitle>
        <CardDescription>
          Gemma compared the key points of each slide with what it heard you say.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {alignment ? (
          <>
            {alignment.summary && (
              <p className="text-sm">
                <span className="font-medium">What Gemma understood:</span> {alignment.summary}
              </p>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="w-full text-sm sm:w-36 sm:shrink-0">Deck covered in the talk</span>
                <Progress value={alignment.coverage_level * 25} className="flex-1" />
                <span className="text-muted-foreground w-10 text-right text-sm tabular-nums">
                  {alignment.coverage_level}/4
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {alignment.deck_points - alignment.unexplained.length} of {alignment.deck_points} key
                points from the slides are explained in the talk.
              </p>
            </div>
            {!!alignment.unexplained.length && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">On the slides, not in the talk</h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {alignment.unexplained.map((item) => (
                    <li key={`${item.slide}-${item.point}`} className="flex items-start gap-2">
                      <Badge variant="outline" className="tabular-nums">
                        Slide {item.slide}
                      </Badge>
                      <span>{item.point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Where the talk and the slides disagree</h3>
              {alignment.contradictions.length ? (
                <ul className="flex flex-col gap-3 text-sm">
                  {alignment.contradictions.map((item) => (
                    <li key={`${item.slide_says}-${item.speaker_says}`} className="flex flex-col gap-1">
                      <span className="flex items-start gap-2">
                        <Badge variant="outline" className="tabular-nums">
                          {item.slide != null ? `Slide ${item.slide}` : "Slides"}
                        </Badge>
                        <span>{item.slide_says}</span>
                      </span>
                      <span className="flex items-start gap-2">
                        <Badge variant="outline" className="tabular-nums">
                          {item.at_s != null ? formatTime(item.at_s) : "Talk"}
                        </Badge>
                        <span>{item.speaker_says}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Gemma found no statement that disagrees with a slide.</p>
              )}
            </div>
            {!!alignment.recommendations.length && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">How to bring them in line</h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                  {alignment.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            The talk and the deck could not be compared: Gemma returned no key points for one of them.
          </p>
        )}
        <ScoreNotes>
          <li>
            You do not have to read your slides. Summarising a slide or adding explanation is not
            counted as a mismatch.
          </li>
          <li>
            This check is not part of either score. A misheard number can show up as a disagreement, so
            check each one against your recording.
          </li>
        </ScoreNotes>
      </CardContent>
    </Card>
  );
}
