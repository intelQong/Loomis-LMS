const CACHE_NAME = 'aims-lms-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/student-dashboard.html',
  '/admin-dashboard.html',
  '/styles/main.css',
  '/styles/auth.css',
  '/styles/dashboard.css',
  '/styles/admin.css',
  '/js/auth.js',
  '/js/app-data.js',
  '/js/api-client.js',
  '/js/student-dashboard.js',
  '/js/admin-dashboard.js',
  '/assets/aims-logo.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  // Exclude API requests
  if (e.request.url.includes('/api/')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
