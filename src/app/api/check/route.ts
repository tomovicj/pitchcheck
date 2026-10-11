import { proxyUpload } from "@/lib/proxy-upload";

// The recording and the deck together, compared with each other: fields `recording` and `deck`
export async function POST(request: Request) {
  return proxyUpload(request, "/check/stream");
}
