// ==================================================
// SLANCAR SERVICE WORKER v6 — PASS-THROUGH (DEV MODE)
// No caching. Always fetch fresh from network.
// This prevents stale-cache issues during development.
// ==================================================

const CACHE_NAME = 'slancar-v6';

// On install: activate immediately, delete ALL old caches
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Always fetch from network — NO caching at all
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // Only fallback to cache for navigation requests if offline
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
