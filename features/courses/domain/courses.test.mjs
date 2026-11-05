import assert from "node:assert/strict";
import test from "node:test";
import { buildGoogleCalendarUrl, daysUntil, isDeadlineDraftValid, selectUpcomingDeadlines } from "./courses.ts";

const deadline = (overrides = {}) => ({ id: "d", courseId: "c", title: "Partiel", kind: "exam", date: "2026-12-14", time: null, durationMinutes: 60, note: null, ...overrides });

test("Google Agenda link: all-day uses the next day as exclusive end", () => {
  const url = new URL(buildGoogleCalendarUrl(deadline({ date: "2026-12-31" }), "Examen — Proba · Partiel"));
  assert.equal(url.origin + url.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("dates"), "20261231/20270101");
  assert.equal(url.searchParams.get("text"), "Examen — Proba · Partiel");
});

test("Google Agenda link: timed event keeps the local wall-clock time and duration", () => {
  const url = new URL(buildGoogleCalendarUrl(deadline({ time: "23:30", durationMinutes: 90, note: "Salle B" }), "x"));
  assert.equal(url.searchParams.get("dates"), "20261214T233000/20261215T010000");
  assert.equal(url.searchParams.get("details"), "Salle B");
});

test("countdown and upcoming window", () => {
  assert.equal(daysUntil("2026-11-08", "2026-11-05"), 3);
  const deadlines = [deadline({ id: "past", date: "2026-11-01" }), deadline({ id: "soon", date: "2026-11-06" }), deadline({ id: "far", date: "2027-03-01" })];
  assert.deepEqual(selectUpcomingDeadlines(deadlines, "2026-11-05").map((entry) => entry.id), ["soon"]);
});

test("a deadline needs a title and a date; the time is optional", () => {
  assert.equal(isDeadlineDraftValid({ courseId: null, title: "Rendu", kind: "assignment", date: "2026-12-01", time: "" }), true);
  assert.equal(isDeadlineDraftValid({ courseId: null, title: " ", kind: "assignment", date: "2026-12-01", time: "" }), false);
  assert.equal(isDeadlineDraftValid({ courseId: null, title: "Rendu", kind: "assignment", date: "", time: "" }), false);
  assert.equal(isDeadlineDraftValid({ courseId: null, title: "Rendu", kind: "assignment", date: "2026-12-01", time: "25:00" }), false);
});
