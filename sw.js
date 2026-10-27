// ==================================================
// SLANCAR PWA SERVICE WORKER (OFFLINE CAPABLE)
// ==================================================

const CACHE_NAME = 'slancar-v3';
const ASSETS_TO_CACHE = [
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
      console.log('Caching initial assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    }).catch(() => {
      return caches.match('./index.html');
    })
  );
});
