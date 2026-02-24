import { lsGet, lsSet } from "./storage.js";

const PIN_KEY = "midnight_pin_hash_v1";
const LOCK_ENABLED_KEY = "midnight_lock_enabled_v1";

async function sha256(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isLockEnabled() {
  return !!lsGet(LOCK_ENABLED_KEY, false);
}

export function setLockEnabled(v) {
  lsSet(LOCK_ENABLED_KEY, !!v);
}

export function hasPin() {
  const h = lsGet(PIN_KEY, "");
  return typeof h === "string" && h.length > 20;
}

export async function setPin(pin) {
  const p = String(pin || "").trim();
  if (p.length < 4 || p.length > 12) throw new Error("PIN must be 4–12 digits");
  const h = await sha256(p);
  lsSet(PIN_KEY, h);
}

export function removePin() {
  lsSet(PIN_KEY, "");
  lsSet(LOCK_ENABLED_KEY, false);
}

export async function verifyPin(pin) {
  const p = String(pin || "").trim();
  const stored = lsGet(PIN_KEY, "");
  if (!stored) return false;
  const h = await sha256(p);
  return h === stored;
}