const CACHE = "midnight-cache-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase.js",
  "./notifications.js",
  "./manifest.json",
  "./modules/guard.js",
  "./modules/storage.js",
  "./modules/theme.js",
  "./modules/pin.js",
  "./modules/cycleEngine.js",
  "./modules/driftModel.js",
  "./modules/forecastEngine.js",
  "./modules/calendar.js"
];

self.addEventListener("install", (evt) => {
  evt.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (evt) => {
  const req = evt.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== location.origin) return;

  evt.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
      return res;
    } catch {
      // fallback
      return caches.match("./index.html");
    }
  })());
});