// __BUILD__ is replaced with the commit SHA at deploy, so each deploy gets a fresh cache.
const VERSION = "__BUILD__";
const CACHE = `tzer-${VERSION}`;
const PRECACHE = [
  "./",
  `app.js?v=${VERSION}`,
  `zones.js?v=${VERSION}`,
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("tzer-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  // Unstamped local builds share one cache name, so skip caching there to always serve fresh files.
  if (req.method !== "GET" || VERSION.startsWith("__")) return;
  const url = new URL(req.url);

  // Pages: network first so a new deploy shows up straight away, cached copy when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./"))
    );
    return;
  }

  // Scripts, icons and fonts: cache first; versioned URLs make this safe.
  if (url.origin === location.origin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
  }
});
