// OpsManifest Service Worker
// Cache-first for static assets; network-first for API and dynamic content.

const CACHE = 'opsmanifest-v2';

const PRECACHE = [
  '/',
  '/slides.html',
];

// Install — precache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - API calls (Anthropic proxy, Firebase, Stripe worker) → network only
// - Static assets (JS/CSS/images) → cache-first with network fallback
// - HTML navigation → network-first with cache fallback (ensures fresh SPA shell)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache API calls — always fetch live data
  if (
    url.hostname.includes('anthropic') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('stripe') ||
    url.hostname.includes('endoflife.date')
  ) {
    return; // fall through to network
  }

  // HTML navigations — network first, cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets — cache first, network fallback + update cache
  if (['script', 'style', 'image', 'font'].includes(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone));
          }
          return res;
        });
        return cached || networkFetch;
      })
    );
  }
});
