const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `portfolio-tracker-${CACHE_VERSION}`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './src/styles/main.css',
  './src/scripts/app.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('portfolio-tracker-') && name !== CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - cache-first strategy with network fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests separately (network-first with cache fallback)
  if (url.origin.includes('finnhub.io') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and cache successful API responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached API response if network fails
          return caches.match(request).then(cached => {
            if (cached) {
              // Add custom header to indicate stale data
              const headers = new Headers(cached.headers);
              headers.set('X-Cache-Status', 'stale');
              return new Response(cached.body, {
                status: cached.status,
                statusText: cached.statusText,
                headers: headers
              });
            }
            return new Response('Network error', { status: 503 });
          });
        })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(request).then(response => {
          // Cache successful GET requests for static assets
          if (request.method === 'GET' && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // Fallback for navigation requests when offline
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
