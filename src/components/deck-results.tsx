"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Checklist,
  CriteriaList,
  Score,
  ScoreNotes,
  ShowMore,
  Stat,
  Subscores,
  weakest,
} from "@/components/result-parts";
import type { DeckAnalysis, Slide } from "@/lib/analysis";

// The limits the service flags a slide by; keep in step with services/audio/app/deck.py
const SMALL_TEXT_SHARE = 1 / 3;
const DENSE_WORDS = 40;
const LOW_CONTRAST_SHARE = 0.1;
// Feedback items shown before "Show more"
const FIRST_FIXES = 3;

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

function Feedback({ items }: { items: DeckAnalysis["summary"]["feedback"] }) {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((item) => (
        <li key={`${item.slide}-${item.text}`} className="flex items-start gap-2">
          {item.slide != null && (
            <Badge variant="outline" className="tabular-nums">
              Slide {item.slide}
            </Badge>
          )}
          <span>
            {item.criterion && <span className="font-medium">{item.criterion}: </span>}
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DeckResults({ result }: { result: DeckAnalysis }) {
  const [open, setOpen] = useState(false);
  const { summary, measurements, slides } = result;

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Slide score</CardTitle>
          <CardDescription>
            What the deck says and how it is designed, against Y Combinator&apos;s advice on pitch decks.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {summary.slide_score != null ? (
            <Score value={summary.slide_score} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Gemma did not return what is needed to score this deck. What could be measured is below.
            </p>
          )}
          <Subscores subscores={summary.subscores} />
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Fix first</h3>
            {summary.feedback.length ? (
              <Feedback items={summary.feedback.slice(0, FIRST_FIXES)} />
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {weakest(summary.criteria, FIRST_FIXES).map((c) => (
                  <li key={c.name}>
                    <span className="font-medium">{c.name}:</span> {c.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ShowMore open={open} onToggle={() => setOpen(!open)} controls="deck-details" />
          {open && (
            <div id="deck-details" className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-medium">How the score is built</h3>
                <CriteriaList criteria={summary.criteria} />
              </div>
              {!!summary.checklist.length && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium">What a deck is expected to say</h3>
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
              {summary.feedback.length > FIRST_FIXES && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">More to improve</h3>
                  <Feedback items={summary.feedback.slice(FIRST_FIXES)} />
                </div>
              )}
              <ScoreNotes>
                <li>
                  The score rates what the deck says and how it is designed. It does not rate the business
                  idea or its investment potential.
                </li>
                <li>
                  The two halves count the same. The expected topics and most standards are Y
                  Combinator&apos;s advice to founders; the limits that turn them into levels are this
                  rubric&apos;s own, and none is checked on real decks.
                </li>
                <li>
                  Gemma ({result.model}) reads each slide and names the line behind each expected topic; a
                  topic with no line counts as missing. Text size, word count, fonts, contrast and where the
                  largest text sits come from the PDF, and every level is arithmetic.
                </li>
                <li>Marketing words are counted from a short fixed list, in English only.</li>
                <li>The score has not been validated against jury decisions or funding outcomes.</li>
                {!result.text_layer && (
                  <li>
                    This PDF has no text layer, so text size, word count, contrast and consistency were not
                    measured. Export the deck as a PDF with selectable text to get them.
                  </li>
                )}
                {result.pages_analyzed < result.page_count && (
                  <li>
                    Only the first {result.pages_analyzed} of {result.page_count} pages were analyzed.
                  </li>
                )}
              </ScoreNotes>
            </div>
          )}
        </CardContent>
      </Card>

      {open && measurements && (
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
              hint="of the slide height; 4.4% is 24 pt on a standard slide"
            />
            <Stat label="Fonts" value={String(measurements.fonts.length)} hint={measurements.fonts.join(", ")} />
          </CardContent>
        </Card>
      )}

      {open && (
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
      )}
    </div>
  );
}
