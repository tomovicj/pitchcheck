import type { AnalysisEvent, ProgressStage } from "@/lib/analysis";

const UPLOAD_STALL_MS = 60_000;

// XMLHttpRequest exposes upload progress and incremental response text. Fetch only exposed the
// response, leaving the page at 0% until the entire upload reached the analysis service.
export function runAnalysis<Result>(
  endpoint: string,
  body: FormData,
  onProgress: (stage: ProgressStage, progress: number) => void,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let offset = 0;
    let buffer = "";
    let settled = false;
    let uploadTimer: ReturnType<typeof setTimeout> | undefined;

    function fail(message: string) {
      if (settled) return;
      settled = true;
      clearTimeout(uploadTimer);
      reject(new Error(message));
      request.abort();
    }

    function watchUpload() {
      clearTimeout(uploadTimer);
      uploadTimer = setTimeout(() => {
        fail("The upload stopped making progress. Check your connection and make sure your files are downloaded to this device, then try again.");
      }, UPLOAD_STALL_MS);
    }

    function readResponse(final = false) {
      if (settled || request.status < 200 || request.status >= 300) return;
      buffer += request.responseText.slice(offset);
      offset = request.responseText.length;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (final && buffer.trim()) {
        lines.push(buffer);
        buffer = "";
      }

      try {
        for (const line of lines) {
          if (!line.trim()) continue; // Blank keepalive lines arrive during long Gemma calls.
          const event = JSON.parse(line) as AnalysisEvent<Result>;
          if (event.type === "progress") onProgress(event.stage, event.progress);
          else if (event.type === "error") {
            fail(event.message);
            return;
          } else if (event.type === "result") {
            settled = true;
            clearTimeout(uploadTimer);
            resolve(event.data);
            return;
          }
        }
      } catch {
        fail("The analysis service returned an unreadable response. Please try again.");
      }
    }

    request.open("POST", endpoint);
    request.upload.onprogress = (event) => {
      if (settled) return;
      watchUpload();
      if (event.lengthComputable) onProgress("uploading", event.loaded / event.total);
    };
    request.upload.onload = () => {
      clearTimeout(uploadTimer);
      if (!settled) onProgress("preparing", 0);
    };
    request.onprogress = () => readResponse();
    request.onload = () => {
      clearTimeout(uploadTimer);
      if (settled) return;
      if (request.status < 200 || request.status >= 300) {
        let message = "Analysis failed";
        try {
          const data = JSON.parse(request.responseText);
          if (typeof data?.error === "string") message = data.error;
        } catch {
          // A proxy can return an HTML error instead of JSON.
        }
        fail(message);
        return;
      }
      readResponse(true);
      if (!settled) fail("Analysis ended without a result");
    };
    request.onerror = () => fail("Could not reach PitchCheck. Check your connection and try again.");
    request.onabort = () => fail("The upload or analysis was interrupted. Please try again.");

    onProgress("uploading", 0);
    watchUpload();
    try {
      request.send(body);
    } catch {
      fail("Could not read your files. Make sure they are downloaded to this device and try again.");
    }
  });
}
