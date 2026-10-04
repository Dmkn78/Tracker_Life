import assert from "node:assert/strict";
import test from "node:test";
import { appendSummaryTranscript } from "./summaryTranscript.ts";

test("dictation fills an empty optional summary", () => {
  assert.equal(appendSummaryTranscript("", "  Bonjour le monde.  "), "Bonjour le monde.");
});
test("dictation preserves notes including edits made while transcribing", () => {
  assert.equal(appendSummaryTranscript("Notes ajoutées pendant la transcription.", "Ma journée."), "Notes ajoutées pendant la transcription.\nMa journée.");
});
test("empty transcription never erases the existing summary", () => {
  assert.equal(appendSummaryTranscript("Mes notes ", "  "), "Mes notes ");
});
