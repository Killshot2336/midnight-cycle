import { addDaysISO } from "./guard.js";
import { ANY_FLOW, deriveEpisodes } from "./cycleModel.js";

export function ensureVault(vault, tz) {
  const v = vault && typeof vault === "object" ? vault : {};
  const incoming = Number(v.version) || 0;
  v.profile = v.profile || {};
  v.profile.tz = v.profile.tz || tz || "America/Chicago";
  v.profile.notifyTime = v.profile.notifyTime || "18:30";
  if (!v.profile.situation) v.profile.situation = "cycling";
  if (!v.profile.goal) v.profile.goal = "bleed";
  v.daily = v.daily && typeof v.daily === "object" ? v.daily : {};
  v.periods = Array.isArray(v.periods) ? v.periods : [];

  if (typeof v.profile.onboarded !== "boolean") {
    const hasFlow = Object.values(v.daily).some((row) => ANY_FLOW.has(row?.flow));
    v.profile.onboarded = incoming < 3 && (v.periods.length > 0 || hasFlow);
  }

  if (!v.profile.periodsMigrated && incoming < 3) {
    for (const p of v.periods) {
      if (!p?.start) continue;
      const row = { ...(v.daily[p.start] || {}) };
      if (!row.flow) row.flow = "medium";
      v.daily[p.start] = row;
    }
    v.profile.periodsMigrated = true;
  } else if (!v.profile.periodsMigrated) {
    v.profile.periodsMigrated = true;
  }

  v.version = 3;
  return v;
}

function cloneDay(row) {
  if (!row) return null;
  return {
    ...row,
    symptoms: Array.isArray(row.symptoms) ? [...row.symptoms] : row.symptoms
  };
}

function refreshPeriods(vault) {
  const episodes = deriveEpisodes(vault.daily, null);
  vault.periods = episodes.map((e) => ({ start: e.start, lengthDays: e.bleedDays }));
}

export function updateDay(vault, iso, patch) {
  ensureVault(vault);
  if (!iso) return null;
  const prev = cloneDay(vault.daily[iso]);
  const next = { ...(vault.daily[iso] || {}), ...(patch || {}), updatedAt: Date.now() };
  if (patch && Object.prototype.hasOwnProperty.call(patch, "symptoms")) {
    next.symptoms = Array.isArray(patch.symptoms) ? [...patch.symptoms] : [];
  }
  vault.daily[iso] = next;
  refreshPeriods(vault);
  return prev;
}

export function restoreDay(vault, iso, prev) {
  ensureVault(vault);
  if (!prev) delete vault.daily[iso];
  else vault.daily[iso] = prev;
  refreshPeriods(vault);
  return vault;
}

export function setDaily(vault, iso, entry) {
  updateDay(vault, iso, entry || {});
  return vault;
}

export function addPeriodStart(vault, iso) {
  if (!iso) return vault;
  updateDay(vault, iso, { flow: "medium" });
  return vault;
}

export function markPeriodRange(vault, start, end, today) {
  if (!start || !end) return vault;
  let a = start;
  let b = end;
  if (b < a) {
    const swap = a;
    a = b;
    b = swap;
  }
  if (today && b > today) b = today;
  let iso = a;
  let n = 0;
  while (iso <= b && n < 14) {
    updateDay(vault, iso, { flow: "medium" });
    iso = addDaysISO(iso, 1);
    n += 1;
  }
  return vault;
}
