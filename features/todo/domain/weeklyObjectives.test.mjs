import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyObjectiveRows, scheduledWorkMinutes } from "./weeklyObjectives.ts";

const week = { weekId: "2026-W40", firstDate: "2026-09-28", lastDate: "2026-10-04", selectedObjectiveId: "" };
const objective = { id: "course", title: "Finish course", horizon: "week", weekId: "2026-W40" };
const task = { id: "read", title: "Read notes", objectiveId: "course", date: null, startTime: null, endTime: null, estimatedMinutes: 90, status: "planned" };

test("a new weekly objective appears before its first action and other weeks stay out", () => {
  const rows = buildWeeklyObjectiveRows({ ...week, tasks: [], objectives: [objective, { ...objective, id: "next", weekId: "2026-W41" }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tasks.length, 0);
});

test("a broader objective appears when scheduled this week; cancelled actions never affect progress", () => {
  const rows = buildWeeklyObjectiveRows({ ...week, objectives: [{ ...objective, horizon: "month", weekId: null }], tasks: [task, { ...task, id: "work", date: "2026-10-01", startTime: "09:00", endTime: "10:00", status: "done" }, { ...task, id: "cancelled", status: "cancelled" }] });
  assert.equal(rows[0].tasks.length, 2);
  assert.equal(rows[0].completedTasks, 1);
  assert.equal(rows[0].scheduledTasks, 1);
  assert.equal(rows[0].scheduledMinutes, 60);
});

test("all-day actions count as planned without claiming hourly work; dates are inclusive", () => {
  const rows = buildWeeklyObjectiveRows({ ...week, objectives: [objective], tasks: [
    { ...task, date: week.firstDate },
    { ...task, id: "last", date: week.lastDate, startTime: "13:00", endTime: "14:30" },
    { ...task, id: "later", date: "2026-10-05", startTime: "13:00", endTime: "14:30" }
  ] });
  assert.equal(rows[0].scheduledTasks, 2);
  assert.equal(rows[0].scheduledMinutes, 90);
});

test("selecting an existing objective exposes its unscheduled actions", () => {
  const rows = buildWeeklyObjectiveRows({ ...week, selectedObjectiveId: "course", objectives: [{ ...objective, horizon: "year", weekId: null }], tasks: [task] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].tasks[0].id, "read");
});

test("legacy weekly objectives without a week identifier use their target date", () => {
  const rows = buildWeeklyObjectiveRows({ ...week, objectives: [{ ...objective, weekId: null, targetDate: "2026-10-04" }], tasks: [] });
  assert.equal(rows.length, 1);
});

test("planned daily work sums scheduled intervals and requires known working hours", () => {
  const minutes = [
    { startTime: "08:30", endTime: "10:00" },
    { startTime: "13:00", endTime: "13:45" },
    { startTime: null, endTime: null },
    { startTime: "16:00", endTime: null }
  ].reduce((total, scheduledTask) => total + scheduledWorkMinutes(scheduledTask), 0);
  assert.equal(minutes, 135);
});
