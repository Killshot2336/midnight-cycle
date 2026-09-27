import test from "node:test";
import assert from "node:assert/strict";
import { addDaysISO } from "./guard.js";
import {
  deriveEpisodes,
  buildForecastModel,
  dayOutlook,
  predictIntervalDays,
  walkForward,
  headlineFor,
  daySentence,
  fitEpisodes,
  topSymptom
} from "./cycleModel.js";

test("spotting alone does not open a period", () => {
  const episodes = deriveEpisodes({
    "2024-01-01": { flow: "spotting" },
    "2024-01-02": { flow: "spotting" },
    "2024-01-03": { flow: "medium" }
  }, "2024-01-06");
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].start, "2024-01-03");
});

test("spotting inside a period stays in the same episode", () => {
  const episodes = deriveEpisodes({
    "2024-01-01": { flow: "medium" },
    "2024-01-02": { flow: "spotting" },
    "2024-01-03": { flow: "light" }
  }, "2024-01-06");
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].start, "2024-01-01");
  assert.equal(episodes[0].end, "2024-01-03");
  assert.equal(episodes[0].bleedDays, 3);
});

test("spotting does not reset a cycle after the period has ended", () => {
  const daily = {
    "2024-01-01": { flow: "heavy" },
    "2024-01-02": { flow: "light" },
    "2024-01-03": { flow: "none" },
    "2024-01-04": { flow: "none" },
    "2024-01-05": { flow: "spotting" },
    "2024-01-20": { flow: "medium" }
  };
  const episodes = deriveEpisodes(daily, "2024-01-22");
  assert.equal(episodes.length, 2);
  assert.equal(episodes[0].start, "2024-01-01");
  assert.equal(episodes[1].start, "2024-01-20");
});

test("a 35-day history places ovulation near day 21, not day 17", () => {
  const daily = {};
  let iso = "2024-01-01";
  for (let i = 0; i < 9; i++) {
    daily[iso] = { flow: "medium" };
    iso = addDaysISO(iso, 35);
  }
  const today = addDaysISO("2024-01-01", 35 * 8 + 10);
  const model = buildForecastModel({
    daily,
    profile: { situation: "cycling", goal: "bleed" }
  }, today);
  assert.ok(model.muF > 19.5 && model.muF < 23, `follicular mean ${model.muF}`);
  assert.ok(Math.abs(model.muF - 17.5) > 2);
});

test("an unlogged day after a start is not treated as bleeding now", () => {
  const start = "2026-09-20";
  const today = "2026-09-21";
  const model = buildForecastModel({
    daily: { [start]: { flow: "medium" } },
    profile: { situation: "cycling", goal: "bleed" }
  }, today);
  assert.equal(model.inBleed, false);
  assert.equal(headlineFor(model).includes("Bleeding now"), false);
  const loggedToday = buildForecastModel({
    daily: { [start]: { flow: "medium" }, [today]: { flow: "medium" } },
    profile: { situation: "cycling", goal: "bleed" }
  }, today);
  assert.equal(loggedToday.inBleed, true);
  assert.equal(loggedToday.bleedDay, 2);

  const stopped = buildForecastModel({
    daily: {
      "2026-09-20": { flow: "medium" },
      "2026-09-21": { flow: "none" }
    },
    profile: { situation: "cycling", goal: "bleed" }
  }, "2026-09-22");
  assert.ok(dayOutlook(stopped, "2026-09-22").bleed < 0.34);
});

test("a late cycle stays overdue instead of wrapping", () => {
  const daily = {};
  let iso = "2024-01-01";
  for (let i = 0; i < 6; i++) {
    daily[iso] = { flow: "medium" };
    iso = addDaysISO(iso, 28);
  }
  const last = addDaysISO("2024-01-01", 28 * 5);
  const today = addDaysISO(last, 40);
  const model = buildForecastModel({ daily, profile: { situation: "cycling", goal: "bleed" } }, today);
  assert.equal(model.late, true);
  assert.ok(model.median >= today);
  assert.ok(model.low >= today);
  const outlook = dayOutlook(model, today);
  assert.ok(outlook.bleed > outlook.fertile);
  assert.equal(outlook.label, "Bleeding likely");
});

test("hormonal mode hides fertile output", () => {
  const daily = {};
  let iso = "2024-01-01";
  for (let i = 0; i < 5; i++) {
    daily[iso] = { flow: "medium" };
    iso = addDaysISO(iso, 28);
  }
  const last = addDaysISO("2024-01-01", 28 * 4);
  const today = addDaysISO(last, 10);
  const model = buildForecastModel({
    daily,
    profile: { situation: "hormonal", goal: "fertility" }
  }, today);
  assert.equal(model.showFertile, false);
  assert.match(headlineFor(model), /Expected bleed/);
  for (let i = 0; i < 40; i++) {
    const outlook = dayOutlook(model, addDaysISO(today, i));
    assert.equal(outlook.fertile, 0);
    assert.notEqual(outlook.label, "Fertile");
  }
});

test("walk-forward error matches a hand-computed 30-day cycle", () => {
  assert.equal(predictIntervalDays([30]), 29);
  assert.equal(predictIntervalDays([28]), 28);

  const daily = {
    "2024-01-01": { flow: "medium" },
    "2024-01-31": { flow: "medium" },
    "2024-03-01": { flow: "medium" }
  };
  const episodes = deriveEpisodes(daily, "2024-03-03");
  const rows = walkForward(episodes, daily, "cycling");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].median, "2024-02-29");
  assert.equal(rows[0].actual, "2024-03-01");
  assert.equal(rows[0].error, 1);
  assert.equal(rows[0].covered, true);
});

test("hormonal in-bleed headline names the next expected bleed", () => {
  const today = "2026-09-26";
  const model = buildForecastModel({
    daily: { [today]: { flow: "medium" } },
    profile: { situation: "hormonal", goal: "bleed" }
  }, today);
  const line = headlineFor(model);
  assert.match(line, /Bleeding now, day 1/);
  assert.match(line, /Next expected bleed most likely/);
  assert.doesNotMatch(line, /Next period expected/);
});

test("pregnancy mode does not count a cycle day", () => {
  const model = buildForecastModel({
    daily: { "2026-08-01": { flow: "medium" } },
    profile: { situation: "pregnancy", goal: "bleed" }
  }, "2026-09-26");
  assert.equal(model.paused, true);
  assert.equal(daySentence(model), "Forecasts stay paused while pregnancy mode is on.");
  assert.match(headlineFor(model), /paused/);
});

test("a logged none finishes the bleed length without waiting for a second empty day", () => {
  const daily = {
    "2024-06-01": { flow: "medium" },
    "2024-06-02": { flow: "medium" },
    "2024-06-03": { flow: "none" }
  };
  const episodes = deriveEpisodes(daily, "2024-06-03");
  const fit = fitEpisodes(episodes, daily, "cycling", "2024-06-03");
  assert.ok(fit.muB < 4.5);
  assert.ok(fit.muB > 3.5);
});

test("high energy two weeks before a period can be learned", () => {
  const starts = ["2024-01-01", "2024-01-29", "2024-02-26", "2024-03-25"];
  const daily = {};
  for (const start of starts) daily[start] = { flow: "medium" };
  for (const start of starts.slice(1)) {
    daily[addDaysISO(start, -14)] = { symptoms: ["energyHigh"] };
  }
  const top = topSymptom({ daily });
  assert.equal(top?.id, "energyHigh");
  assert.equal(top?.offset, -14);
});
