const CACHE_VERSION = "v1";
const ASSET_CACHE = "omnisuite-assets-" + CACHE_VERSION;
const API_CACHE = "omnisuite-api-" + CACHE_VERSION;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      await cache.addAll([
        "/",
        "/index.html",
        "/manifest.webmanifest",
        "/pwa-192x192.png",
        "/pwa-512x512.png",
        "/apple-touch-icon.png",
        "/OMNISUITE_ICON_CLEAR.png",
      ]);
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== ASSET_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((resp) => {
      if (resp && resp.status === 200) {
        cache.put(request, resp.clone());
      }
      return resp;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(req);
          const cache = await caches.open(ASSET_CACHE);
          if (resp && resp.status === 200) {
            cache.put("/index.html", resp.clone());
          }
          return resp;
        } catch {
          const cached = await caches.match("/index.html");
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  const dest = req.destination;
  if (dest === "script" && url.pathname.startsWith("/assets/")) {
    event.respondWith(staleWhileRevalidate(ASSET_CACHE, req));
    return;
  }
  if (dest === "style" || dest === "image" || dest === "font") {
    event.respondWith(staleWhileRevalidate(ASSET_CACHE, req));
    return;
  }

  if (url.pathname.startsWith("/api") && req.method === "GET") {
    event.respondWith(staleWhileRevalidate(API_CACHE, req));
    return;
  }
});
