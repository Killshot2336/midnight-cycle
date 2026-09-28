import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTheme, presetForStyle } from "./theme.js";

test("a fresh theme is velvet", () => {
  const t = normalizeTheme(null);
  assert.equal(t.style, "velvet");
  assert.equal(t.charm, "none");
  assert.equal(t.charm2, "none");
  assert.equal(t.pattern, "none");
  assert.equal(t.flow.heavy, "#8e2f45");
  assert.equal(t.type, "serif");
});

test("an older midnight theme keeps its accent", () => {
  const t = normalizeTheme({ style: "midnight", accent: "#111111" });
  assert.equal(t.style, "midnight");
  assert.equal(t.accent, "#111111");
  assert.equal(t.charm, "none");
});

test("a retired look becomes custom and keeps its colors", () => {
  const t = normalizeTheme({ style: "obsidian", accent: "#00d4ff", bg: "#070b12" });
  assert.equal(t.style, "custom");
  assert.equal(t.accent, "#00d4ff");
  assert.equal(t.bg, "#070b12");
  assert.equal(t.charm, "none");
  assert.equal(t.pattern, "none");
  assert.equal(t.shimmer, false);
});

test("a personal line stays within 42 characters", () => {
  const t = normalizeTheme({ phrase: "x".repeat(80) });
  assert.equal(t.phrase.length, 42);
});

test("preset copies do not share bleed colors", () => {
  const a = presetForStyle("blush");
  a.flow.heavy = "#000000";
  assert.notEqual(presetForStyle("blush").flow.heavy, "#000000");
});
