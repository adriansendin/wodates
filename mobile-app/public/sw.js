/**
 * Minimal Service Worker for PWA Installability
 * 
 * This service worker exists ONLY to make the app installable.
 * It does NOT cache any API responses, user data, or sensitive content.
 * 
 * Privacy & Security:
 * - No caching of /api/* endpoints
 * - No caching of chat, feed, or user data
 * - No offline data storage
 * - Online-first app behavior
 */

const CACHE_NAME = 'wodates-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  // Only cache static shell assets if needed for installability
  // DO NOT add API endpoints or dynamic content here
];

// Install event - minimal cache for installability only
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Only cache static shell - no API responses
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll failed (non-critical):', err);
        // Don't fail installation if static assets can't be cached
      });
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  return self.clients.claim();
});

// Fetch event - network-first strategy, NO caching of API/data
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NEVER cache API endpoints or sensitive data
  if (url.pathname.startsWith('/api/') || 
      url.pathname.includes('/chat') ||
      url.pathname.includes('/feed') ||
      url.pathname.includes('/matches')) {
    // Network-only for API/data - no caching
    event.respondWith(
      fetch(event.request).catch(() => {
        // If offline, return a simple error response
        // App UI should handle showing "no connection" message
        return new Response(
          JSON.stringify({ error: 'No connection' }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }
  
  // For static assets only: try network first, fallback to cache
  // This is minimal and only for installability
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache GET requests for static assets
        if (event.request.method === 'GET' && 
            !url.pathname.startsWith('/api/')) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache only for static assets
        return caches.match(event.request);
      })
  );
});
