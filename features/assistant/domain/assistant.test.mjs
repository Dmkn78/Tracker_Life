import assert from "node:assert/strict";
import test from "node:test";
import {
  isAssistantDate,
  isAssistantTime,
  parseAssistantPreview,
  parseAssistantTask,
  resolveAssistantInstruction
} from "./assistant.ts";

const selectedDate = "2026-10-03";
const proposedTask = {
  title: "Préparer le rapport",
  description: "Relire les notes",
  date: selectedDate,
  startTime: "10:00",
  endTime: "11:00",
  estimatedMinutes: 60,
  importance: "high",
  productive: true
};

test("plain task instructions preserve selected mode and local date", () => {
  assert.deepEqual(resolveAssistantInstruction("  Prépare un rapport demain  ", "tasks", selectedDate), {
    prompt: "Prépare un rapport demain", mode: "tasks", date: selectedDate
  });
});

test("slash analysis commands select day or week and support an explicit date", () => {
  assert.deepEqual(resolveAssistantInstruction("/analyse", "tasks", selectedDate), {
    prompt: "", mode: "day", date: selectedDate
  });
  assert.deepEqual(resolveAssistantInstruction(" /ANALYSE semaine 2026-10-01 Compare mes blocages ", "tasks", selectedDate), {
    prompt: "Compare mes blocages", mode: "week", date: "2026-10-01"
  });
  assert.deepEqual(resolveAssistantInstruction("/analyse week", "day", selectedDate), {
    prompt: "", mode: "week", date: selectedDate
  });
});

test("slash commands reject impossible dates without normalizing them", () => {
  assert.throws(() => resolveAssistantInstruction("/analyse jour 2026-02-30", "tasks", selectedDate));
  assert.deepEqual(resolveAssistantInstruction("/analyses des données", "tasks", selectedDate), {
    prompt: "/analyses des données", mode: "tasks", date: selectedDate
  });
});

test("dates and times respect leap years and full HH:MM bounds", () => {
  assert.equal(isAssistantDate("2024-02-29"), true);
  for (const date of ["2026-02-29", "2026-04-31", "2026-2-03", "2026-13-01", "invalid"]) {
    assert.equal(isAssistantDate(date), false, date);
  }
  for (const time of ["00:00", "23:59"]) assert.equal(isAssistantTime(time), true, time);
  for (const time of ["24:00", "12:60", "9:00", "12:00:00"]) assert.equal(isAssistantTime(time), false, time);
});

test("valid task preview preserves schedule and trims task title", () => {
  const task = { ...proposedTask, title: "  Préparer le rapport  " };
  assert.deepEqual(parseAssistantPreview({
    analysis: "Relire les priorités avant de confirmer.", tasks: [task], from: "2026-09-27", to: selectedDate
  }), {
    analysis: "Relire les priorités avant de confirmer.", tasks: [proposedTask], from: "2026-09-27", to: selectedDate
  });
});

test("start-only and undated backlog suggestions remain valid", () => {
  assert.equal(parseAssistantTask({ ...proposedTask, endTime: null }).startTime, "10:00");
  assert.equal(parseAssistantTask({ ...proposedTask, date: null, startTime: null, endTime: null }).date, null);
});

test("invalid schedules and malformed task fields cannot be confirmed", () => {
  for (const changes of [
    { title: "   " }, { title: "x".repeat(241) }, { description: 12 },
    { date: "2026-02-30" }, { date: null }, { startTime: "24:00" },
    { startTime: null }, { endTime: "09:59" }, { endTime: "10:00" },
    { estimatedMinutes: -1 }, { estimatedMinutes: 1.5 }, { estimatedMinutes: 10081 },
    { estimatedMinutes: "60" }, { importance: "urgent" }, { productive: "true" }
  ]) {
    assert.throws(() => parseAssistantTask({ ...proposedTask, ...changes }), JSON.stringify(changes));
  }
  assert.equal(parseAssistantTask({ ...proposedTask, estimatedMinutes: 10080 }).estimatedMinutes, 10080);
});

test("malformed preview and reversed or invalid periods are rejected", () => {
  const preview = { analysis: "Analyse", tasks: [], from: "2026-09-27", to: selectedDate };
  for (const payload of [null, [], "text", { ...preview, tasks: "bad" },
    { ...preview, analysis: null }, { ...preview, from: "2026-02-30" },
    { ...preview, from: "2026-10-04" }, { ...preview, tasks: [null] }
  ]) assert.throws(() => parseAssistantPreview(payload));
});
