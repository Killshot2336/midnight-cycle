import test from "node:test";
import assert from "node:assert/strict";
import { ensureVault } from "./cycleEngine.js";

test("version 2 vaults migrate without inventing bleed days", () => {
  const vault = ensureVault({
    version: 2,
    periods: [
      { start: "2024-01-01", lengthDays: 6 },
      { start: "2024-02-01", lengthDays: 5 }
    ],
    daily: { "2024-01-15": { checkin: true } }
  }, "America/Chicago");

  assert.equal(vault.version, 3);
  assert.equal(vault.daily["2024-01-01"].flow, "medium");
  assert.equal(vault.daily["2024-02-01"].flow, "medium");
  assert.equal(vault.daily["2024-01-02"], undefined);
  assert.equal(vault.daily["2024-01-06"], undefined);
  assert.equal(vault.daily["2024-01-15"].checkin, true);
  assert.equal(vault.daily["2024-01-15"].flow, undefined);
  assert.equal(vault.profile.onboarded, true);

  const again = ensureVault(vault, "America/Chicago");
  assert.equal(again.daily["2024-01-02"], undefined);
});

test("a new vault waits for setup and does not invent bleeding", () => {
  const vault = ensureVault({}, "America/Chicago");
  assert.equal(vault.version, 3);
  assert.equal(vault.profile.onboarded, false);
  assert.equal(vault.profile.situation, "cycling");
  assert.equal(vault.profile.goal, "bleed");
  assert.deepEqual(vault.daily, {});
});
