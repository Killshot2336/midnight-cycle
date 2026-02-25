export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyDFOyUfVC50l2wNPZH3IiYl-iW8BrQvYR8",
    authDomain: "midnight-cycle.firebaseapp.com",
    projectId: "midnight-cycle",
    storageBucket: "midnight-cycle.firebasestorage.app",
    messagingSenderId: "764643659642",
    appId: "1:764643659642:web:63644f01ccc8ec8dcc50c3"
  },
  vapidKey: "BCcoIajxjGz6FkLnI_IIOnzLCLnOFOGCVYozVmqsvQppgx9HtNflJZcwPQYlYEReWeQd4KSY97edjXLBBrJfL-Q",
  defaults: {
    tz: "America/Chicago",
    notifyTime: "18:30"
  }
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getMessaging, getToken, deleteToken, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

export async function initFirebase() {
  const app = initializeApp(CONFIG.firebase);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const messagingSupported = await isSupported().catch(()=>false);
  const messaging = messagingSupported ? getMessaging(app) : null;

  await signInAnonymously(auth);
  const uid = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u?.uid) { unsub(); resolve(u.uid); }
    });
  });

  return { app, auth, db, messaging, uid, doc, setDoc, getDoc, serverTimestamp, getToken, deleteToken };
}

export async function ensureUserDoc(fb) {
  const ref = doc(fb.db, "users", fb.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const payload = {
    tz: CONFIG.defaults.tz,
    notifyTime: CONFIG.defaults.notifyTime,
    fcmToken: "",
    lastPeriodStart: "",
    meanCycleDays: 0,
    sdCycleDays: 0,
    lastNotifiedDate: "",
    forecastPushEnabled: true,
    createdAt: serverTimestamp()
  };

  await setDoc(ref, payload, { merge:true });
  return payload;
}
