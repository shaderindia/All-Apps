const CACHE_NAME = "shader7-quick-private-chat-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.json",
  "./app.js",
  "./app.css"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => null);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
        return cached || (event.request.mode === "navigate" ? caches.match("./app.html") : Response.error());
      });
    })
  );
});
