const CACHE_NAME = 'urlaubsplaner-v3';
const ASSETS = [
  'index.html',
  'assistenz.html',
  'style.css',
  'shared.js',
  'manifest-oa.json',
  'manifest-ass.json',
  'icon-192.png',
  'icon-512.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch events
self.addEventListener('fetch', (event) => {
  // Check if the request is for an external API (jsonbin)
  if (event.request.url.includes('api.jsonbin.io')) {
    // Network first for API calls, but could implement a fallback cache if needed
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
