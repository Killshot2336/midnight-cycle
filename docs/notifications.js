import { CONFIG } from "./firebase.js";

export async function enablePushFlow(fb, state, setStatus) {
  try {
    if (!fb || !fb.messaging) { setStatus("Push unsupported here"); return { ok:false }; }
    if (!("Notification" in window) || !("serviceWorker" in navigator)) { setStatus("Push unavailable"); return { ok:false }; }

    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setStatus("Permission denied"); return { ok:false }; }

    const swReg = await navigator.serviceWorker.ready;

    const token = await fb.getToken(fb.messaging, {
      vapidKey: CONFIG.vapidKey,
      serviceWorkerRegistration: swReg
    });

    if (!token) { setStatus("Token failed"); return { ok:false }; }

    state.fcmToken = token;
    const ref = fb.doc(fb.db, "users", fb.uid);
    await fb.setDoc(ref, { fcmToken: token }, { merge:true });

    setStatus("Enabled");
    return { ok:true, token };
  } catch (e) {
    setStatus("Enable failed");
    return { ok:false, error:String(e?.message||e) };
  }
}

export async function disablePushFlow(fb, setStatus) {
  try {
    if (!fb || !fb.messaging) { setStatus("Push unsupported"); return { ok:false }; }
    await fb.deleteToken(fb.messaging);
    setStatus("Disabled");
    return { ok:true };
  } catch (e) {
    setStatus("Disable failed");
    return { ok:false, error:String(e?.message||e) };
  }
}
