const CACHE_NAME = 'badmintoncounter-shell-v31';
// Relative zum sw.js-Standort, damit es sowohl unter der Domain-Wurzel
// (lokaler node:http-Server) als auch unter einem Unterpfad
// (z.B. GitHub Pages: /BadmintonCounter-WebApp/) funktioniert.
const SHELL_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/rules.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// { cache: 'no-store' } überall unten ist bewusst: GitHub Pages sendet
// "Cache-Control: max-age=600" auf statische Dateien, und ein normaler
// fetch() respektiert diesen HTTP-Cache — d.h. ohne no-store könnte der
// Browser bis zu 10 Minuten lang eine veraltete Antwort liefern, OHNE
// überhaupt eine Netzwerkanfrage zu stellen, egal wie "network-first"
// dieser Service Worker gemeint ist. no-store umgeht den HTTP-Cache
// komplett; die Offline-Fähigkeit kommt ausschließlich aus der eigenen
// Cache Storage (CACHE_NAME) unten, nicht aus dem HTTP-Cache.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        SHELL_ASSETS.map((url) => fetch(url, { cache: 'no-store' }).then((res) => cache.put(url, res)))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
