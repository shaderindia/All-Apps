const CACHE_NAME = "shader7-v8";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/sitemap.html",
  "/about.html",
  "/contact.html",
  "/privacy-policy.html",
  "/terms.html",
  "/photocompressor/",
  "/photopassportsizepro/",
  "/passportsizephoto/",
  "/cvbanao/",
  "/hourlysalarycalculator/",
  "/receiptpro/",
  "/fairshare/",
  "/berofchat/",
  "/cnc-machinist/",
  "/css/tailwind.min.css",
  "/css/font-awesome.min.css",
  "/fonts/Inter-Variable.woff2",
  "/cubes.png",
  "/black-linen.png",
  "/passport-logo.jpg",
  "/photopassportsizepro/banner.jpg",
  "/cvbanao/banner.png",
  "/berofchat/banner.jpg",
  "/cnc-machinist/banner.jpg",
  "/photocompressor/banner.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of CORE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (error) {
          console.warn("Failed to cache:", asset, error);
        }
      }
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (
    url.hostname.includes("googletagmanager.com") ||
    url.hostname.includes("google-analytics.com") ||
    url.hostname.includes("googlesyndication.com") ||
    url.hostname.includes("doubleclick.net") ||
    url.hostname.includes("googleadservices.com") ||
    url.hostname.includes("pagead2.googlesyndication.com")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match("/index.html");
          });
        })
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }

          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});
