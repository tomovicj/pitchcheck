import type { AnalysisSetup, Criterion, PitchCheck } from "@/lib/analysis";

// What a team hands to the organizer in place of its recording and deck: the two scores with the
// levels behind them, a short summary, and a fingerprint of each file. The feedback, the timeline
// and the slide notes stay with the team.
export type Verdict = {
  format: "pitchcheck-verdict/1";
  created: string;
  team: string;
  event: string;
  summary: string;
  pitch: {
    score: number | null;
    criteria: Criterion[];
    duration_s: number;
    time_limit_s: number | null;
    file: { sha256: string; bytes: number };
  };
  deck: {
    score: number | null;
    criteria: Criterion[];
    slides: number;
    file: { sha256: string; bytes: number };
  };
  alignment: { coverage_level: number; deck_points: number; unexplained: number; contradictions: number } | null;
  setup: AnalysisSetup;
};

// The salts that open the fingerprints. The team keeps this file and shows it together with the
// recording and the deck when the organizer asks to check them.
export type Proof = {
  format: "pitchcheck-proof/1";
  created: string;
  recording: { salt: string };
  deck: { salt: string };
};

export function buildVerdict(check: PitchCheck, team: string, event: string): { verdict: Verdict; proof: Proof } {
  const created = new Date().toISOString();
  const { pitch, deck, alignment } = check;
  return {
    verdict: {
      format: "pitchcheck-verdict/1",
      created,
      team: team.trim(),
      event: event.trim(),
      summary: alignment?.summary ?? "",
      pitch: {
        score: pitch.summary?.pitch_score ?? null,
        criteria: pitch.summary?.criteria ?? [],
        duration_s: pitch.duration_s,
        time_limit_s: pitch.time_limit_s ?? null,
        file: { sha256: pitch.file.sha256, bytes: pitch.file.bytes },
      },
      deck: {
        score: deck.summary?.slide_score ?? null,
        criteria: deck.summary?.criteria ?? [],
        slides: deck.page_count,
        file: { sha256: deck.file.sha256, bytes: deck.file.bytes },
      },
      alignment: alignment && {
        coverage_level: alignment.coverage_level,
        deck_points: alignment.deck_points,
        unexplained: alignment.unexplained.length,
        contradictions: alignment.contradictions.length,
      },
      setup: pitch.setup,
    },
    proof: {
      format: "pitchcheck-proof/1",
      created,
      recording: { salt: pitch.file.salt },
      deck: { salt: deck.file.salt },
    },
  };
}

export function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return bytes;
}

// Whether SHA-256(salt + file) is the fingerprint in the verdict. Reads the whole file into memory.
export async function matchesFingerprint(file: File, salt: string, sha256: string) {
  if (!/^([0-9a-f]{2})+$/i.test(salt)) return false;
  const digest = await crypto.subtle.digest("SHA-256", await new Blob([fromHex(salt), file]).arrayBuffer());
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex === sha256.toLowerCase();
}

export function isVerdict(value: unknown): value is Verdict {
  const v = value as Verdict | null;
  return !!v && v.format === "pitchcheck-verdict/1" && !!v.pitch?.file?.sha256 && !!v.deck?.file?.sha256 && !!v.setup;
}

export function isProof(value: unknown): value is Proof {
  const p = value as Proof | null;
  return !!p && p.format === "pitchcheck-proof/1" && typeof p.recording?.salt === "string" && typeof p.deck?.salt === "string";
}
