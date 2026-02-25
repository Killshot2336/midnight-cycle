import { clamp } from "./guard.js";

const KEY = "midnight.state.v3";
const HASH_KEY = "midnight.state.v3.hash";

function nowISO(){ return new Date().toISOString(); }

export function defaultState(){
  return {
    version: 3,
    createdAt: nowISO(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
    notifyTime: "18:30",

    basics: { meanCycle: 0, periodLen: 0 },

    history: {
      events: [],   // { dateISO, kind:"period_start" }
      days: {}      // YYYY-MM-DD -> { flow, energy, mood, notes, updatedAt }
    },

    theme: {
      accent:"#7c4dff", bg:"#0b0b12", card:"#121225", text:"#e9e9ff", glow:70
    },

    intelligence: {
      score: 0,
      tier: 1,
      tierProgress: 0,
      explain: "",
      anomaly: { level:0, reason:"" }
    },

    skill: {
      xp: 0,
      level: 1,
      unlocks: {}
    },

    diagnostics: {
      lastError: "",
      lastErrorAt: ""
    }
  };
}

export function storageKeys(){
  return { KEY, HASH_KEY };
}

export function loadLocal(){
  const raw = localStorage.getItem(KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    return deepMerge(defaultState(), parsed);
  } catch {
    return defaultState();
  }
}

export function saveLocal(state){
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function setHash(hex){
  localStorage.setItem(HASH_KEY, hex);
}
export function getHash(){
  return localStorage.getItem(HASH_KEY) || "";
}

export function addEvent(state, evt){
  state.history.events.push(evt);
  state.history.events.sort((a,b)=> a.dateISO.localeCompare(b.dateISO));
}

export function removeLastEvent(state, kind){
  for (let i = state.history.events.length - 1; i >= 0; i--) {
    if (!kind || state.history.events[i].kind === kind) {
      state.history.events.splice(i, 1);
      return true;
    }
  }
  return false;
}

export function upsertDayLog(state, dayISO, log){
  state.history.days[dayISO] = {
    ...(state.history.days[dayISO] || {}),
    ...log,
    updatedAt: nowISO()
  };
}

export function getDayLog(state, dayISO){
  return state.history.days[dayISO] || null;
}

export function setLastError(state, msg){
  state.diagnostics.lastError = String(msg || "").slice(0,260);
  state.diagnostics.lastErrorAt = nowISO();
}

export function compactNotes(s){
  const x = String(s||"");
  // prevent accidental huge notes
  return x.length > 2000 ? (x.slice(0,2000) + "…") : x;
}

export function normalizeBasics(state){
  const m = Number(state.basics?.meanCycle || 0);
  const p = Number(state.basics?.periodLen || 0);
  state.basics.meanCycle = (m>=18 && m<=60) ? m : 0;
  state.basics.periodLen = (p>=2 && p<=12) ? p : 0;
}

export function deepMerge(a, b){
  if (Array.isArray(a) || Array.isArray(b)) return (b ?? a);
  if (typeof a !== "object" || a === null) return (b ?? a);
  const out = { ...a };
  for (const k of Object.keys(b || {})) out[k] = deepMerge(a[k], b[k]);
  return out;
}
