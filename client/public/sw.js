/* OmniSuite ERP Service Worker
   - App Shell caching: HTML, JS, CSS
   - Static asset caching: images, fonts
   - API runtime caching: GET requests (network-first with background update)
   - Intelligent cache versioning & cleanup
*/

const VERSION = "v1";
const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/src/main.jsx", // Vite will rewrite module paths; shell handles fallback
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) => ![APP_SHELL_CACHE, STATIC_CACHE, RUNTIME_CACHE].includes(k),
          )
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isGETApi(url) {
  return url.pathname.startsWith("/api") || url.href.includes("/api/");
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/src/assets/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") {
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const resp = await fetch(req);
          if (resp && resp.status === 200) cache.put(req, resp.clone());
          return resp;
        } catch {
          return cached || caches.match("/index.html");
        }
      }),
    );
    return;
  }

  if (isGETApi(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        try {
          const networkResp = await fetch(req);
          if (networkResp && networkResp.status === 200) {
            cache.put(req, networkResp.clone());
          }
          return networkResp;
        } catch {
          const cached = await cache.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ offline: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      })(),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).catch(async () => {
        if (req.mode === "navigate") {
          const html = await caches.match("/index.html");
          if (html) return html;
        }
        return new Response("", { status: 503 });
      });
    }),
  );
});
