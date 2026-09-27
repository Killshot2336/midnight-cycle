import test from "node:test";
import assert from "node:assert/strict";
import { addDaysISO } from "./guard.js";
import {
  heavyDayPattern,
  heavyDaySentence,
  searchNotes,
  parseStartDates,
  shareSentence,
  reminderRelevant,
  visitText,
  mentionSentence
} from "./cycleBook.js";

function putBleed(daily, start, flows) {
  flows.forEach((flow, index) => {
    daily[addDaysISO(start, index)] = { ...(daily[addDaysISO(start, index)] || {}), flow };
  });
}

test("heavier days are named only when they agree", () => {
  const daily = {};
  let start = "2026-01-01";
  for (let i = 0; i < 4; i++) {
    putBleed(daily, start, ["light", "heavy", "medium"]);
    start = addDaysISO(start, 28);
  }
  const pattern = heavyDayPattern({ daily, profile: {} }, "2026-05-01");
  assert.equal(pattern.day, 2);
  assert.equal(heavyDaySentence(pattern), "Your heavier days are usually day 2.");
});

test("mixed heavy days stay quiet", () => {
  const daily = {};
  putBleed(daily, "2026-01-01", ["heavy", "light"]);
  putBleed(daily, "2026-01-29", ["light", "heavy"]);
  putBleed(daily, "2026-02-26", ["medium", "light", "heavy"]);
  assert.equal(heavyDayPattern({ daily, profile: {} }, "2026-04-01"), null);
});

test("notes search and pasted starts stay literal", () => {
  const hits = searchNotes({
    daily: {
      "2026-03-02": { notes: "Migraine after work" },
      "2026-01-01": { notes: "fine" }
    }
  }, "migraine");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].iso, "2026-03-02");
  assert.deepEqual(parseStartDates("2026-01-01 nope, 2026-02-02 2026-01-01"), ["2026-01-01", "2026-02-02"]);
});

test("a share note is only the window", () => {
  assert.equal(shareSentence({ paused: true, median: "2026-04-01" }), "");
  const text = shareSentence({
    paused: false,
    median: "2026-04-03",
    low: "2026-04-01",
    high: "2026-04-06"
  });
  assert.match(text, /Likely bleeding around/);
  assert.doesNotMatch(text, /cramp|fertile|symptom/i);
});

test("reminders can be the day before, the day, or off", () => {
  const model = { paused: false, inBleed: false, median: "2026-04-02" };
  assert.equal(reminderRelevant(model, "2026-04-01", "before"), true);
  assert.equal(reminderRelevant(model, "2026-04-01", "day"), false);
  assert.equal(reminderRelevant(model, "2026-04-02", "day"), true);
  assert.equal(reminderRelevant(model, "2026-04-02", "off"), false);
});

test("a long bleed is worth mentioning, without a diagnosis", () => {
  const page = { bleedDays: 8, days: [] };
  assert.match(mentionSentence(page), /worth mentioning/);
  const text = visitText({ daily: {}, profile: {} }, "2026-01-01", "2026-06-01", "2026-06-01");
  assert.match(text, /not a diagnosis/);
  assert.match(text, /No periods started/);
});
