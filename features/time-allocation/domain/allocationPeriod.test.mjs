import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalAllocationAnchor,
  getAllocationPeriodRange,
  shiftAllocationPeriod
} from "./allocationPeriod.ts";

test("week anchors and shifts stay on ISO Mondays", () => {
  assert.equal(canonicalAllocationAnchor("week", "2026-08-13"), "2026-08-10");
  assert.equal(shiftAllocationPeriod("2026-08-10", "week", 1), "2026-08-17");
  assert.deepEqual(getAllocationPeriodRange("week", "2026-08-13"), {
    period: "week", anchor: "2026-08-10", start: "2026-08-10", end: "2026-08-16",
    endExclusive: "2026-08-17", maximumBudgetMinutes: 10_080
  });
});

test("month ranges and navigation follow the civil calendar", () => {
  const leapFebruary = getAllocationPeriodRange("month", "2028-02-20");
  assert.equal(leapFebruary.anchor, "2028-02-01");
  assert.equal(leapFebruary.end, "2028-02-29");
  assert.equal(leapFebruary.maximumBudgetMinutes, 29 * 1_440);
  assert.equal(shiftAllocationPeriod("2028-02-01", "month", 1), "2028-03-01");
});
