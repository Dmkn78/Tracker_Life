import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, parseDuration } from "./duration.ts";

test("conventional hour-minute notation saves the intended working duration", () => {
  for (const input of ["1h30", "1h 30", "1 h 30", "1h30m", "1h 30m", "90"]) assert.equal(parseDuration(input), 90, input);
  assert.equal(parseDuration("2h05"), 125);
  assert.equal(parseDuration("1h90"), null);
});

test("existing decimal, day, zero and invalid notation retain their behavior", () => {
  assert.equal(parseDuration("1.5h"), 90);
  assert.equal(parseDuration("1d 2h 15m"), 1575);
  assert.equal(parseDuration(""), 0);
  assert.equal(parseDuration("oops"), null);
  assert.equal(formatDuration(1575), "1d 2h 15m");
});
