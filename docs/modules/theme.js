import { clamp } from "./guard.js";

const DEFAULT_THEME = {
  style: "midnight",
  accent: "#7c4dff",
  bg: "#0b0f1a",
  card: "#121a2c",
  text: "#e9ecff"
};

const PRESETS = {
  midnight: { accent:"#7c4dff", bg:"#0b0f1a", card:"#121a2c", text:"#e9ecff" },
  obsidian: { accent:"#00d4ff", bg:"#070b12", card:"#0f1729", text:"#eaf2ff" },
  noir:     { accent:"#ff4d6d", bg:"#06060a", card:"#101018", text:"#f1f1f7" },
  neon:     { accent:"#38d39f", bg:"#061018", card:"#0b1a1f", text:"#e7fff6" }
};

export function normalizeTheme(t) {
  const base = { ...DEFAULT_THEME, ...(t||{}) };
  const preset = PRESETS[base.style] || PRESETS.midnight;
  // If user picks a style, keep their custom values if set, else preset.
  return {
    style: base.style,
    accent: base.accent || preset.accent,
    bg: base.bg || preset.bg,
    card: base.card || preset.card,
    text: base.text || preset.text
  };
}

export function applyTheme(theme) {
  const t = normalizeTheme(theme);
  const root = document.documentElement;

  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--bg", t.bg);
  root.style.setProperty("--card", t.card);
  root.style.setProperty("--text", t.text);

  // Also fix body background to actually respond to new colors:
  document.body.style.background =
    `radial-gradient(1200px 600px at 20% 0%, ${hexToRgba(t.accent, .22)}, transparent 60%),
     radial-gradient(1000px 600px at 100% 10%, ${hexToRgba("#38d39f", .14)}, transparent 55%),
     ${t.bg}`;

  // Ensure meta theme-color matches
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.bg);

  return t;
}

export function setInputsFromTheme(theme, el) {
  const t = normalizeTheme(theme);
  el.themeStyle.value = t.style;
  el.accent.value = t.accent;
  el.bg.value = t.bg;
  el.card.value = t.card;
  el.text.value = t.text;
}

export function themeFromInputs(el) {
  return normalizeTheme({
    style: el.themeStyle.value,
    accent: el.accent.value,
    bg: el.bg.value,
    card: el.card.value,
    text: el.text.value
  });
}

export function presetForStyle(style) {
  return PRESETS[style] || PRESETS.midnight;
}

function hexToRgba(hex, a) {
  const h = hex.replace("#","");
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  const alpha = clamp(a,0,1);
  return `rgba(${r},${g},${b},${alpha})`;
}
