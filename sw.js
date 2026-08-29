const CACHE_NAME = 'equinav-v27-navfix';
const ROUTE_CACHE = 'equinav-routes-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './index.css?v=20260829_2005',
  './app.js?v=20260829_2005',
  './db.js?v=20260829_2005',
  './logo.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching static assets for Akkes UI...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== ROUTE_CACHE) {
            console.log('SW: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'CACHE_ROUTE') {
    caches.open(ROUTE_CACHE).then((cache) => {
      // Create a synthetic response
      const response = new Response(JSON.stringify(event.data.data), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put(event.data.url || 'last-route', response);
      console.log('SW: Route cached explicitly for offline use');
    });
  }
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  if (requestUrl.host.includes('supabase.co')) {
    return;
  }

  // BLOCKERA alla gamla Carto-tiles – returnera tom PNG istället
  if (requestUrl.host.includes('basemaps.cartocdn.com') || requestUrl.host.includes('cartocdn.com')) {
    event.respondWith(
      new Response('', { status: 204, statusText: 'Blocked legacy Carto tile' })
    );
    return;
  }

  // OpenStreetMap Tiles: Cache First, then Network
  if (requestUrl.host.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(() => { /* offline tile */ });
      })
    );
    return;
  }
  
  // OSRM routes: Network First, fallback to ROUTE_CACHE
  if (requestUrl.host.includes('project-osrm.org')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(ROUTE_CACHE).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

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
