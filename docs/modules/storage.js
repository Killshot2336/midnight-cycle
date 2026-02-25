import { safe } from "./guard.js";

const KEY = "midnight.vault.v2";
const META = "midnight.meta.v2";

export function loadMeta() {
  return safe(() => JSON.parse(localStorage.getItem(META) || "{}"), {}) || {};
}

export function saveMeta(meta) {
  localStorage.setItem(META, JSON.stringify(meta || {}));
}

export function loadVaultRaw() {
  return localStorage.getItem(KEY) || "";
}

export function saveVaultRaw(raw) {
  localStorage.setItem(KEY, raw || "");
}

export function clearAllLocal() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(META);
}
