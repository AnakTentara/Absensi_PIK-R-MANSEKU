/**
 * Service Worker untuk PWA Offline Cache
 * Sistem Absensi PIK-R MANSEKU
 */

const CACHE_NAME = "pikr-manseku-v3";
const ASSETS_TO_CACHE = [
  "./",
  "./dashboard",
  "./generator",
  "./index.html",
  "./dashboard.html",
  "./generator.html",
  "./css/style.css",
  "./js/config.js",
  "./js/crypto-util.js",
  "./js/scanner.js",
  "./js/dashboard.js",
  "./js/generator.js",
  "./logo/logo_pik-r.png",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Hanya tangani request GET static
  if (e.request.method !== "GET" || e.request.url.includes("script.google.com")) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(e.request).catch(() => {
        // Fallback jika offline
        return caches.match("./index.html");
      });
    })
  );
});
