import { loadMeta, saveMeta, loadVaultRaw, saveVaultRaw } from "./storage.js";
import { encryptJSON, decryptJSON } from "./crypto.js";

export function hasPasscode() {
  const meta = loadMeta();
  return !!meta?.lock?.enabled;
}

export function isLocked() {
  const meta = loadMeta();
  return !!meta?.lock?.locked;
}

export function setLocked(state) {
  const meta = loadMeta();
  meta.lock = meta.lock || {};
  meta.lock.locked = !!state;
  saveMeta(meta);
}

export function getSalt() {
  const meta = loadMeta();
  return meta?.lock?.salt || "";
}

export function setSalt(salt) {
  const meta = loadMeta();
  meta.lock = meta.lock || {};
  meta.lock.salt = salt;
  saveMeta(meta);
}

export async function setPasscode(passcode, vaultObj) {
  const meta = loadMeta();
  meta.lock = meta.lock || {};
  meta.lock.enabled = true;
  meta.lock.locked = false;

  const enc = await encryptJSON(passcode, vaultObj, meta.lock.salt);
  meta.lock.salt = enc.salt;
  saveMeta(meta);
  saveVaultRaw(JSON.stringify(enc));
}

export async function unlock(passcode) {
  const meta = loadMeta();
  if (!meta?.lock?.enabled) return { ok:true, vault:null };

  const raw = loadVaultRaw();
  if (!raw) return { ok:true, vault:null };

  try {
    const enc = JSON.parse(raw);
    const vault = await decryptJSON(passcode, enc);
    meta.lock.locked = false;
    meta.lock.salt = enc.salt || meta.lock.salt;
    saveMeta(meta);
    return { ok:true, vault };
  } catch {
    return { ok:false, vault:null };
  }
}

export async function lockNow() {
  setLocked(true);
}
