import test from "node:test";
import assert from "node:assert/strict";
import { validPasscode } from "./lock.js";

test("a passcode is 4 to 8 digits", () => {
  assert.equal(validPasscode("1234"), true);
  assert.equal(validPasscode("12345678"), true);
  assert.equal(validPasscode("123"), false);
  assert.equal(validPasscode("123456789"), false);
  assert.equal(validPasscode("12ab"), false);
  assert.equal(validPasscode("1234 "), false);
});
