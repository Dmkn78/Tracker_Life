import assert from "node:assert/strict";
import test from "node:test";
import { calculateWorkRatio, workRatioLevel } from "./dailyLog.ts";

test("work ratio is work divided by work plus distraction", () => {
  assert.equal(calculateWorkRatio(60, 60), 0.5);
  assert.equal(calculateWorkRatio(60, 0), 1);
  assert.equal(calculateWorkRatio(0, 0), null);
});

test("work ratio uses the four validated visual thresholds", () => {
  assert.equal(workRatioLevel(0.24), "red");
  assert.equal(workRatioLevel(0.25), "orange");
  assert.equal(workRatioLevel(0.5), "yellow");
  assert.equal(workRatioLevel(0.75), "green");
  assert.equal(workRatioLevel(1), "green");
});
