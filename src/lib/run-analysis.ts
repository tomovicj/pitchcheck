import type { AnalysisEvent, AnalysisStage } from "@/lib/analysis";

async function* readEvents<Result>(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as AnalysisEvent<Result>;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield JSON.parse(buffer) as AnalysisEvent<Result>;
  } finally {
    reader.releaseLock();
  }
}

// Uploads to one of the /api routes and follows its NDJSON stream to the result.
// Throws an Error whose message can be shown to the user.
export async function runAnalysis<Result>(
  endpoint: string,
  body: FormData,
  onProgress: (stage: AnalysisStage, progress: number) => void,
): Promise<Result> {
  const res = await fetch(endpoint, { method: "POST", body }).catch(() => {
    throw new Error("Could not reach PitchCheck. Check your connection and try again.");
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Analysis failed");
  }

  for await (const event of readEvents<Result>(res.body)) {
    if (event.type === "progress") onProgress(event.stage, event.progress);
    else if (event.type === "error") throw new Error(event.message);
    else return event.data;
  }
  throw new Error("Analysis ended without a result");
}
