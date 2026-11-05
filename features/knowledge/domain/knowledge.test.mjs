import assert from "node:assert/strict";
import test from "node:test";
import { listFrontmatterChips, toSearchTypes } from "./knowledge.ts";

test("frontmatter chips flatten lists and hide technical ids", () => {
  assert.deepEqual(listFrontmatterChips({ type: "journal", tags: ["a", "b"], tracker_id: "x", nested: { a: 1 } }), ["type: journal", "tags: a", "tags: b"]);
});

test("the all filter searches every type", () => {
  assert.deepEqual(toSearchTypes("all"), []);
  assert.deepEqual(toSearchTypes("journal"), ["journal"]);
});
