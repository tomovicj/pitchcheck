import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

// Uses node:http rather than fetch: fetch (undici) buffers a streamed request body in memory,
// which for large video uploads means holding the whole file. node:http respects backpressure.
// node:https is needed when the audio service sits behind an HTTPS tunnel, e.g. on Kaggle.
// pipe() rather than pipeline(): a failed request must not cancel the upload, see discard().
function forward(url: string, contentType: string, upload: Readable) {
  const client = new URL(url).protocol === "https:" ? https : http;
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = client.request(url, { method: "POST", headers: { "content-type": contentType } });
    req.on("response", resolve);
    req.on("error", reject);
    upload.on("error", (error) => req.destroy(error));
    upload.pipe(req);
  });
}

// Browsers report an error reply that arrives while they are still uploading as a network error,
// so read the rest of the upload before replying.
async function discard(upload: Readable) {
  upload.unpipe();
  upload.resume();
  await finished(upload).catch(() => {});
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

// Streams a multipart upload to one of the analysis service's /stream endpoints and relays its
// NDJSON progress events and result.
export async function proxyUpload(request: Request, path: string) {
  const audioServiceUrl = process.env.AUDIO_SERVICE_URL ?? "http://localhost:8000";

  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data") || !request.body) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  const upload = Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>);
  let res: http.IncomingMessage;
  try {
    res = await forward(`${audioServiceUrl}${path}`, contentType, upload);
  } catch {
    await discard(upload);
    return Response.json({ error: "Analysis service is unreachable" }, { status: 502 });
  }

  const status = res.statusCode ?? 502;
  if (status >= 400) {
    const [detail] = await Promise.all([readJson(res), discard(upload)]);
    // Cloudflare answers 530 with an HTML page when the tunnel has nothing behind it.
    // A 404 means the service is up but older than this app and has no such endpoint.
    const error =
      status === 530
        ? "Analysis service is unreachable"
        : status === 404
          ? "The analysis service is an older version without this check. Update it and try again."
          : typeof detail?.detail === "string"
            ? detail.detail
            : "Analysis failed";
    return Response.json({ error }, { status: status === 530 ? 502 : status });
  }

  // NDJSON progress events followed by the result; no-transform stops compression from buffering it
  return new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
