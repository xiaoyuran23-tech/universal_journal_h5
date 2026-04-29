const CACHE_NAME = 'journal-v5.0.0';
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
  './js/storage.js',
  './js/draft.js',
  './js/trash.js',
  './js/calendar.js',
  './js/template.js',
  './js/timeline.js',
  './js/visuals.js',
  './js/cloud-sync.js',
  './js/image-processor-v2.js',
  './js/app.js',
  './js/core/event-bus.js',
  './js/ui/components/empty.js',
  './js/ui/components/empty.css',
  './js/ui/guide/onboarding.js',
  './js/ui/guide/onboarding.css'
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. HTML 入口文件: Network First (保证更新)
  if (event.request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. CDN / 外部资源: Stale-While-Revalidate
  if (event.request.url.includes('github.com') || event.request.url.includes('jsdelivr')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
          return networkResponse;
        });
        return response || fetchPromise;
      })
    );
    return;
  }

  // 3. 本地静态资源 (JS/CSS/Images): Cache First (离线优先)
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
