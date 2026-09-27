import test from "node:test";
import assert from "node:assert/strict";
import { addPeriodStart, ensureVault, markPeriodRange } from "./cycleEngine.js";

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

test("marking a range keeps days that already have a bleed flow", () => {
  const vault = ensureVault({
    version: 3,
    profile: { onboarded: true, periodsMigrated: true },
    daily: {
      "2024-03-01": { flow: "heavy" },
      "2024-03-02": { flow: "spotting" }
    }
  }, "America/Chicago");
  const marked = markPeriodRange(vault, "2024-03-01", "2024-03-03", "2024-03-03");
  assert.equal(marked, 2);
  assert.equal(vault.daily["2024-03-01"].flow, "heavy");
  assert.equal(vault.daily["2024-03-02"].flow, "medium");
  assert.equal(vault.daily["2024-03-03"].flow, "medium");
});

test("a pasted start keeps a bleed that is already logged", () => {
  const vault = ensureVault({
    version: 3,
    profile: { onboarded: true, periodsMigrated: true },
    daily: { "2026-09-01": { flow: "heavy" } }
  }, "America/Chicago");
  addPeriodStart(vault, "2026-09-01");
  addPeriodStart(vault, "2026-09-20");
  assert.equal(vault.daily["2026-09-01"].flow, "heavy");
  assert.equal(vault.daily["2026-09-20"].flow, "medium");
});
