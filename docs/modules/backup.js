import { sha256Hex } from "./crypto.js";
import { storageKeys, setHash, getHash } from "./storage.js";

const SNAP_PREFIX = "midnight.snap.v1.";
const SNAP_MAX_DAILY = 14;
const SNAP_MAX_WEEKLY = 8;

function dayKey(dISO){ return `${SNAP_PREFIX}d.${dISO}`; }
function weekKey(yw){ return `${SNAP_PREFIX}w.${yw}`; }

function todayISO(){ return new Date().toISOString().slice(0,10); }

function yearWeek(d){
  const x = new Date(d + "T00:00:00");
  const first = new Date(x.getFullYear(),0,1);
  const days = Math.floor((x - first)/(1000*60*60*24));
  const wk = Math.floor((days + first.getDay())/7) + 1;
  return `${x.getFullYear()}-W${String(wk).padStart(2,"0")}`;
}

function list(prefix){
  const keys=[];
  for (let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  return keys.sort();
}

function prune(prefix, max){
  const keys = list(prefix);
  const extra = keys.length - max;
  if (extra <= 0) return;
  for (let i=0;i<extra;i++) localStorage.removeItem(keys[i]);
}

export async function computeAndStoreIntegrity(){
  const { KEY } = storageKeys();
  const raw = localStorage.getItem(KEY) || "";
  const hex = await sha256Hex(raw);
  setHash(hex);
  return hex;
}

export async function integrityStatus(){
  const { KEY } = storageKeys();
  const raw = localStorage.getItem(KEY) || "";
  if (!raw) return { ok:true, status:"EMPTY" };
  const current = await sha256Hex(raw);
  const stored = getHash();
  if (!stored) return { ok:true, status:"UNSEALED" };
  return { ok: current === stored, status: current === stored ? "OK" : "MISMATCH" };
}

export async function snapshotNow(){
  const { KEY } = storageKeys();
  const raw = localStorage.getItem(KEY);
  if (!raw) return { ok:false, reason:"no state" };

  const d = todayISO();
  localStorage.setItem(dayKey(d), raw);

  const yw = yearWeek(d);
  localStorage.setItem(weekKey(yw), raw);

  prune(`${SNAP_PREFIX}d.`, SNAP_MAX_DAILY);
  prune(`${SNAP_PREFIX}w.`, SNAP_MAX_WEEKLY);

  const hex = await computeAndStoreIntegrity();
  return { ok:true, day:d, week:yw, hash:hex };
}

export function countBackups(){
  const d = list(`${SNAP_PREFIX}d.`).length;
  const w = list(`${SNAP_PREFIX}w.`).length;
  return { daily:d, weekly:w };
}

export function latestBackupRaw(){
  const d = list(`${SNAP_PREFIX}d.`);
  if (d.length) return localStorage.getItem(d[d.length-1]);
  const w = list(`${SNAP_PREFIX}w.`);
  if (w.length) return localStorage.getItem(w[w.length-1]);
  return null;
}
