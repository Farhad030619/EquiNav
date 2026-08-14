const CACHE_NAME = 'equinav-cache-v8';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.css?v=20260814_1827',
  './app.js?v=20260814_1827',
  './db.js?v=20260814_1827',
  './logo.png?v=20260814_1827',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap'
];

// Install Service Worker and cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching static assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker and clear old caches
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

// Intercept requests and return cached versions if offline
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip caching for Supabase and OSRM API network requests
  if (requestUrl.host.includes('supabase.co') || requestUrl.host.includes('project-osrm.org')) {
    return; // Let the browser fetch directly from network
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch a fresh version in the background to update the cache (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => { /* Ignore offline network errors */ });

        return cachedResponse;
      }
      
      return fetch(event.request);
    })
  );
});
