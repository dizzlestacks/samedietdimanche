const CACHE_NAME = "yardees-v4";
const API_CACHE_NAME = "yardees-api-v2";
const IMG_CACHE_NAME = "yardees-img-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

const CACHEABLE_API_PATTERNS = [
  /^\/api\/listings(\?|$)/,
  /^\/api\/listings\/\d+$/,
  /^\/api\/categories\/featured$/,
  /^\/api\/search\/trending$/,
  /^\/api\/collections(\?|$)/,
  /^\/api\/collections\/[^/]+$/
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keepCaches = [CACHE_NAME, API_CACHE_NAME, IMG_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !keepCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    const isCacheable = CACHEABLE_API_PATTERNS.some((p) => p.test(url.pathname + url.search.split("&_=")[0]));
    if (isCacheable) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(API_CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() =>
            caches.open(API_CACHE_NAME).then((cache) =>
              cache.match(request).then((cached) => {
                if (cached) {
                  const headers = new Headers(cached.headers);
                  headers.set("X-From-Cache", "true");
                  return new Response(cached.body, {
                    status: cached.status,
                    statusText: cached.statusText,
                    headers
                  });
                }
                return new Response(JSON.stringify({ items: [], total: 0, hasMore: false, offline: true }), {
                  status: 200,
                  headers: { "Content-Type": "application/json", "X-From-Cache": "true", "X-Offline-Empty": "true" }
                });
              })
            )
          )
      );
      return;
    }
    return;
  }

  if (url.pathname.startsWith("/uploads/")) {
    event.respondWith(
      caches.open(IMG_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) {
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response);
            }).catch(() => {});
            return cached;
          }
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => new Response("", { status: 404 }));
        })
      )
    );
    return;
  }

  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", clone));
          return response;
        })
        .catch(() =>
          caches.match("/").then((cached) =>
            cached || new Response("<html><body><h1>You are offline</h1><p>Please check your connection and try again.</p></body></html>", {
              status: 503,
              headers: { "Content-Type": "text/html" }
            })
          )
        )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) =>
          cached || new Response("Offline", { status: 503 })
        )
      )
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
