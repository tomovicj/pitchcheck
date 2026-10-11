import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CriteriaList, Score, ScoreNotes, Stat } from "@/components/result-parts";
import type { DeckAnalysis, Slide } from "@/lib/analysis";

// The limits the service flags a slide by; keep in step with services/audio/app/deck.py
const SMALL_TEXT_SHARE = 1 / 3;
const DENSE_WORDS = 60;
const LOW_CONTRAST_SHARE = 0.1;

function slideFlags(slide: Slide) {
  const m = slide.measurements;
  if (!m) return [];
  const flags = [];
  if (m.words > DENSE_WORDS) flags.push(`${m.words} words`);
  if (m.small_text_share > SMALL_TEXT_SHARE) flags.push(`small text, ${m.smallest_text_pct}% of slide height`);
  if (m.low_contrast_share != null && m.low_contrast_share > LOW_CONTRAST_SHARE) {
    flags.push(`low contrast${m.lowest_contrast != null ? `, ${m.lowest_contrast}:1` : ""}`);
  }
  return flags;
}

export function DeckResults({ result }: { result: DeckAnalysis }) {
  const { summary, measurements, slides } = result;

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Slide score</CardTitle>
          <CardDescription>
            Read by {result.model} slide by slide and measured from the PDF, against a fixed rubric
            with levels from 0 to 4.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {summary?.slide_score != null ? (
            <>
              <Score value={summary.slide_score} />
              {!!summary.criteria.length && <CriteriaList criteria={summary.criteria} />}
              {result.topic_slides && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Where each expected topic is explained</h3>
                  <ul className="flex flex-wrap gap-2 text-sm">
                    {Object.entries(result.topic_slides).map(([topic, numbers]) => (
                      <li key={topic}>
                        <Badge variant={numbers.length ? "outline" : "destructive"} className="tabular-nums">
                          {topic}: {numbers.length ? `slide ${numbers.join(", ")}` : "on no slide"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
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
              {!!summary.feedback.length && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">What to improve</h3>
                  <ul className="flex flex-col gap-2 text-sm">
                    {summary.feedback.map((item) => (
                      <li key={`${item.slide}-${item.text}`} className="flex items-start gap-2">
                        {item.slide != null && (
                          <Badge variant="outline" className="tabular-nums">
                            Slide {item.slide}
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
            <p className="text-muted-foreground text-sm">Gemma did not return a usable score for this deck.</p>
          )}
          <ScoreNotes>
            <li>
              The score rates how the deck presents the idea. It does not rate the business idea or its
              investment potential.
            </li>
            <li>
              Gemma reads each slide for its title, its point and its topics. Text size, word count,
              fonts and contrast come from the PDF. The contrast limit is WCAG 2.2, written for the web,
              so it is a lower bound for a projector; the other limits are conventions.
            </li>
            <li>The score has not been validated against jury decisions or funding outcomes.</li>
            {!result.text_layer && (
              <li>
                This PDF has no text layer, so text size, word count and contrast were not measured.
                Export the deck as a PDF with selectable text to get them.
              </li>
            )}
            {result.pages_analyzed < result.page_count && (
              <li>
                Only the first {result.pages_analyzed} of {result.page_count} pages were analyzed.
              </li>
            )}
          </ScoreNotes>
        </CardContent>
      </Card>

      {measurements && (
        <Card>
          <CardHeader>
            <CardTitle>Deck at a glance</CardTitle>
            <CardDescription>Measured from the PDF</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Stat label="Slides" value={String(result.page_count)} />
            <Stat
              label="Words per slide"
              value={String(measurements.words_median)}
              hint={`median; the fullest slide has ${measurements.words_max}`}
            />
            <Stat
              label="Smallest text"
              value={`${measurements.smallest_text_pct}%`}
              hint="of the slide height; 3.3% is 18 pt on a standard slide"
            />
            <Stat
              label="Fonts"
              value={String(measurements.fonts.length)}
              hint={measurements.fonts.join(", ")}
            />
          </CardContent>
        </Card>
      )}

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Slide by slide</CardTitle>
          <CardDescription>What Gemma read on each slide</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {slides.map((slide) => {
            const o = slide.observations;
            return (
              <div key={slide.number} className="flex items-start gap-4 border-b pb-4 last:border-0 last:pb-0">
                {slide.thumbnail && (
                  // A data URL made by the analysis service: there is nothing for next/image to optimise
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.thumbnail}
                    alt={`Slide ${slide.number}`}
                    className="h-auto w-24 shrink-0 rounded-md border sm:w-36"
                  />
                )}
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">Slide {slide.number}</span>
                    {o?.title && <span className="text-sm">{o.title}</span>}
                    {slideFlags(slide).map((flag) => (
                      <Badge key={flag} variant="outline">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                  {o ? (
                    <>
                      {o.message && <p className="text-muted-foreground text-xs">Point: {o.message}</p>}
                      {o.observations && <p className="text-sm">{o.observations}</p>}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">Gemma&apos;s reply for this slide did not parse.</p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
