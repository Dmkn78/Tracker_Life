import assert from "node:assert/strict";
import test from "node:test";
import { findCustomPeriodProblem, periodFromPreset } from "./insights.ts";

test("presets are inclusive ranges ending today, across months", () => {
  assert.deepEqual(periodFromPreset(7, "2026-11-03"), { from: "2026-10-28", to: "2026-11-03" });
  assert.deepEqual(periodFromPreset(28, "2026-03-01"), { from: "2026-02-02", to: "2026-03-01" });
});

test("custom period: both dates, in order, at most one year", () => {
  assert.equal(findCustomPeriodProblem({ from: "2026-09-01", to: "2026-10-15" }), null);
  assert.equal(findCustomPeriodProblem({ from: "", to: "2026-10-15" }), "missing");
  assert.equal(findCustomPeriodProblem({ from: "2026-10-16", to: "2026-10-15" }), "reversed");
  assert.equal(findCustomPeriodProblem({ from: "2025-01-01", to: "2026-10-15" }), "too-long");
});
