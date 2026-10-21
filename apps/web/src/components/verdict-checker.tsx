"use client";

import { useState } from "react";
import { Check, Loader2, Minus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CriteriaList, Score, ScoreNotes, formatTime } from "@/components/result-parts";
import type { AnalysisSetup } from "@/lib/analysis";
import { type Proof, type Verdict, isProof, isVerdict, matchesFingerprint } from "@/lib/verdict";

type Finding = { label: string; state: "match" | "mismatch" | "skipped"; detail: string };

async function readJson(file: File): Promise<unknown> {
  try {
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

async function checkFile(label: string, file: File | null, salt: string | undefined, sha256: string): Promise<Finding> {
  if (!file) return { label, state: "skipped", detail: "No file given, so nothing was compared." };
  if (!salt) return { label, state: "skipped", detail: "Add the proof file to compare this file with the verdict." };
  return (await matchesFingerprint(file, salt, sha256))
    ? { label, state: "match", detail: "This is the file the verdict was made for." }
    : { label, state: "mismatch", detail: "This is not the file the verdict was made for, or the verdict or the proof was changed." };
}

async function checkSetup(verdict: Verdict): Promise<Finding> {
  const label = "Analysis setup";
  const res = await fetch("/api/health").catch(() => null);
  const setup: AnalysisSetup | undefined = res?.ok ? (await res.json().catch(() => null))?.setup : undefined;
  if (!setup) return { label, state: "skipped", detail: "The analysis service here could not be reached, so the setups were not compared." };
  const differences = (["model", "dtype", "slide_tokens", "topics", "code_sha256"] as const)
    .filter((key) => String(setup[key]) !== String(verdict.setup[key]))
    .map((key) => (key === "code_sha256" ? "prompts and rubrics" : key === "slide_tokens" ? "slide detail" : key === "topics" ? "expected topics" : key));
  return differences.length
    ? { label, state: "mismatch", detail: `The verdict was made with a different setup than this one: ${differences.join(", ")}. A re-run here is not expected to give the same scores.` }
    : { label, state: "match", detail: "The verdict was made with the same model, prompts and rubrics as this installation." };
}

const STATE_ICON = { match: Check, mismatch: X, skipped: Minus };

export function VerdictChecker() {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [proof, setProof] = useState<Proof | null>(null);
  const [recording, setRecording] = useState<File | null>(null);
  const [deck, setDeck] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [findings, setFindings] = useState<Finding[] | null>(null);

  async function loadVerdict(file: File | undefined) {
    setFindings(null);
    const value = file ? await readJson(file) : null;
    setVerdict(isVerdict(value) ? value : null);
    setError(file && !isVerdict(value) ? "This is not a PitchCheck verdict file." : null);
  }

  async function loadProof(file: File | undefined) {
    setFindings(null);
    const value = file ? await readJson(file) : null;
    setProof(isProof(value) ? value : null);
    setError(file && !isProof(value) ? "This is not a PitchCheck proof file." : null);
  }

  async function check() {
    if (!verdict) return;
    setChecking(true);
    try {
      setFindings([
        await checkFile("Recording", recording, proof?.recording.salt, verdict.pitch.file.sha256),
        await checkFile("Deck", deck, proof?.deck.salt, verdict.deck.file.sha256),
        await checkSetup(verdict),
      ]);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="analysis-results grid min-w-0 gap-5">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>The files</CardTitle>
          <CardDescription>
            Nothing is uploaded on this page. The files are read and compared in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Verdict</span>
              <Input type="file" accept="application/json,.json" onChange={(e) => loadVerdict(e.target.files?.[0])} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Proof, from the team</span>
              <Input type="file" accept="application/json,.json" onChange={(e) => loadProof(e.target.files?.[0])} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Recording the team shows</span>
              <Input
                type="file"
                accept="audio/*,video/*"
                onChange={(e) => {
                  setRecording(e.target.files?.[0] ?? null);
                  setFindings(null);
                }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Deck the team shows</span>
              <Input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                  setDeck(e.target.files?.[0] ?? null);
                  setFindings(null);
                }}
              />
            </label>
          </div>
          {error && <p className="checker-error" role="alert">{error}</p>}
          <div>
            <Button onClick={check} disabled={!verdict || checking}>
              {checking && <Loader2 className="animate-spin" aria-hidden="true" />}
              {checking ? "Checking…" : "Check the verdict"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {findings && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>What the check found</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ul className="flex flex-col gap-3 text-sm">
              {findings.map((finding) => {
                const Icon = STATE_ICON[finding.state];
                return (
                  <li key={finding.label} className="flex items-start gap-3" data-state={finding.state}>
                    <span className={`verdict-state verdict-${finding.state}`}><Icon aria-hidden="true" /></span>
                    <span>
                      <span className="font-medium">{finding.label}:</span> {finding.detail}
                    </span>
                  </li>
                );
              })}
            </ul>
            <ScoreNotes>
              <li>
                A matching file shows that the verdict was made for that file. It does not show that
                the scores in the verdict are the ones the analysis gave.
              </li>
              <li>
                To check the scores, analyze the same recording and deck on the main page and compare.
                With the same setup the scores should be close; on different hardware they are not
                always identical.
              </li>
            </ScoreNotes>
          </CardContent>
        </Card>
      )}

      {verdict && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{verdict.team || "Verdict"}</CardTitle>
            <CardDescription>
              {[verdict.event, `made ${new Date(verdict.created).toLocaleString()}`, verdict.setup.model].filter(Boolean).join(" · ")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {verdict.summary && <p className="text-sm">{verdict.summary}</p>}
            <div className="grid gap-8 md:grid-cols-2">
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">
                  Pitch · {formatTime(verdict.pitch.duration_s)}
                  {verdict.pitch.time_limit_s ? ` of ${formatTime(verdict.pitch.time_limit_s)}` : ""}
                </h3>
                {verdict.pitch.score != null && <Score value={verdict.pitch.score} />}
                <CriteriaList criteria={verdict.pitch.criteria} />
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="text-sm font-medium">Slides · {verdict.deck.slides}</h3>
                {verdict.deck.score != null && <Score value={verdict.deck.score} />}
                <CriteriaList criteria={verdict.deck.criteria} />
              </div>
            </div>
            {verdict.alignment && (
              <p className="text-sm">
                <span className="font-medium">Talk against deck:</span>{" "}
                {verdict.alignment.deck_points - verdict.alignment.unexplained} of {verdict.alignment.deck_points} key
                points of the slides are explained in the talk; {verdict.alignment.contradictions}{" "}
                {verdict.alignment.contradictions === 1 ? "place" : "places"} where the two disagree.
              </p>
            )}
            <ScoreNotes>
              <li>The scores rate the delivery and the deck. They do not rate the business idea.</li>
              <li>The scores have not been validated against jury decisions or funding outcomes. Use them as one input to a decision a person makes.</li>
            </ScoreNotes>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
