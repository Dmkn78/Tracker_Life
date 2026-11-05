import assert from "node:assert/strict";
import test from "node:test";
import { selectStepsToCreate, toStepSelections } from "./goal.ts";

test("only ticked, non-empty steps are created, trimmed", () => {
  const selections = toStepSelections([
    { title: "  Relire le cours ", detail: " " },
    { title: "Exercices", detail: "Faire 3 et 4" },
    { title: "   ", detail: null }
  ], "batch");
  selections[1] = { ...selections[1], isSelected: false };

  assert.deepEqual(selectStepsToCreate(selections), [{ title: "Relire le cours", detail: null }]);
  assert.equal(selections[0].key, "batch:0");
});
