import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { runAnalysis } from "../src/lib/run-analysis.ts";

class Request {
  static latest;
  upload = {};
  status = 0;
  responseText = "";
  aborted = false;
  constructor() { Request.latest = this; }
  open(method, url) { this.method = method; this.url = url; }
  send(body) { this.body = body; }
  abort() { this.aborted = true; this.onabort?.(); }
  chunk(text) { this.status = 200; this.responseText += text; this.onprogress?.(); }
}

const originalRequest = globalThis.XMLHttpRequest;
beforeEach(() => { globalThis.XMLHttpRequest = Request; });
afterEach(() => { globalThis.XMLHttpRequest = originalRequest; });

for (const endpoint of ["/api/analyze", "/api/deck", "/api/check"]) {
  test(`${endpoint}: reports actual upload progress and streamed analysis`, async () => {
    const progress = [];
    const body = new FormData();
    const pending = runAnalysis(endpoint, body, (...event) => progress.push(event));
    const request = Request.latest;
    assert.equal(request.method, "POST");
    assert.equal(request.url, endpoint);
    assert.equal(request.body, body);
    request.upload.onprogress({ lengthComputable: true, loaded: 25, total: 100 });
    request.upload.onload();
    request.chunk('\n{"type":"progress","stage":"listening",');
    assert.deepEqual(progress, [["uploading", 0], ["uploading", 0.25], ["preparing", 0]]);
    request.chunk('"progress":0.05}\n\n{"type":"result","data":{"ok":true}}\n');
    assert.deepEqual(await pending, { ok: true });
    assert.deepEqual(progress.at(-1), ["listening", 0.05]);
    request.onload();
    assert.equal(request.aborted, false);
  });
}

test("accepts a final result without a trailing newline", async () => {
  const pending = runAnalysis("/api/analyze", new FormData(), () => {});
  const request = Request.latest;
  request.upload.onload();
  request.chunk('{"type":"result","data":42}');
  request.onload();
  assert.equal(await pending, 42);
});

test("keeps the service's HTTP error message", async () => {
  const pending = runAnalysis("/api/check", new FormData(), () => {});
  const request = Request.latest;
  request.status = 429;
  request.responseText = '{"error":"Another analysis is running"}';
  request.onload();
  await assert.rejects(pending, /Another analysis is running/);
});

test("rejects a streamed error and stops receiving the stream", async () => {
  const pending = runAnalysis("/api/deck", new FormData(), () => {});
  const request = Request.latest;
  request.upload.onload();
  request.chunk('{"type":"error","message":"Analysis failed"}\n');
  await assert.rejects(pending, /Analysis failed/);
  assert.equal(request.aborted, true);
});

test("rejects a stream that ends without a result", async () => {
  const pending = runAnalysis("/api/deck", new FormData(), () => {});
  const request = Request.latest;
  request.upload.onload();
  request.chunk('\n{"type":"progress","stage":"reading","progress":0.2}\n');
  request.onload();
  await assert.rejects(pending, /ended without a result/);
});

test("rejects malformed events without hanging the workspace", async () => {
  const pending = runAnalysis("/api/analyze", new FormData(), () => {});
  Request.latest.chunk('not JSON\n');
  await assert.rejects(pending, /unreadable response/);
});

test("rejects a network failure", async () => {
  const pending = runAnalysis("/api/analyze", new FormData(), () => {});
  Request.latest.onerror();
  await assert.rejects(pending, /Could not reach PitchCheck/);
});

test("times out a stalled upload, resetting the timer when bytes advance", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = runAnalysis("/api/analyze", new FormData(), () => {});
  const request = Request.latest;
  t.mock.timers.tick(59_000);
  assert.equal(request.aborted, false);
  request.upload.onprogress({ lengthComputable: true, loaded: 25, total: 100 });
  t.mock.timers.tick(59_000);
  assert.equal(request.aborted, false);
  t.mock.timers.tick(1_000);
  await assert.rejects(pending, /upload stopped making progress/);
  assert.equal(request.aborted, true);
});

test("does not impose an upload timeout on a long Gemma analysis", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = runAnalysis("/api/analyze", new FormData(), () => {});
  const request = Request.latest;
  request.upload.onload();
  t.mock.timers.tick(30 * 60_000);
  assert.equal(request.aborted, false);
  request.chunk('{"type":"result","data":true}\n');
  assert.equal(await pending, true);
});
