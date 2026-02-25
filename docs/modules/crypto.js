// WebCrypto Vault: AES-GCM with PBKDF2-derived key.
// Export format is JSON with base64 fields.

function encUtf8(s){ return new TextEncoder().encode(s); }
function decUtf8(b){ return new TextDecoder().decode(b); }

function b64(bytes){
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i=0;i<arr.length;i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}
function unb64(str){
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(text){
  const buf = await crypto.subtle.digest("SHA-256", encUtf8(text));
  const arr = new Uint8Array(buf);
  return [...arr].map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function deriveKey(password, saltBytes, iters=180000){
  const keyMat = await crypto.subtle.importKey(
    "raw",
    encUtf8(password),
    { name:"PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt: saltBytes, iterations: iters, hash:"SHA-256" },
    keyMat,
    { name:"AES-GCM", length: 256 },
    false,
    ["encrypt","decrypt"]
  );
}

export async function encryptJSON(password, obj){
  if (!password || password.length < 6) throw new Error("Password too short (min 6).");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const plain = encUtf8(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, plain);

  return {
    v: 1,
    kdf: "PBKDF2-SHA256",
    iters: 180000,
    alg: "AES-256-GCM",
    salt: b64(salt),
    iv: b64(iv),
    data: b64(cipher)
  };
}

export async function decryptJSON(password, vault){
  if (!vault || typeof vault !== "object") throw new Error("Invalid vault file.");
  const salt = unb64(vault.salt);
  const iv = unb64(vault.iv);
  const data = unb64(vault.data);

  const key = await deriveKey(password, salt, Number(vault.iters||180000));
  const plainBuf = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, data);
  const text = decUtf8(plainBuf);
  return JSON.parse(text);
}
