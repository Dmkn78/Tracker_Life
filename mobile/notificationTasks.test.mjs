import assert from "node:assert/strict";
import test from "node:test";
import { notificationDestination, summarizeNotificationTasks } from "./notificationTasks.ts";

test("notification counts real tasks for its day, excluding cancelled and undated tasks", () => {
  const date = "2026-09-17";
  assert.deepEqual(summarizeNotificationTasks([
    { date, status: "done" }, { date, status: "planned" }, { date, status: "not_done" },
    { date, status: "cancelled" }, { date: null, status: "planned" },
    { date: "2026-09-18", status: "done" }
  ], date), { date, completed: 1, total: 3, titles: [] });
  assert.deepEqual(summarizeNotificationTasks([], date), { date, completed: 0, total: 0, titles: [] });
});

test("notification actions route to the existing To-do or its creation form", () => {
  assert.equal(notificationDestination("liferegime://todo/new"), "create-todo");
  assert.equal(notificationDestination("liferegime://note/new"), "create-note");
  assert.equal(notificationDestination("liferegime://note"), null);
  assert.equal(notificationDestination("liferegime://todo"), "todo");
  assert.equal(notificationDestination("liferegime://todo/"), "todo");
  for (const url of ["https://todo/new", "liferegime://settings", "liferegime://todo/delete", "liferegime://todo/new?date=2000-01-01", "bad-url"]) {
    assert.equal(notificationDestination(url), null);
  }
});

test("a real day of twelve tasks reaches the notification with completion and pending titles", () => {
  const date = "2026-09-19";
  const tasks = Array.from({ length: 12 }, (_, index) => ({ date, title: `Tâche ${index + 1}`, status: index < 4 ? "done" : "planned" }));
  assert.deepEqual(summarizeNotificationTasks(tasks, date), { date, completed: 4, total: 12, titles: ["Tâche 5", "Tâche 6", "Tâche 7"] });
  assert.equal(summarizeNotificationTasks(tasks, "2026-09-20").total, 0);
});
