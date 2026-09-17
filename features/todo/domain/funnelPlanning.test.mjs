import assert from "node:assert/strict";
import test from "node:test";
import { planFunnelTask, taskPlanDuration } from "./funnelPlanning.ts";

const task = { startTime: null, endTime: null, estimatedMinutes: 90 };

test("placing an undated task uses its duration and leaves the estimate untouched", () => {
  assert.deepEqual(planFunnelTask(task, "2026-09-17", "10:30"), { date: "2026-09-17", startTime: "10:30", endTime: "12:00" });
  assert.equal(task.estimatedMinutes, 90);
});

test("rescheduling preserves the scheduled duration even when the estimate differs", () => {
  assert.equal(taskPlanDuration({ ...task, startTime: "08:00", endTime: "08:45" }), 45);
  assert.equal(planFunnelTask({ ...task, startTime: "08:00", endTime: "08:45" }, "2026-09-18", "13:00").endTime, "13:45");
});

test("all-day placement clears old hours without inventing a 09:00 appointment", () => {
  assert.deepEqual(planFunnelTask({ ...task, startTime: "08:00", endTime: "09:30" }, "2026-09-19", null), { date: "2026-09-19", startTime: null, endTime: null });
});

test("late placement stays within its civil day and invalid times are rejected", () => {
  assert.equal(planFunnelTask(task, "2026-09-17", "23:30").endTime, "23:59");
  assert.equal(planFunnelTask({ ...task, estimatedMinutes: 0 }, "2026-09-17", "10:00").endTime, "11:00");
  for (const time of ["", "24:00", "09:90", "23:59"]) assert.throws(() => planFunnelTask(task, "2026-09-17", time));
});
