import assert from "node:assert/strict";
import test from "node:test";
import { formatDisplayDate, getIsoWeekId, getWeekDateKeys } from "../../../lib/dates.ts";
import {
  createSerializedWriteCoordinator
} from "../../shared/application/serializedWriteCoordinator.ts";
import { restoreTaskOrder } from "../../shared/application/restoreTaskOrder.ts";
import {
  emptyTodoTaskFields,
  hasTodoTaskContent,
  setTodoTaskImportance,
  setTodoTaskStatus,
  todoTaskFieldsFromTask,
  toTodoTaskWriteValues
} from "./todoTask.ts";
import { applyTodoTemplate } from "./todoTemplate.ts";

test("description-only tasks preserve long paragraphs and omit the name", () => {
  const description = "Mon récit de journée. ".repeat(300) + "\n\nMes idées pour demain.";
  const fields = { ...emptyTodoTaskFields("2026-10-03"), description };
  assert.equal(hasTodoTaskContent(fields), true);
  assert.equal(toTodoTaskWriteValues(fields).title, "");
  assert.equal(toTodoTaskWriteValues(fields).description, description);
  assert.equal(hasTodoTaskContent({ ...fields, description: " \n " }), false);
});

test("day tasks use an automatic title and retain the day option after reopening", () => {
  const fields = { ...emptyTodoTaskFields("2026-10-03"), isDay: true, title: "Un autre nom" };
  assert.equal(hasTodoTaskContent(fields), true);
  assert.equal(toTodoTaskWriteValues(fields).title, "Journée");
  assert.equal(toTodoTaskWriteValues(fields).isDay, true);
  assert.equal(todoTaskFieldsFromTask(createTask({ isDay: true })).isDay, true);
});

test("reusing a day template keeps the new date and resets execution without changing the template", () => {
  const template = {
    id: "template-1", name: "Journée de travail",
    fields: { ...emptyTodoTaskFields("2026-09-30"), isDay: true, description: "Matin : coder\n\nSoir : lire", tagNames: ["Travail"], estimatedMinutes: 120, status: "done", completionPercent: 100, notDoneReason: "Ancien motif" }
  };
  const applied = applyTodoTemplate(template, emptyTodoTaskFields("2026-10-03"));
  assert.equal(applied.date, "2026-10-03");
  assert.equal(applied.description, template.fields.description);
  assert.equal(applied.isDay, true);
  assert.equal(applied.estimatedMinutes, 120);
  assert.equal(applied.status, "planned");
  assert.equal(applied.completionPercent, 0);
  assert.equal(applied.notDoneReason, "");
  applied.tagNames.push("Nouveau");
  assert.deepEqual(template.fields.tagNames, ["Travail"]);
});

function createTask(overrides = {}) {
  return {
    id: "task-1",
    title: "Prepare review",
    description: "Read every section",
    date: "2026-08-09",
    startTime: null,
    endTime: null,
    objectiveId: null,
    objectiveTitle: null,
    companyId: null,
    companyName: null,
    companyColor: null,
    tags: [],
    importance: "medium",
    productive: true,
    estimatedMinutes: 30,
    completionPercent: 0,
    status: "planned",
    notDoneReason: null,
    sortOrder: 10,
    ...overrides
  };
}

test("preserves exact importance through medium and high edit payloads", () => {
  const mediumFields = todoTaskFieldsFromTask(createTask({ importance: "medium" }));
  const highPayload = toTodoTaskWriteValues(setTodoTaskImportance(mediumFields, "high"));
  assert.equal(highPayload.importance, "high");

  const highFields = todoTaskFieldsFromTask(createTask({ importance: "high" }));
  const mediumPayload = toTodoTaskWriteValues(setTodoTaskImportance(highFields, "medium"));
  assert.equal(mediumPayload.importance, "medium");
});

test("description choice clears hidden stale text", () => {
  const fields = todoTaskFieldsFromTask(createTask());
  assert.equal(fields.descriptionChoice, "yes");
  assert.equal(toTodoTaskWriteValues({ ...fields, descriptionChoice: "no" }).description, null);
});

test("not-done reason is sent only for the not-done status", () => {
  const fields = todoTaskFieldsFromTask(createTask());
  const notDoneFields = {
    ...setTodoTaskStatus(fields, "not_done"),
    notDoneReason: "Blocked by an external dependency"
  };
  assert.equal(
    toTodoTaskWriteValues(notDoneFields).notDoneReason,
    "Blocked by an external dependency"
  );
  assert.equal(toTodoTaskWriteValues(setTodoTaskStatus(notDoneFields, "planned")).notDoneReason, null);
});

test("ISO week helpers return a local calendar Monday through Sunday range", () => {
  assert.equal(getIsoWeekId("2025-12-29"), "2026-W01");
  assert.deepEqual(getWeekDateKeys("2026-W01"), [
    "2025-12-29",
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
    "2026-01-03",
    "2026-01-04"
  ]);
});

