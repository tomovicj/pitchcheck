export async function POST(request: Request) {
  const audioServiceUrl = process.env.AUDIO_SERVICE_URL ?? "http://localhost:8000";

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No audio file uploaded" }, { status: 400 });
  }

  const body = new FormData();
  body.append("file", file, file.name);

  let res: Response;
  try {
    res = await fetch(`${audioServiceUrl}/analyze/stream`, { method: "POST", body });
  } catch {
    return Response.json({ error: "Audio service is unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    return Response.json(
      { error: detail?.detail ?? "Analysis failed" },
      { status: res.status },
    );
  }

  // NDJSON progress events followed by the result; no-transform stops compression from buffering it
  return new Response(res.body, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
