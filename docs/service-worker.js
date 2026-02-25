const CACHE = "midnight-cache-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./firebase.js",
  "./notifications.js",

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
  "./modules/skilltree.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;

    try {
      const res = await fetch(e.request);
      const c = await caches.open(CACHE);
      c.put(e.request, res.clone());
      return res;
    } catch {
      return caches.match("./index.html");
    }
  })());
});
