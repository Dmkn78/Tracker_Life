import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCalendarDisplayEvents,
  CALENDAR_LAYERS,
  isEditableCalendarLayer,
  toCalendarVisibleRange
} from "./calendarLayers.ts";
import { createSerializedWriteCoordinator } from "../../shared/application/serializedWriteCoordinator.ts";
import {
  createCalendarRequestGate,
  runCalendarMutation
} from "../application/calendarRequestGate.ts";

test("visible FullCalendar range becomes an inclusive API range", () => {
  assert.deepEqual(
    toCalendarVisibleRange("2026-07-27T00:00:00+02:00", "2026-09-07T00:00:00+02:00"),
    {
      from: "2026-07-27",
      to: "2026-09-06",
      eventStart: "2026-07-27T00:00:00+02:00",
      eventEndExclusive: "2026-09-07T00:00:00+02:00"
    }
  );
});

test("visible ranges preserve positive, negative, and DST-changing offsets", () => {
  assert.equal(toCalendarVisibleRange("2026-01-01T00:00:00-08:00", "2026-01-08T00:00:00-08:00").eventStart, "2026-01-01T00:00:00-08:00");
  assert.equal(toCalendarVisibleRange("2026-03-23T00:00:00+01:00", "2026-03-30T00:00:00+02:00").eventEndExclusive, "2026-03-30T00:00:00+02:00");
});

test("event and To-Do mappings keep layer identity, style, and editability", () => {
  const displayEvents = buildCalendarDisplayEvents({
    events: [createEvent()],
    tasks: [createTask()],
    enabledLayerIds: new Set(["events", "todo"])
  });

  assert.equal(displayEvents[0].id, "event:event-1");
  assert.equal(displayEvents[0].editable, true);
  assert.equal(displayEvents[0].extendedProps.layerId, "events");
  assert.ok(displayEvents[0].classNames.includes("calendar-layer-events"));
  assert.equal(displayEvents[1].id, "todo:task-1");
  assert.equal(displayEvents[1].start, "2026-08-10T09:30");
  assert.equal(displayEvents[1].end, "2026-08-10T10:15");
  assert.equal(displayEvents[1].editable, false);
  assert.equal(displayEvents[1].extendedProps.layerId, "todo");
  assert.ok(displayEvents[1].classNames.includes("calendar-layer-todo"));
});

test("an undated task is omitted and a date-only task is all-day", () => {
  const displayEvents = buildCalendarDisplayEvents({
    events: [],
    tasks: [createTask({ id: "undated", date: null }), createTask({ startTime: null, endTime: null })],
    enabledLayerIds: new Set(["todo"])
  });

  assert.equal(displayEvents.length, 1);
  assert.equal(displayEvents[0].start, "2026-08-10");
  assert.equal(displayEvents[0].allDay, true);
});

test("layer toggles filter real sources without inventing future-layer entries", () => {
  const eventOnly = buildCalendarDisplayEvents({
    events: [createEvent()],
    tasks: [createTask()],
    enabledLayerIds: new Set(["events", "allocations", "routines"])
  });

  assert.deepEqual(eventOnly.map((event) => event.extendedProps.layerId), ["events"]);
  assert.equal(CALENDAR_LAYERS.find((layer) => layer.id === "allocations").isAvailable, true);
  assert.equal(CALENDAR_LAYERS.find((layer) => layer.id === "routines").isAvailable, true);
  assert.equal(isEditableCalendarLayer("events"), true);
  assert.equal(isEditableCalendarLayer("todo"), false);
});

test("period allocation plans map to read-only all-day spans with an exclusive end", () => {
  const [display] = buildCalendarDisplayEvents({
    events: [],
    tasks: [],
    allocations: [{
      id: "plan-1",
      categoryId: "category-1",
      title: "Deep work",
      color: "#8da2fb",
      period: "week",
      startDate: "2026-08-10",
      endDate: "2026-08-16",
      endExclusive: "2026-08-17",
      plannedMinutes: 1_200
    }],
    enabledLayerIds: new Set(["allocations"])
  });

  assert.equal(display.id, "allocation:plan-1");
  assert.equal(display.start, "2026-08-10");
  assert.equal(display.end, "2026-08-17");
  assert.equal(display.allDay, true);
  assert.equal(display.editable, false);
  assert.equal(display.interactive, false);
  assert.equal(display.extendedProps.layerId, "allocations");
});

