import { todayISO } from "./guard.js";

export function ensureSexDefaults(vault) {
  vault.sexLog = vault.sexLog || {}; // iso -> { protection, notes }
  return vault;
}

export function getSexEntry(vault, iso) {
  ensureSexDefaults(vault);
  return vault.sexLog[iso] || null;
}

export function setSexEntry(vault, iso, entry) {
  ensureSexDefaults(vault);
  vault.sexLog[iso] = {
    protection: entry.protection || "unknown",
    notes: entry.notes || "",
    updatedAt: Date.now()
  };
  return vault;
}

export function deleteSexEntry(vault, iso) {
  ensureSexDefaults(vault);
  delete vault.sexLog[iso];
  return vault;
}

export function listSexEntries(vault, limit = 25) {
  ensureSexDefaults(vault);
  const items = Object.entries(vault.sexLog)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0))
    .slice(0, limit);
  return items;
}

export function seedSexDateInput(el, tz) {
  const iso = todayISO(tz);
  el.value = iso;
}
