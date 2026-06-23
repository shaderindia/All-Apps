const CACHE_NAME = "shader7-v17";

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
  "/passport-logo.webp",
  "/photopassportsizepro/banner.webp",
  "/cvbanao/banner.webp",
  "/berofchat/banner.webp",
  "/cnc-machinist/banner.webp",
  "/photocompressor/banner.webp",
  "/js/auto-render.min.js",
  "/js/cropper.min.js",
  "/js/GLTFLoader.js",
  "/js/html2canvas.min.js",
  "/js/jspdf.umd.min.js",
  "/js/katex.min.js",
  "/js/peerjs.min.js",
  "/js/three.min.js",
  "/js/three.r128.min.js",
  "/css/cropper.min.css",
  "/css/fonts.css",
  "/css/katex.min.css",
  "/webfonts/fa-brands-400.ttf",
  "/webfonts/fa-brands-400.woff2",
  "/webfonts/fa-regular-400.ttf",
  "/webfonts/fa-regular-400.woff2",
  "/webfonts/fa-solid-900.ttf",
  "/webfonts/fa-solid-900.woff2",
  "/webfonts/fa-v4compatibility.ttf",
  "/webfonts/fa-v4compatibility.woff2",
  "/css/fonts/KaTeX_AMS-Regular.ttf",
  "/css/fonts/KaTeX_AMS-Regular.woff",
  "/css/fonts/KaTeX_AMS-Regular.woff2",
  "/css/fonts/KaTeX_Caligraphic-Bold.ttf",
  "/css/fonts/KaTeX_Caligraphic-Bold.woff",
  "/css/fonts/KaTeX_Caligraphic-Bold.woff2",
  "/css/fonts/KaTeX_Caligraphic-Regular.ttf",
  "/css/fonts/KaTeX_Caligraphic-Regular.woff",
  "/css/fonts/KaTeX_Caligraphic-Regular.woff2",
  "/css/fonts/KaTeX_Fraktur-Bold.ttf",
  "/css/fonts/KaTeX_Fraktur-Bold.woff",
  "/css/fonts/KaTeX_Fraktur-Bold.woff2",
  "/css/fonts/KaTeX_Fraktur-Regular.ttf",
  "/css/fonts/KaTeX_Fraktur-Regular.woff",
  "/css/fonts/KaTeX_Fraktur-Regular.woff2",
  "/css/fonts/KaTeX_Main-Bold.ttf",
  "/css/fonts/KaTeX_Main-Bold.woff",
  "/css/fonts/KaTeX_Main-Bold.woff2",
  "/css/fonts/KaTeX_Main-BoldItalic.ttf",
  "/css/fonts/KaTeX_Main-BoldItalic.woff",
  "/css/fonts/KaTeX_Main-BoldItalic.woff2",
  "/css/fonts/KaTeX_Main-Italic.ttf",
  "/css/fonts/KaTeX_Main-Italic.woff",
  "/css/fonts/KaTeX_Main-Italic.woff2",
  "/css/fonts/KaTeX_Main-Regular.ttf",
  "/css/fonts/KaTeX_Main-Regular.woff",
  "/css/fonts/KaTeX_Main-Regular.woff2",
  "/css/fonts/KaTeX_Math-BoldItalic.ttf",
  "/css/fonts/KaTeX_Math-BoldItalic.woff",
  "/css/fonts/KaTeX_Math-BoldItalic.woff2",
  "/css/fonts/KaTeX_Math-Italic.ttf",
  "/css/fonts/KaTeX_Math-Italic.woff",
  "/css/fonts/KaTeX_Math-Italic.woff2",
  "/css/fonts/KaTeX_SansSerif-Bold.ttf",
  "/css/fonts/KaTeX_SansSerif-Bold.woff",
  "/css/fonts/KaTeX_SansSerif-Bold.woff2",
  "/css/fonts/KaTeX_SansSerif-Italic.ttf",
  "/css/fonts/KaTeX_SansSerif-Italic.woff",
  "/css/fonts/KaTeX_SansSerif-Italic.woff2",
  "/css/fonts/KaTeX_SansSerif-Regular.ttf",
  "/css/fonts/KaTeX_SansSerif-Regular.woff",
  "/css/fonts/KaTeX_SansSerif-Regular.woff2",
  "/css/fonts/KaTeX_Script-Regular.ttf",
  "/css/fonts/KaTeX_Script-Regular.woff",
  "/css/fonts/KaTeX_Script-Regular.woff2",
  "/css/fonts/KaTeX_Size1-Regular.ttf",
  "/css/fonts/KaTeX_Size1-Regular.woff",
  "/css/fonts/KaTeX_Size1-Regular.woff2",
  "/css/fonts/KaTeX_Size2-Regular.ttf",
  "/css/fonts/KaTeX_Size2-Regular.woff",
  "/css/fonts/KaTeX_Size2-Regular.woff2",
  "/css/fonts/KaTeX_Size3-Regular.ttf",
  "/css/fonts/KaTeX_Size3-Regular.woff",
  "/css/fonts/KaTeX_Size3-Regular.woff2",
  "/css/fonts/KaTeX_Size4-Regular.ttf",
  "/css/fonts/KaTeX_Size4-Regular.woff",
  "/css/fonts/KaTeX_Size4-Regular.woff2",
  "/css/fonts/KaTeX_Typewriter-Regular.ttf",
  "/css/fonts/KaTeX_Typewriter-Regular.woff",
  "/css/fonts/KaTeX_Typewriter-Regular.woff2",
  "/cnc-machinist/textures/anti_slip_concrete/anti_slip_concrete_ao.jpg",
  "/cnc-machinist/textures/anti_slip_concrete/anti_slip_concrete_diffuse.jpg",
  "/cnc-machinist/textures/anti_slip_concrete/anti_slip_concrete_displacement.jpg",
  "/cnc-machinist/textures/anti_slip_concrete/anti_slip_concrete_normal.jpg",
  "/cnc-machinist/textures/anti_slip_concrete/anti_slip_concrete_roughness.jpg",
  "/cnc-machinist/textures/black_painted_planks/black_painted_planks_ao.jpg",
  "/cnc-machinist/textures/black_painted_planks/black_painted_planks_diffuse.jpg",
  "/cnc-machinist/textures/black_painted_planks/black_painted_planks_displacement.jpg",
  "/cnc-machinist/textures/black_painted_planks/black_painted_planks_normal.jpg",
  "/cnc-machinist/textures/black_painted_planks/black_painted_planks_roughness.jpg",
  "/cnc-machinist/textures/metal_plate/metal_plate_ao.jpg",
  "/cnc-machinist/textures/metal_plate/metal_plate_diffuse.jpg",
  "/cnc-machinist/textures/metal_plate/metal_plate_displacement.jpg",
  "/cnc-machinist/textures/metal_plate/metal_plate_metallic.jpg",
  "/cnc-machinist/textures/metal_plate/metal_plate_normal.jpg",
  "/cnc-machinist/textures/metal_plate/metal_plate_roughness.jpg",
  "/cnc-machinist/models/covered_car/covered_car.bin",
  "/cnc-machinist/models/covered_car/covered_car_1k.gltf",
  "/cnc-machinist/models/covered_car/textures/covered_car_arm_1k.jpg",
  "/cnc-machinist/models/covered_car/textures/covered_car_diff_1k.jpg",
  "/cnc-machinist/models/covered_car/textures/covered_car_nor_gl_1k.jpg"
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
