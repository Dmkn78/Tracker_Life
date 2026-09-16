import assert from "node:assert/strict";
import test from "node:test";
import { monthRange, monthWeeks, summarizeTasks, groupTasksByObjective, taskSlot } from "./todoPlanning.ts";

const task = (changes = {}) => ({ id: "one", title: "Deliver", status: "planned", completionPercent: 0, estimatedMinutes: 120, date: "2026-09-10", importance: "medium", ...changes });

test("monthly roadmap covers leap February and year boundaries with Monday weeks", () => {
  assert.deepEqual(monthRange("2024-02"), { start: "2024-02-01", end: "2024-02-29" });
  const weeks = monthWeeks("2026-12");
  assert.deepEqual(weeks[0], { start: "2026-11-30", end: "2026-12-06" });
  assert.deepEqual(weeks.at(-1), { start: "2026-12-28", end: "2027-01-03" });
});

test("remaining work uses progress while actual work never borrows estimates", () => {
  const summary = summarizeTasks([
    task({ completionPercent: 25, workSessions: [{ actualMinutes: 20 }, { actualMinutes: null }] }),
    task({ id: "done", status: "done", completionPercent: 0 }),
    task({ id: "cancelled", status: "cancelled", estimatedMinutes: 900, workSessions: [{ actualMinutes: 10 }] }),
    task({ id: "undated", date: null, estimatedMinutes: 0, importance: "high" })
  ], "2026-09-13");
  assert.equal(summary.total, 3);
  assert.equal(summary.completed, 1);
  assert.equal(summary.remainingMinutes, 90);
  assert.equal(summary.actualMinutes, 30);
  assert.equal(summary.plannedMinutes, 240);
  assert.equal(summary.missingEstimates, 1);
  assert.equal(summary.scheduledEarlier, 1);
  assert.equal(summary.undated, 1);
});

test("tasks retain a roadmap row when their objective is no longer in the selector", () => {
  const groups = groupTasksByObjective([task({ objectiveId: "archived", objectiveTitle: "Past project" }), task({ id: "two" })], [], "2026-09-13");
  assert.equal(groups.find((group) => group.id === "archived").title, "Past project");
  assert.equal(groups.reduce((sum, group) => sum + group.tasks.length, 0), 2);
});

test("calendar creation preserves the clicked date and does not cross midnight", () => {
  assert.deepEqual(taskSlot("2026-09-13", "23:30"), { date: "2026-09-13", startTime: "23:30", endTime: "23:59", estimatedMinutes: 29 });
  assert.equal(taskSlot("2026-09-13").estimatedMinutes, 0);
});
