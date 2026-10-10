import http from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

// Uses node:http rather than fetch: fetch (undici) buffers a streamed request body in memory,
// which for large video uploads means holding the whole file. node:http respects backpressure.
function forward(url: string, contentType: string, body: ReadableStream<Uint8Array>) {
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = http.request(url, { method: "POST", headers: { "content-type": contentType } });
    req.on("response", resolve);
    req.on("error", reject);
    pipeline(Readable.fromWeb(body as NodeReadableStream<Uint8Array>), req).catch(reject);
  });
}

async function readJson(res: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of res) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const audioServiceUrl = process.env.AUDIO_SERVICE_URL ?? "http://localhost:8000";

  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data") || !request.body) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  let res: http.IncomingMessage;
  try {
    res = await forward(`${audioServiceUrl}/analyze/stream`, contentType, request.body);
  } catch {
    return Response.json({ error: "Audio service is unreachable" }, { status: 502 });
  }

  const status = res.statusCode ?? 502;
  if (status >= 400) {
    const detail = await readJson(res);
    return Response.json({ error: detail?.detail ?? "Analysis failed" }, { status });
  }

  // NDJSON progress events followed by the result; no-transform stops compression from buffering it
  return new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
