import assert from "node:assert/strict";
import test from "node:test";
import { buildNativeReadTimeout } from "./nativeReadTimeout.ts";
import { AI_REQUEST_TIMEOUT_MS } from "../lib/aiRequestTimeout.ts";

const readTimeout = buildNativeReadTimeout(AI_REQUEST_TIMEOUT_MS);

test("AI requests wait longer than the API generation limit on the phone", () => {
  for (const path of ["/api/insights/ask", "/api/insights/decompose", "/api/assistant/preview"]) assert.equal(readTimeout(path, false), AI_REQUEST_TIMEOUT_MS);
  assert.ok(AI_REQUEST_TIMEOUT_MS > 600_000);
});

test("other paths keep short or dedicated limits", () => {
  assert.equal(readTimeout("/api/insights/patterns?from=2026-10-01", false), 15_000);
  assert.equal(readTimeout("/api/ai-providers/test", false), 30_000);
  assert.equal(readTimeout("/api/tasks", true), 610_000);
  assert.equal(readTimeout("/api/transcription-jobs/abc", false), 610_000);
  assert.equal(readTimeout("/api/tasks", false), 15_000);
});
