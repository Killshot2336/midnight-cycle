// AES-GCM with PBKDF2 passcode-derived key.
// If no passcode set, we store plaintext vault JSON (still local-only).

const te = new TextEncoder();
const td = new TextDecoder();

function b64u(bytes) {
  let s = "";
  bytes.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function unb64u(str) {
  const s = str.replaceAll("-","+").replaceAll("_","/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function deriveKey(passcode, saltB64u) {
  const salt = saltB64u ? unb64u(saltB64u) : crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey(
    "raw",
    te.encode(passcode),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    { name:"PBKDF2", salt, iterations: 250000, hash:"SHA-256" },
    baseKey,
    { name:"AES-GCM", length:256 },
    false,
    ["encrypt","decrypt"]
  );
  return { key, saltB64u: saltB64u || b64u(salt) };
}

export async function encryptJSON(passcode, obj, saltB64u) {
  const { key, saltB64u: saltOut } = await deriveKey(passcode, saltB64u);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = te.encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, data));
  return {
    v: 1,
    salt: saltOut,
    iv: b64u(iv),
    ct: b64u(ct)
  };
}

export async function decryptJSON(passcode, enc) {
  const { key } = await deriveKey(passcode, enc.salt);
  const iv = unb64u(enc.iv);
  const ct = unb64u(enc.ct);
  const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct);
  return JSON.parse(td.decode(pt));
}
