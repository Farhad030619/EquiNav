const CACHE_NAME = 'equinav-cache-v17-akkes-ui';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.css?v=20260815_2300',
  './app.js?v=20260815_2300',
  './db.js?v=20260815_2300',
  './logo.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap'
];

// Install Service Worker and cache core files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching static assets for Akkes UI...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Service Worker and clear ALL old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy for index.html and fresh assets
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  if (requestUrl.host.includes('supabase.co') || requestUrl.host.includes('project-osrm.org')) {
    return;
  }

  // Network first for HTML to always get latest UI
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => { /* offline */ });

      return cachedResponse || fetchPromise;
    })
  );
});
