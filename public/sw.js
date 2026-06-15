// OpsManifest Service Worker
// Cache-first for static assets; network-first for API and dynamic content.
// No-op when running from ms-appx-web: (MSIX packaged context) — the app is
// already offline-capable from the bundle and the SW fetch handler can crash
// WebView2 when intercepting ms-appx-web: scheme requests on Win 11 24H2+.
if (self.location.protocol === 'ms-appx-web:') { /* no-op */ }
else {

const CACHE = 'opsmanifest-v3';

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
        .catch(async () => {
          // Try cached version of this URL first, then root, then inline offline page
          const cached = await caches.match(event.request) || await caches.match('/');
          if (cached) return cached;
          return new Response(
            '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpsManifest</title></head>' +
            '<body style="margin:0;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;font-family:Inter,sans-serif;text-align:center;padding:24px">' +
            '<img src="/icon-192.png" style="width:64px;height:64px;border-radius:12px" alt="">' +
            '<div style="color:#f1f5f9;font-size:17px;font-weight:600">OpsManifest</div>' +
            '<div style="color:#94a3b8;font-size:13px">Unable to connect. Please check your connection.</div>' +
            '<button onclick="location.reload()" style="margin-top:8px;background:#0d9488;color:#fff;border:none;padding:8px 24px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500">Retry</button>' +
            '</body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
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

} // end ms-appx-web guard
