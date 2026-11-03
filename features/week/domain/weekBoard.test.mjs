import assert from "node:assert/strict";
import test from "node:test";
import { defaultCaptureDate, moveTaskOnBoard, nextCheckboxStatus, shiftDestination, summarizeDays, updateTaskOnBoard } from "./weekBoard.ts";

const task = (id, date, status = "planned") => ({ id, title: id, description: null, date, status, objectiveId: null, objectiveTitle: null });

function board() {
  const days = ["2026-11-02", "2026-11-03", "2026-11-04"].map((date) => ({ date, tasks: [], recap: null }));
  days[0].tasks = [task("a", "2026-11-02", "done"), task("b", "2026-11-02")];
  return { weekId: "2026-W45", previousWeekId: "2026-W44", nextWeekId: "2026-W46", today: "2026-11-03", days, inbox: [task("c", null)], recap: null, summary: summarizeDays(days) };
}

test("checkbox toggles done and reopens dropped tasks", () => {
  assert.equal(nextCheckboxStatus("planned"), "done");
  assert.equal(nextCheckboxStatus("done"), "planned");
  assert.equal(nextCheckboxStatus("not_done"), "planned");
});

test("moving a task updates both columns and the summary", () => {
  const moved = moveTaskOnBoard(board(), "b", { kind: "day", date: "2026-11-04" });
  assert.deepEqual(moved.days[0].tasks.map((entry) => entry.id), ["a"]);
  assert.deepEqual(moved.days[2].tasks.map((entry) => entry.id), ["b"]);
  assert.equal(moved.days[2].tasks[0].date, "2026-11-04");

  const scheduled = moveTaskOnBoard(moved, "c", { kind: "day", date: "2026-11-03" });
  assert.equal(scheduled.inbox.length, 0);
  assert.equal(scheduled.summary.planned, 3);

  const unscheduled = moveTaskOnBoard(scheduled, "a", { kind: "inbox" });
  assert.deepEqual(unscheduled.inbox.map((entry) => entry.id), ["a"]);
  assert.equal(unscheduled.inbox[0].date, null);
  assert.equal(unscheduled.summary.done, 0);
});

test("summary counts done, dropped and open tasks", () => {
  const updated = updateTaskOnBoard(board(), "b", { status: "not_done" });
  assert.deepEqual(updated.summary, { planned: 2, done: 1, dropped: 1, open: 0, completionRate: 0.5 });
});

test("day shifting stays inside the displayed week", () => {
  const current = board();
  assert.deepEqual(shiftDestination(current, current.days[0].tasks[1], 1), { kind: "day", date: "2026-11-03" });
  assert.equal(shiftDestination(current, current.days[0].tasks[1], -1), null);
});

test("capture defaults to today when visible", () => {
  assert.equal(defaultCaptureDate(board()), "2026-11-03");
  assert.equal(defaultCaptureDate({ ...board(), today: "2026-12-01" }), "2026-11-02");
});
