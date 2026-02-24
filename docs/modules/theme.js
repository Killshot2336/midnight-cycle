import { lsGet, lsSet, safeJSONParse } from "./storage.js";

const THEME_KEY = "midnight_theme_v2";

export const ACCENTS = [
  ["#6d5efc", "#24d3ee"],
  ["#ff3d81", "#7c4dff"],
  ["#00e676", "#00b0ff"],
  ["#ffb300", "#ff3d00"],
  ["#ff4d6d", "#00f5d4"],
  ["#c6ff00", "#00e5ff"]
];

export const PRESETS = {
  obsidian: { accentIndex: 0, glow: 80, blur: 14, grain: 20, density: 45, radius: 24, font: 100, stealth: true, localSensitive: true },
  nebula:   { accentIndex: 1, glow: 90, blur: 16, grain: 26, density: 55, radius: 26, font: 102, stealth: true, localSensitive: true },
  ember:    { accentIndex: 3, glow: 85, blur: 15, grain: 18, density: 48, radius: 26, font: 102, stealth: true, localSensitive: true },
  toxic:    { accentIndex: 2, glow: 92, blur: 16, grain: 24, density: 44, radius: 24, font: 100, stealth: true, localSensitive: true },
  voidrose: { accentIndex: 4, glow: 92, blur: 18, grain: 30, density: 52, radius: 28, font: 104, stealth: true, localSensitive: true }
};

export function defaultTheme() {
  return { ...PRESETS.obsidian, customPresets: [] , dashboard: defaultDashboard() };
}

export function defaultDashboard() {
  return [
    { id: "cycle", name: "Cycle", visible: true },
    { id: "forecast", name: "Forecast", visible: true },
    { id: "checkin", name: "Check-in", visible: true },
    { id: "calendar", name: "Calendar", visible: true },
    { id: "log", name: "Private log", visible: true },
    { id: "notify", name: "Notifications", visible: true }
  ];
}

export function loadTheme() {
  const t = lsGet(THEME_KEY, null);
  if (!t) return defaultTheme();
  const merged = { ...defaultTheme(), ...t };
  if (!Array.isArray(merged.dashboard)) merged.dashboard = defaultDashboard();
  if (!Array.isArray(merged.customPresets)) merged.customPresets = [];
  return merged;
}

export function saveTheme(theme) {
  lsSet(THEME_KEY, theme);
}

export function applyTheme(theme) {
  const [a, b] = ACCENTS[clamp(theme.accentIndex, 0, ACCENTS.length - 1, 0)];
  const root = document.documentElement;

  root.style.setProperty("--accent", a);
  root.style.setProperty("--accent2", b);

  root.style.setProperty("--glow", String((clamp(theme.glow, 0, 100, 80) / 100).toFixed(2)));
  root.style.setProperty("--blur", `${clamp(theme.blur, 6, 24, 14)}px`);
  root.style.setProperty("--grain", String((clamp(theme.grain, 0, 100, 20) / 100).toFixed(2)));

  const dens = clamp(theme.density, 0, 100, 45);
  const pad = lerp(14, 22, dens / 100);
  const gap = lerp(14, 22, dens / 100);
  root.style.setProperty("--pad", `${Math.round(pad)}px`);
  root.style.setProperty("--gap", `${Math.round(gap)}px`);

  root.style.setProperty("--radius", `${clamp(theme.radius, 12, 34, 24)}px`);
  root.style.setProperty("--fontScale", String((clamp(theme.font, 85, 120, 100) / 100).toFixed(2)));
}

export function exportTheme(theme) {
  const copy = structuredClone(theme);
  // Remove any potentially large or irrelevant parts if needed
  return copy;
}

export function importThemeFileText(text) {
  const parsed = safeJSONParse(text);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid theme file");
  // Merge with defaults
  return { ...defaultTheme(), ...parsed };
}

export function notificationPreview(stealth) {
  return stealth ? "Midnight: Check-in" : "Midnight: Period check-in";
}

function lerp(a,b,t){ return a+(b-a)*t; }
function clamp(v, lo, hi, fb){
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.max(lo, Math.min(hi, n));
}