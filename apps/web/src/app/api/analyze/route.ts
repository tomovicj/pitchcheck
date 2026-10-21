import { proxyUpload } from "@/lib/proxy-upload";

// The recording alone: field `file`
export async function POST(request: Request) {
  return proxyUpload(request, "/analyze/stream");
}
