import assert from "node:assert/strict";
import test from "node:test";
import { emptyEmotionalReview, linesToItems } from "./emotionalReview.ts";

test("new emotional review is anchored to the requested ISO week", () => {
  const review = emptyEmotionalReview("2026-W33");
  assert.equal(review.weekId, "2026-W33");
  assert.deepEqual(review.emotions, []);
});

test("multiline emotional factors are trimmed, deduplicated and empty-safe", () => {
  assert.deepEqual(linesToItems("work\n sleep \nwork\n\n"), ["work", "sleep"]);
});
