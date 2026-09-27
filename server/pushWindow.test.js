import test from "node:test";
import assert from "node:assert/strict";
import { withinMinutes } from "./pushWindow.js";

test("a reminder window wraps across midnight", () => {
  assert.equal(withinMinutes("00:05", "23:58", 9), true);
  assert.equal(withinMinutes("23:58", "00:05", 9), true);
  assert.equal(withinMinutes("18:30", "18:38", 9), true);
  assert.equal(withinMinutes("18:30", "12:00", 9), false);
});
