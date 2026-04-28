const CACHE_NAME = 'journal-v3.4.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './animations.css',
  './manifest.json',
  './js/dom-ids.js',
  './js/security.js',
  './js/theme.js',
  './js/tag-manager.js',
  './js/batch.js',
  './js/idb.js',
  './js/draft.js',
  './js/trash.js',
  './js/calendar.js',
  './js/template.js',
  './js/timeline.js',
  './js/visuals.js',
  './js/cloud-sync-v2.js',
  './js/image-processor-v2.js',
  './js/app.js'
];

// 安装阶段：缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// 激活阶段：删除旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return cacheName !== CACHE_NAME;
        }).map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：Network First (优先网络，失败则缓存)
// 对于 JS/CSS/HTML 等资源
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('github.com') || event.request.url.includes('jsdelivr')) {
    // CDN 资源使用 Stale-While-Revalidate
    event.respondWith(
      caches.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        });
        return response || fetchPromise;
      })
    );
  } else {
    // 本地资源使用 Cache First (离线优先)
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
