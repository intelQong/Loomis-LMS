const CACHE_NAME = 'aims-lms-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/student-dashboard.html',
  '/admin-dashboard.html',
  '/styles/index.css',
  '/styles/student-dashboard.css',
  '/styles/admin-dashboard.css',
  '/js/auth.js',
  '/js/app-data.js',
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
