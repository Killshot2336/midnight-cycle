// docs/firebase.js
export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyDFOyUfVC50l2wNPZH3IiYl-iW8BrQvYR8",
    authDomain: "midnight-cycle.firebaseapp.com",
    projectId: "midnight-cycle",
    storageBucket: "midnight-cycle.firebasestorage.app",
    messagingSenderId: "764643659642",
    appId: "1:764643659642:web:63644f01ccc8ec8dcc50c3"
  },

  // Optional VAPID key for web push (Firebase Console -> Cloud Messaging -> Web Push certificates)
  vapidKey: "BCcoIajxjGz6FkLnI_IIOnzLCLnOFOGCVYozVmqsvQppgx9HtNflJZcwPQYlYEReWeQd4KSY97edjXLBBrJfL-Q",

  defaults: {
    tz: "America/Chicago",
    notifyTime: "18:30",
    meanCycleDays: 28,
    sdCycleDays: 4.5
  },

  schemaVersion: 1
};

function hasFirebaseConfig(cfg) {
  const need = ["apiKey", "authDomain", "projectId", "appId"];
  return !!cfg && need.every((k) => typeof cfg[k] === "string" && cfg[k].trim().length > 0);
}

function safeJSONParse(s) { try { return JSON.parse(s); } catch { return null; } }
function nowISO() { return new Date().toISOString(); }

const LOCAL_KEY = "midnight_local_user_v2";

function localGetUser() {
  const raw = localStorage.getItem(LOCAL_KEY);
  const data = safeJSONParse(raw);
  if (data && typeof data === "object") return healUserDoc(data);
  const fresh = healUserDoc({
    schemaVersion: CONFIG.schemaVersion,
    uid: "local-only",
    createdAtISO: nowISO(),
    updatedAtISO: nowISO()
  });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(fresh));
  return fresh;
}
function localSaveUser(patch) {
  const cur = localGetUser();
  const next = healUserDoc({ ...cur, ...patch, updatedAtISO: nowISO() });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  return next;
}

export async function initFirebase() {
  if (!hasFirebaseConfig(CONFIG.firebase)) {
    return {
      mode: "local",
      uid: "local-only",
      db: null,
      getDoc: async () => ({ exists: () => true, data: () => localGetUser() }),
      setDoc: async (_ref, data, _opts) => { localSaveUser(data); },
      updateDoc: async (_ref, patch) => { localSaveUser(patch); },
      serverTimestamp: () => nowISO()
    };
  }

  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
  ]);

  const { getAuth, signInAnonymously, onAuthStateChanged } = authMod;
  const { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } = fsMod;

  const app = initializeApp(CONFIG.firebase);
  const auth = getAuth(app);
  const firestore = getFirestore(app);

  const uid = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Auth timeout")), 12000);
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (u?.uid) {
          clearTimeout(timeout);
          unsub();
          resolve(u.uid);
          return;
        }
        await signInAnonymously(auth);
      } catch (e) {
        clearTimeout(timeout);
        unsub();
        reject(e);
      }
    });
  });

  const db = { _firestore: firestore, _doc: doc };

  return { mode: "firebase", uid, db, getDoc, setDoc, updateDoc, serverTimestamp };
}

export function userRef(db, uid) {
  if (!db) return { __local: true, uid };
  return db._doc(db._firestore, "users", uid);
}

export async function ensureUserDoc(fb) {
  if (fb.mode === "local") return localGetUser();

  const ref = userRef(fb.db, fb.uid);
  const snap = await fb.getDoc(ref);
  if (!snap.exists()) {
    const fresh = healUserDoc({
      schemaVersion: CONFIG.schemaVersion,
      uid: fb.uid,
      createdAt: fb.serverTimestamp(),
      updatedAt: fb.serverTimestamp()
    });
    await fb.setDoc(ref, fresh, { merge: true });
    return fresh;
  }

  const data = snap.data();
  const healed = healUserDoc(data);
  const changed = JSON.stringify(healed) !== JSON.stringify(data);
  if (changed) await fb.setDoc(ref, { ...healed, updatedAt: fb.serverTimestamp() }, { merge: true });
  return healed;
}

function healUserDoc(u) {
  const out = { ...(u || {}) };
  out.schemaVersion = CONFIG.schemaVersion;

  if (typeof out.uid !== "string") out.uid = "unknown";

  if (!Array.isArray(out.periodStarts)) out.periodStarts = [];
  out.periodStarts = out.periodStarts
    .filter((x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x))
    .sort();

  if (typeof out.lastPeriodStart !== "string") out.lastPeriodStart = "";
  if (out.lastPeriodStart && !/^\d{4}-\d{2}-\d{2}$/.test(out.lastPeriodStart)) out.lastPeriodStart = "";

  if (!Number.isFinite(out.meanCycleDays)) out.meanCycleDays = CONFIG.defaults.meanCycleDays;
  if (!Number.isFinite(out.sdCycleDays)) out.sdCycleDays = CONFIG.defaults.sdCycleDays;

  if (typeof out.tz !== "string" || !out.tz) out.tz = CONFIG.defaults.tz;
  if (typeof out.notifyTime !== "string" || !/^\d{2}:\d{2}$/.test(out.notifyTime)) out.notifyTime = CONFIG.defaults.notifyTime;

  if (typeof out.forecastPushEnabled !== "boolean") out.forecastPushEnabled = false;
  if (typeof out.fcmToken !== "string") out.fcmToken = "";

  if (!out.daily || typeof out.daily !== "object") out.daily = {};
  for (const [k, v] of Object.entries(out.daily)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") { delete out.daily[k]; continue; }
    if (typeof v.sex !== "boolean") delete v.sex;
    if (typeof v.note !== "string") delete v.note;
    if (v.symptoms && !Array.isArray(v.symptoms)) delete v.symptoms;
    if (Array.isArray(v.symptoms)) v.symptoms = v.symptoms.filter((s) => typeof s === "string").slice(0, 30);
    if (v.checkin && typeof v.checkin !== "object") delete v.checkin;
  }

  return out;
}