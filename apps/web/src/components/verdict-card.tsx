"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScoreNotes } from "@/components/result-parts";
import type { PitchCheck } from "@/lib/analysis";
import { buildVerdict, download } from "@/lib/verdict";

export function VerdictCard({ check }: { check: PitchCheck }) {
  const [team, setTeam] = useState("");
  const [event, setEvent] = useState("");

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Hand in the verdict, keep the files</CardTitle>
        <CardDescription>
          For an event that asks for your result and not for your recording or your deck.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-sm">
          The verdict holds your two scores, the level behind each criterion and the short summary of
          what you build. Your recording, your deck, the feedback and the notes on this page are not
          in it. It carries a fingerprint of both files, so the organizer can check later that the
          files you show are the ones that were scored.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Team</span>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Optional" maxLength={80} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Event</span>
            <Input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Optional" maxLength={80} />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => download("pitchcheck-verdict.json", buildVerdict(check, team, event).verdict)}>
            <Download aria-hidden="true" /> Download verdict
          </Button>
          <Button variant="outline" onClick={() => download("pitchcheck-proof.json", buildVerdict(check, team, event).proof)}>
            <Download aria-hidden="true" /> Download proof
          </Button>
        </div>
        <ScoreNotes>
          <li>
            Send the verdict. Keep the proof: it opens the fingerprints. Hand it over only together
            with the recording and the deck, when the organizer asks to check them.
          </li>
          <li>
            A fingerprint does not stop anyone from editing a verdict. It makes an edit show up when
            the files are checked and analyzed again.
          </li>
          <li>The summary in the verdict says what you build, so it is not an empty envelope.</li>
        </ScoreNotes>
      </CardContent>
    </Card>
  );
}
