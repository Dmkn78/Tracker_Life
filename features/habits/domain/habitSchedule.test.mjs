import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRoutineEndDateTime,
  isScheduledOnDate,
  normalizeRecurrenceDays
} from "./habitSchedule.ts";

test("normalizes weekdays and preserves standard presets", () => {
  assert.deepEqual(normalizeRecurrenceDays([5, 1, 2, 2, 4, 3]), [1, 2, 3, 4, 5]);
  assert.deepEqual(normalizeRecurrenceDays([]), [1, 2, 3, 4, 5, 6, 7]);
});

test("matches recurring habits on ISO weekdays across Sunday", () => {
  assert.equal(isScheduledOnDate("2026-08-10", [1, 2, 3, 4, 5]), true);
  assert.equal(isScheduledOnDate("2026-08-09", [1, 2, 3, 4, 5]), false);
  assert.equal(isScheduledOnDate("2026-08-09", [7]), true);
});

test("routine duration can cross midnight", () => {
  assert.equal(formatRoutineEndDateTime("2026-08-09", "23:30", 90), "2026-08-10T01:00");
});