test("routine occurrences map to distinct read-only timed events", () => {
  const [display] = buildCalendarDisplayEvents({
    events: [],
    tasks: [],
    routines: [{
      id: "block-1:2026-08-10",
      blockId: "block-1",
      habitId: "habit-1",
      title: "Morning routine",
      category: "routine",
      start: "2026-08-10T07:00:00",
      end: "2026-08-10T07:45:00"
    }],
    enabledLayerIds: new Set(["routines"])
  });

  assert.equal(display.id, "routine:block-1:2026-08-10");
  assert.equal(display.allDay, false);
  assert.equal(display.editable, false);
  assert.equal(display.interactive, false);
  assert.equal(display.extendedProps.layerId, "routines");
});

test("calendar event writes are sequential and rollback to the last confirmed event", async () => {
  const requests = [];
  let projectedEvent = createEvent();
  const coordinator = createSerializedWriteCoordinator({
    applyWrite: (event, write) => ({ ...event, ...write }),
    executeWrite: (_eventId, write) => {
      const deferred = createDeferred();
      requests.push({ write, deferred });
      return deferred.promise;
    },
    publishState: (_eventId, event) => {
      projectedEvent = event;
    }
  });
  coordinator.synchronizeConfirmedState("event-1", projectedEvent);
  const firstWrite = coordinator.enqueueWrite("event-1", { start: "2026-08-10T11:00:00.000Z" });
  const secondWrite = coordinator.enqueueWrite("event-1", { start: "2026-08-10T13:00:00.000Z" });

  assert.equal(requests.length, 1);
  requests[0].deferred.resolve(createEvent({ start: "2026-08-10T11:00:00.000Z" }));
  await firstWrite;
  assert.equal(requests.length, 2);
  requests[1].deferred.reject(new Error("move failed"));
  await assert.rejects(secondWrite, /move failed/);
  assert.equal(projectedEvent.start, "2026-08-10T11:00:00.000Z");
});

for (const mutationKind of ["create", "patch", "delete"]) {
  test(`an old GET cannot overwrite a ${mutationKind} mutation`, async () => {
    const requestGate = createCalendarRequestGate();
    const oldRead = requestGate.beginRead();
    const mutation = createDeferred();
    let visibleState = `local-${mutationKind}`;
    let reloadCount = 0;
    const mutationLifecycle = runCalendarMutation({
      requestGate,
      mutate: () => mutation.promise,
      whenIdle: () => Promise.resolve(),
      reload: async () => { reloadCount += 1; }
    });

    assert.equal(oldRead.signal.aborted, true);
    if (requestGate.isCurrentRead(oldRead.generation)) visibleState = "stale-get";
    mutation.resolve(mutationKind);
    await mutationLifecycle;
    assert.equal(visibleState, `local-${mutationKind}`);
    assert.equal(reloadCount, 1);
  });
}

test("a mutation resolved after disposal cannot trigger a reload", async () => {
  const requestGate = createCalendarRequestGate();
  const mutation = createDeferred();
  let reloadCount = 0;
  const lifecycle = runCalendarMutation({
    requestGate,
    mutate: () => mutation.promise,
    whenIdle: () => Promise.resolve(),
    reload: async () => { reloadCount += 1; }
  });
  requestGate.dispose();
  mutation.resolve("saved");
  await lifecycle;
  assert.equal(requestGate.beginRead(), null);
  assert.equal(reloadCount, 0);
});

function createEvent(overrides = {}) {
  return {
    id: "event-1",
    title: "Review",
    type: "personal",
    start: "2026-08-10T09:00:00.000Z",
    end: "2026-08-10T10:00:00.000Z",
    impact: "medium",
    expectedStress: 40,
    expectedPreparationLoad: 30,
    companyId: null,
    companyName: null,
    companyColor: null,
    ...overrides
  };
}

function createTask(overrides = {}) {
  return {
    id: "task-1",
    title: "Prepare slides",
    description: null,
    date: "2026-08-10",
    startTime: "09:30",
    endTime: "10:15",
    objectiveId: null,
    objectiveTitle: null,
    companyId: null,
    companyName: null,
    companyColor: null,
    tags: [],
    importance: "high",
    productive: true,
    estimatedMinutes: 45,
    completionPercent: 0,
    status: "planned",
    notDoneReason: null,
    sortOrder: 0,
    ...overrides
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
