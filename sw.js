// ==================================================
// SLANCAR PWA SERVICE WORKER v5 — Network First
// Strategy: Always fetch fresh, fallback to cache
// ==================================================

const CACHE_NAME = 'slancar-v5';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/supabaseClient.js',
  './js/decisionEngine.js',
  './js/aiManager.js',
  './js/app.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// NETWORK FIRST strategy — always try network, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // For HTML & JS files: always network first (no cache lock)
  const url = new URL(event.request.url);
  const isAppFile = url.hostname === self.location.hostname;

  if (isAppFile) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Cache the fresh response (strip query string key)
          if (networkResponse && networkResponse.status === 200) {
            const cache = caches.open(CACHE_NAME).then(c => {
              c.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback — serve from cache
          return caches.match(event.request)
            .then(cached => cached || caches.match('./index.html'));
        })
    );
  } else {
    // External CDN (Tailwind, Lucide, Supabase) — cache first
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});
