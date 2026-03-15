const CACHE_VERSION = "v2";
const ASSET_CACHE = "omnisuite-assets-" + CACHE_VERSION;
const API_CACHE = "omnisuite-api-" + CACHE_VERSION;
const DEV_MODE =
  typeof self !== "undefined" &&
  typeof self.location !== "undefined" &&
  (self.location.port === "5173" ||
    (self.location.hostname === "localhost" && self.location.port !== ""));

if (!DEV_MODE) {
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
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k !== ASSET_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k)),
        );
      } catch {}
      await self.clients.claim();
    })(),
  );
});

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = (async () => {
    try {
      const resp = await fetch(request);
      if (resp && resp.ok) {
        const t = resp.type;
        const canCache =
          t === "basic" ||
          t === "default" ||
          // allow opaque only when request is same-origin path
          (t === "opaque" &&
            typeof request.url === "string" &&
            request.url.startsWith(self.location.origin));
        if (canCache) {
          try {
            await cache.put(request, resp.clone());
          } catch (e) {
            // swallow cache put errors (opaque, vary:*, etc.)
          }
        }
      }
      return resp;
    } catch (e) {
      return cached;
    }
  })();
  return cached || networkPromise;
}

if (!DEV_MODE) {
  self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(req);
          const cache = await caches.open(ASSET_CACHE);
          if (resp && resp.ok) {
            try {
              await cache.put("/index.html", resp.clone());
            } catch (e) {}
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
}

self.addEventListener("push", (event) => {
  try {
    const data = event?.data ? event.data.json() : {};
    const title = String(data.title || "Notification");
    const body = String(data.message || data.body || "");
    const icon = data.icon || "/OMNISUITE_ICON_CLEAR.png";
    const badge = data.badge || "/OMNISUITE_ICON_CLEAR.png";
    const link = data.link || data.url || "/notifications";
    const tag = data.tag || "omnisuite-push";
    const actions = Array.isArray(data.actions) ? data.actions : [];
    const options = {
      body,
      icon,
      badge,
      tag,
      data: { link, ...(data || {}) },
      actions,
      silent: false,
    };
    event.waitUntil(
      (async () => {
        await self.registration.showNotification(title, options);
        try {
          const t = String(data?.type || "").toLowerCase();
          if (t === "chat" || t === "workflow" || t === "workflow-forward") {
            const clients = await self.clients.matchAll({
              type: "window",
              includeUncontrolled: true,
            });
            for (const c of clients) {
              c.postMessage({
                type: t === "chat" ? "chat_push" : "workflow_push",
                url: link,
                id:
                  data?.cid ||
                  data?.workflowInstanceId ||
                  data?.documentId ||
                  null,
                title,
                body,
              });
            }
          }
        } catch {}
      })(),
    );
  } catch (e) {}
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.link || "/notifications";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client =
        allClients.find((c) => c.url.includes(url)) || allClients[0] || null;
      if (client) {
        client.focus();
        client.postMessage({ type: "navigate", url });
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
