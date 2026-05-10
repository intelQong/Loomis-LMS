// ============================================================
// AIMS LMS — Service Worker
// Strategy:
//  - HTML pages: Network-only (always fresh, never cached)
//  - JS/CSS/Assets: Network-first, fall back to cache
//  - API calls: Never intercepted (pass through)
// Bump CACHE_VERSION on every deployment to bust stale caches.
// ============================================================

const CACHE_VERSION = 'aims-lms-v38';

// Static assets that are safe to cache (NOT html pages)
const STATIC_ASSETS = [
  '/styles/main.css',
  '/styles/auth.css',
  '/styles/dashboard.css',
  '/styles/admin.css',
  '/js/auth.js',
  '/js/app-data.js',
  '/js/api-client.js',
  '/js/student-dashboard.js',
  '/js/admin-dashboard.js',
  '/assets/aims-logo.jpeg',
  '/manifest.json'
];

// Install: cache only static assets (no HTML)
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Activate immediately on install
  e.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: delete ALL old caches immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // Take control of all open pages now
  );
});

self.addEventListener('fetch', (e) => {
  // Fix for Chrome/Edge ERR_FAILED on hard refresh
  if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;

  const url = new URL(e.request.url);

  // 1. Never intercept non-GET or API calls
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // 2. HTML pages: Network-only (always fetch fresh from server)
  if (e.request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 3. Static assets: Network-first, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
