// The analysis service's own description of itself: whether it is up, and the setup it rates with
export async function GET() {
  const audioServiceUrl = process.env.AUDIO_SERVICE_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${audioServiceUrl}/health`);
    return Response.json(await res.json(), { status: res.status });
  } catch {
    return Response.json({ error: "Analysis service is unreachable" }, { status: 502 });
  }
}
