self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("midnight-v1").then((cache) => cache.addAll([
      "./",
      "./index.html",
      "./styles.css",
      "./app.js",
      "./firebase.js",
      "./notifications.js",
      "./manifest.json",
      "./modules/guard.js",
      "./modules/theme.js",
      "./modules/storage.js",
      "./modules/backup.js",
      "./modules/crypto.js",
      "./modules/driftModel.js",
      "./modules/cycleEngine.js",
      "./modules/forecastEngine.js",
      "./modules/probability.js",
      "./modules/calendar.js",
      "./modules/timeline.js",
      "./modules/insights.js",
      "./modules/skilltree.js",
      "./modules/sexLog.js",
      "./modules/lock.js",
      "./modules/notifyFallback.js"
    ]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => hit))
  );
});

// Push handler (if supported by device/browser)
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  const title = data.title || "Midnight";
  const body = data.body || "Daily cycle reminder.";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: data.data || {}
    })
  );
});
