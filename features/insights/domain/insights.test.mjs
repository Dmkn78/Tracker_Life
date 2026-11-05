import assert from "node:assert/strict";
import test from "node:test";
import { periodFromPreset } from "./insights.ts";

test("presets are inclusive ranges ending today, across months", () => {
  assert.deepEqual(periodFromPreset(7, "2026-11-03"), { from: "2026-10-28", to: "2026-11-03" });
  assert.deepEqual(periodFromPreset(28, "2026-03-01"), { from: "2026-02-02", to: "2026-03-01" });
});
