const CACHE_NAME = 'aims-lms-v3';
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
  '/assets/aims-logo.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Instantly replace the old broken SW
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim(); // Take control of all pages immediately
});

self.addEventListener('fetch', (e) => {
  // Fix for Chrome/Edge ERR_FAILED on hard refresh
  if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') {
    return;
  }
  
  // Exclude API calls and non-GET requests
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return;
  }
  
  // Network first strategy (safer for LMS)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Only cache valid responses
        if (res && res.status === 200 && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
