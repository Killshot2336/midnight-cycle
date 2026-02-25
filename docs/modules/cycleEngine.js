import { clamp, daysBetweenISO, addDaysISO } from "./guard.js";
import { computeDriftStats } from "./driftModel.js";

// Vault schema we use:
// vault = {
//   version: 2,
//   profile: { tz, notifyTime, theme },
//   periods: [{ start:"YYYY-MM-DD", lengthDays: number|null }],
//   daily: { "YYYY-MM-DD": { mood, pain, flow, notes } },
//   sexLog: { ... }
// }

export function ensureVault(vault, tz) {
  const v = vault || {};
  v.version = 2;
  v.profile = v.profile || { tz, notifyTime:"18:30", theme:null };
  v.periods = v.periods || []; // {start, lengthDays?}
  v.daily = v.daily || {};
  return v;
}

export function addPeriodStart(vault, iso) {
  ensureVault(vault);
  // prevent duplicates
  if (!vault.periods.some(p => p.start === iso)) {
    vault.periods.push({ start: iso, lengthDays: null });
    vault.periods.sort((a,b)=>a.start.localeCompare(b.start));
  }
  return vault;
}

export function setDaily(vault, iso, entry) {
  ensureVault(vault);
  vault.daily[iso] = { ...(vault.daily[iso]||{}), ...(entry||{}), updatedAt: Date.now() };
  return vault;
}

export function getRecentStarts(vault, max=10) {
  ensureVault(vault);
  const starts = vault.periods.map(p=>p.start).sort();
  return starts.slice(-max);
}

export function inferCycleParams(vault) {
  const starts = getRecentStarts(vault, 12);
  const drift = computeDriftStats(starts);

  // If we have a decent mean, use it; else fallback to 28.
  const mean = drift.mean > 0 ? drift.mean : 28;

  // widen uncertainty when chaotic
  const sd = drift.sd > 0 ? drift.sd : (drift.chaotic ? 7 : 4);

  return { meanCycleDays: mean, sdCycleDays: sd, chaotic: drift.chaotic, chaosScore: drift.score };
}

export function dayIndexFromLastStart(vault, iso) {
  const starts = getRecentStarts(vault, 1);
  if (!starts.length) return null;
  return daysBetweenISO(starts[0], iso);
}

// simple phase windows relative to predicted ovulation/period,
// with uncertainty handled in probability module.
export function nominalWindows(mean) {
  const cycle = Math.max(18, Math.min(45, Math.round(mean)));
  const ovu = Math.max(9, Math.min(cycle-10, Math.round(cycle * 0.5)));
  return {
    cycle,
    ovuDay: ovu,
    pmsStart: Math.max(ovu+3, cycle-7),
    periodLen: 5
  };
}

export function nextPeriodDate(vault, fromISO) {
  const { meanCycleDays } = inferCycleParams(vault);
  const starts = getRecentStarts(vault, 1);
  if (!starts.length) return null;
  const last = starts[0];
  const next = addDaysISO(last, Math.round(meanCycleDays));
  if (fromISO && next < fromISO) return fromISO; // defensive
  return next;
}
