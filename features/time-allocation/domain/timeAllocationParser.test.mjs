import assert from "node:assert/strict";
import test from "node:test";
import { parseTimeAllocationData } from "./timeAllocationParser.ts";
import { createSerializedWriteCoordinator } from "../../shared/application/serializedWriteCoordinator.ts";

test("period-aware response parser preserves canonical range fields", () => {
  const parsed = parseTimeAllocationData(createPayload());
  assert.equal(parsed.period, "week");
  assert.equal(parsed.date, "2026-08-10");
  assert.equal(parsed.rangeEnd, "2026-08-16");
  assert.equal(parsed.periodBudgetMinutes, 5_040);
  assert.equal(parsed.rows[0].actualMinutes, 165);
});

test("period-aware response parser rejects an unknown period", () => {
  assert.throws(() => parseTimeAllocationData({ ...createPayload(), period: "quarter" }), /period is invalid/);
});

test("a write from an old period cannot publish into the current selection", async () => {
  const oldWrite = createDeferred();
  let activeKey = "week:2026-08-10";
  let visibleData = createPayload();
  const coordinator = createSerializedWriteCoordinator({
    applyWrite: (data) => data,
    executeWrite: () => oldWrite.promise,
    publishState: (key, data) => {
      if (key === activeKey) visibleData = data;
    }
  });
  coordinator.synchronizeConfirmedState(activeKey, visibleData);
  const completion = coordinator.enqueueWrite(activeKey, {});
  activeKey = "month:2026-08-01";
  visibleData = { ...createPayload(), period: "month", date: "2026-08-01" };
  oldWrite.resolve({ ...createPayload(), plannedMinutesTotal: 99 });
  await completion;
  assert.equal(visibleData.period, "month");
  assert.notEqual(visibleData.plannedMinutesTotal, 99);
});

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createPayload() {
  return {
    date: "2026-08-10", period: "week", rangeStart: "2026-08-10", rangeEnd: "2026-08-16", weekId: "2026-W33",
    dayBudgetMinutes: 5_040, periodBudgetMinutes: 5_040, maximumBudgetMinutes: 10_080, targetWeightTotal: 100,
    plannedMinutesTotal: 5_040, plannedMinutesAutoTotal: 5_040, actualMinutesTotal: 165, weekActualMinutesTotal: 165,
    remainingBudgetMinutes: 0, overBudgetMinutes: 0, hasManualPlanOverrides: false,
    rows: [{
      id: "deep", name: "Deep work", objective: "Build", targetWeight: 100, actualWeight: 100, weekWeight: 100,
      plannedMinutes: 5_040, autoPlannedMinutes: 5_040, plannedMinutesStored: 0, plannedMinutesManual: false,
      actualMinutes: 165, weekActualMinutes: 165, expectedReturn: 80, risk: 40, beta: 1, color: "#8da2fb", active: true
    }],
    metrics: { targetReturn: 80, actualReturn: 80, targetRisk: 40, actualRisk: 40, beta: 1, capmExpectedReturn: 75, sharpeLike: 1.5 }
  };
}
