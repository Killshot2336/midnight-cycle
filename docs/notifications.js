import { CONFIG } from "./firebase.js";

export function isWebPushSupported() {
  return ("Notification" in window) && ("serviceWorker" in navigator);
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "denied";
  const p = await Notification.requestPermission();
  return p;
}

export async function getMessagingIfSupported() {
  try {
    const mod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js");
    return mod;
  } catch {
    return null;
  }
}

export async function getOrCreateToken(fb, theme) {
  const msgMod = await getMessagingIfSupported();
  if (!msgMod) throw new Error("Messaging module not available");

  const { getMessaging, getToken, isSupported } = msgMod;

  const supported = await isSupported().catch(() => false);
  if (!supported) throw new Error("Push not supported on this device/browser");

  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const { getApps } = appMod;

  const apps = getApps();
  if (!apps.length) throw new Error("Firebase app not initialized");

  const messaging = getMessaging(apps[0]);

  // VAPID key is optional for some setups but recommended for web push.
  const vapidKey = (theme?.vapidKey || CONFIG.vapidKey || "").trim();
  const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined);

  if (!token) throw new Error("No token returned. Check permissions.");
  return token;
}

export async function removeToken(fb, currentToken) {
  try {
    const msgMod = await getMessagingIfSupported();
    if (!msgMod) return;
    const { getMessaging, deleteToken } = msgMod;

    const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const { getApps } = appMod;
    const apps = getApps();
    if (!apps.length) return;

    const messaging = getMessaging(apps[0]);
    await deleteToken(messaging);
  } catch {
    // ignore
  }
}