import assert from "node:assert/strict";
import test from "node:test";
import { groupBacklogByGoal, selectPlannableDays } from "./planningBacklog.ts";

const task = (id, objectiveId = null, objectiveTitle = null) => ({ id, title: id, description: null, date: null, status: "planned", objectiveId, objectiveTitle });

test("backlog is grouped by goal, tasks without goal last", () => {
  const groups = groupBacklogByGoal([task("a"), task("b", "g1", "Proba"), task("c", "g2", "Anglais"), task("d", "g1", "Proba")]);
  assert.deepEqual(groups.map((group) => [group.title, group.tasks.map((entry) => entry.id)]), [["Proba", ["b", "d"]], ["Anglais", ["c"]], [null, ["a"]]]);
});

test("plan chips skip past days, unless the whole week is past", () => {
  const days = ["2026-11-02", "2026-11-03", "2026-11-04"].map((date) => ({ date, tasks: [], recap: null, deadlines: [] }));
  assert.deepEqual(selectPlannableDays(days, "2026-11-03").map((day) => day.date), ["2026-11-03", "2026-11-04"]);
  assert.equal(selectPlannableDays(days, "2026-12-01").length, 3);
});
