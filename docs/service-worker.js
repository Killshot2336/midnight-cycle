self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("midnight-v4").then((cache) => cache.addAll([
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
      "./modules/cycleModel.js",
      "./modules/cycleEngine.js",
      "./modules/forecastEngine.js",
      "./modules/probability.js",
      "./modules/calendar.js",
      "./modules/timeline.js",
      "./modules/insights.js",
      "./modules/skilltree.js",
      "./modules/sexLog.js",
      "./modules/lock.js",
      "./modules/notifyFallback.js",
      "./icon-192.png",
      "./icon-512.png"
    ]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== "midnight-v4").map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open("midnight-v4");
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
      return fresh;
    } catch {
      const hit = await cache.match(req) || await caches.match(req);
      if (hit) return hit;
      return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
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
