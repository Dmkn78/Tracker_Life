import assert from "node:assert/strict";
import test from "node:test";
import { buildCaptureRequest, isCaptureTextValid, readRequestedCaptureKind, resolveCaptureDate, shouldSaveOnKeyPress } from "./quickCapture.ts";

const press = (key, modifiers = {}) => ({ key, shiftKey: false, ctrlKey: false, metaKey: false, isComposing: false, ...modifiers });

test("task dates: today, tomorrow across months, later = undated", () => {
  assert.equal(resolveCaptureDate("today", "2026-11-04"), "2026-11-04");
  assert.equal(resolveCaptureDate("tomorrow", "2026-11-30"), "2026-12-01");
  assert.equal(resolveCaptureDate("later", "2026-11-04"), null);
});

test("notes never carry a date and text is trimmed", () => {
  assert.deepEqual(buildCaptureRequest("note", "  Idée  ", "tomorrow", "2026-11-04"), { kind: "note", text: "Idée", date: null });
  assert.deepEqual(buildCaptureRequest("task", " Réviser ", "tomorrow", "2026-11-04"), { kind: "task", text: "Réviser", date: "2026-11-05" });
});

test("Enter saves a task, a note needs Ctrl or Cmd, IME composition never saves", () => {
  assert.equal(shouldSaveOnKeyPress("task", press("Enter")), true);
  assert.equal(shouldSaveOnKeyPress("task", press("Enter", { shiftKey: true })), false);
  assert.equal(shouldSaveOnKeyPress("note", press("Enter")), false);
  assert.equal(shouldSaveOnKeyPress("note", press("Enter", { ctrlKey: true })), true);
  assert.equal(shouldSaveOnKeyPress("task", press("Enter", { isComposing: true })), false);
});

test("validation and deep-link parsing", () => {
  assert.equal(isCaptureTextValid("task", "   "), false);
  assert.equal(isCaptureTextValid("task", "x".repeat(501)), false);
  assert.equal(isCaptureTextValid("note", "x".repeat(501)), true);
  assert.equal(readRequestedCaptureKind("?capture=note"), "note");
  assert.equal(readRequestedCaptureKind("?capture=other"), null);
});
