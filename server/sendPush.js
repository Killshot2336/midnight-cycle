import admin from "firebase-admin";

// Secrets required:
// FIREBASE_PROJECT_ID
// FIREBASE_SERVICE_ACCOUNT_JSON  (full JSON string)

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const projectId = must("FIREBASE_PROJECT_ID");
const serviceJSON = must("FIREBASE_SERVICE_ACCOUNT_JSON");

const cred = admin.credential.cert(JSON.parse(serviceJSON));

admin.initializeApp({
  credential: cred,
  projectId
});

const db = admin.firestore();

function ymdInTZ(date, tz) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(date); // YYYY-MM-DD
}

function hmInTZ(date, tz) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
  return f.format(date); // HH:MM
}

function withinWindow(now, tz, targetHHMM, minutes = 10) {
  const nowHM = hmInTZ(now, tz);
  // crude window: match exact HH:MM OR within +/- minutes by stepping
  if (nowHM === targetHHMM) return true;

  // compute numeric minutes for both
  const [nh, nm] = nowHM.split(":").map(Number);
  const [th, tm] = targetHHMM.split(":").map(Number);
  const nowM = nh * 60 + nm;
  const tarM = th * 60 + tm;
  return Math.abs(nowM - tarM) <= minutes;
}

async function main() {
  const now = new Date();

  const snap = await db.collection("users").where("forecastPushEnabled", "==", true).get();
  if (snap.empty) return;

  const sends = [];
  for (const doc of snap.docs) {
    const u = doc.data() || {};
    const token = (u.fcmToken || "").trim();
    if (!token) continue;

    const tz = (u.tz || "America/Chicago").trim();
    const notifyTime = (u.notifyTime || "18:30").trim();
    if (!/^\d{2}:\d{2}$/.test(notifyTime)) continue;

    const today = ymdInTZ(now, tz);
    if (u.lastNotifiedDate === today) continue;

    // GitHub cron runs every 10 minutes, allow small window
    if (!withinWindow(now, tz, notifyTime, 9)) continue;

    const payload = {
      token,
      notification: {
        title: "Midnight",
        body: "Check-in",
      },
      data: {
        kind: "checkin",
        date: today
      },
      android: { priority: "high" }
    };

    sends.push({ uid: doc.id, payload, today });
  }

  for (const s of sends) {
    try {
      await admin.messaging().send(s.payload);
      await db.collection("users").doc(s.uid).set({ lastNotifiedDate: s.today }, { merge: true });
      console.log("sent", s.uid);
    } catch (e) {
      console.log("fail", s.uid, String(e?.message || e));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});