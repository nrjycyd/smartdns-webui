// Cache only the public offline page. Management pages, API responses, and
// Next.js resources always use the network so updates and session data stay fresh.
const CACHE_NAME = 'smartdns-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('smartdns-offline-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' ||
      url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(OFFLINE_URL)) || Response.error();
  }));
});
