import { proxyUpload } from "@/lib/proxy-upload";

// The PDF deck alone: field `file`
export async function POST(request: Request) {
  return proxyUpload(request, "/deck/stream");
}