test("task writes call the server sequentially and finish with success A then B", async () => {
  const harness = createTaskWriteHarness();
  const firstWrite = harness.coordinator.enqueueWrite("task-1", { title: "A" });
  const secondWrite = harness.coordinator.enqueueWrite("task-1", { title: "B" });

  assert.equal(harness.requests.length, 1);
  assert.equal(harness.projectedTask.title, "B");

  harness.requests[0].deferred.resolve(createTask({ title: "A" }));
  await firstWrite;
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.projectedTask.title, "B");

  harness.requests[1].deferred.resolve(createTask({ title: "B" }));
  await secondWrite;
  assert.equal(harness.coordinator.getConfirmedState("task-1").title, "B");
  assert.equal(harness.projectedTask.title, "B");
});

test("failure A keeps B optimistic and success B becomes confirmed", async () => {
  const harness = createTaskWriteHarness();
  const firstWrite = captureFailure(
    harness.coordinator.enqueueWrite("task-1", { title: "A" })
  );
  const secondWrite = harness.coordinator.enqueueWrite("task-1", { title: "B" });

  harness.requests[0].deferred.reject(new Error("A failed"));
  assert.equal((await firstWrite).message, "A failed");
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.projectedTask.title, "B");

  harness.requests[1].deferred.resolve(createTask({ title: "B" }));
  await secondWrite;
  assert.equal(harness.coordinator.getConfirmedState("task-1").title, "B");
  assert.equal(harness.projectedTask.title, "B");
});

test("success A followed by failure B restores confirmed A", async () => {
  const harness = createTaskWriteHarness();
  const firstWrite = harness.coordinator.enqueueWrite("task-1", { title: "A" });
  const secondWrite = captureFailure(
    harness.coordinator.enqueueWrite("task-1", { title: "B" })
  );

  harness.requests[0].deferred.resolve(createTask({ title: "A" }));
  await firstWrite;
  harness.requests[1].deferred.reject(new Error("B failed"));
  assert.equal((await secondWrite).message, "B failed");

  assert.equal(harness.coordinator.getConfirmedState("task-1").title, "A");
  assert.equal(harness.projectedTask.title, "A");
});

test("double task write failure restores the initial confirmed task", async () => {
  const harness = createTaskWriteHarness();
  const firstWrite = captureFailure(
    harness.coordinator.enqueueWrite("task-1", { title: "A" })
  );
  const secondWrite = captureFailure(
    harness.coordinator.enqueueWrite("task-1", { title: "B" })
  );

  harness.requests[0].deferred.reject(new Error("A failed"));
  await firstWrite;
  assert.equal(harness.projectedTask.title, "B");
  harness.requests[1].deferred.reject(new Error("B failed"));
  await secondWrite;

  assert.equal(harness.coordinator.getConfirmedState("task-1").title, "Prepare review");
  assert.equal(harness.projectedTask.title, "Prepare review");
});

test("reorder rollback uses confirmed order and preserves current task content", async () => {
  const requests = [];
  let renderedTasks = [
    { id: "task-1", title: "First task" },
    { id: "task-2", title: "Second task" }
  ];
  const coordinator = createSerializedWriteCoordinator({
    applyWrite: (_taskIds, orderedTaskIds) => orderedTaskIds,
    executeWrite: (_channel, orderedTaskIds) => {
      const deferred = createDeferred();
      requests.push({ orderedTaskIds, deferred });
      return deferred.promise;
    },
    publishState: (_channel, projectedTaskIds) => {
      renderedTasks = restoreTaskOrder(renderedTasks, projectedTaskIds);
    }
  });
  coordinator.synchronizeConfirmedState("todo-order", ["task-1", "task-2"]);

  const firstReorder = coordinator.enqueueWrite("todo-order", ["task-2", "task-1"]);
  const secondReorder = captureFailure(
    coordinator.enqueueWrite("todo-order", ["task-1", "task-2"])
  );
  assert.equal(requests.length, 1);

  renderedTasks = renderedTasks.map((task) => ({ ...task, title: `Updated ${task.id}` }));
  requests[0].deferred.resolve(["task-2", "task-1"]);
  await firstReorder;
  assert.equal(requests.length, 2);
  requests[1].deferred.reject(new Error("Second reorder failed"));
  await secondReorder;

  assert.deepEqual(coordinator.getConfirmedState("todo-order"), ["task-2", "task-1"]);
  assert.deepEqual(renderedTasks, [
    { id: "task-2", title: "Updated task-2" },
    { id: "task-1", title: "Updated task-1" }
  ]);
});

test("civil date formatting never shifts backward in a negative UTC timezone", () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.equal(formatDisplayDate("2026-01-01", "en-US"), "Thursday, January 1, 2026");
    assert.equal(formatDisplayDate("2025-12-31", "en-US"), "Wednesday, December 31, 2025");
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});

function createTaskWriteHarness() {
  const requests = [];
  let projectedTask = createTask();
  const coordinator = createSerializedWriteCoordinator({
    applyWrite: (task, patch) => ({ ...task, ...patch }),
    executeWrite: (_taskId, patch) => {
      const deferred = createDeferred();
      requests.push({ patch, deferred });
      return deferred.promise;
    },
    publishState: (_taskId, nextTask) => {
      projectedTask = nextTask;
    }
  });
  coordinator.synchronizeConfirmedState("task-1", projectedTask);
  return {
    coordinator,
    requests,
    get projectedTask() {
      return projectedTask;
    }
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function captureFailure(promise) {
  return promise.then(
    () => {
      throw new Error("Expected write to fail");
    },
    (error) => error
  );
}
