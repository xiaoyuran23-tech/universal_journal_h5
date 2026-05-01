const CACHE_NAME = 'journal-v6.3.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './animations.css',
  './manifest.json',
  // v6.0.0+ Core
  './src/core/store.js',
  './src/core/router.js',
  './src/core/event-bus.js',
  './src/core/plugin-loader.js',
  './src/core/hooks.js',
  './src/core/kernel.js',
  // v6.0.0+ Services
  './src/services/storage.js',
  './src/services/crypto.js',
  './src/services/sync-merge.js',
  './src/services/sync.js',
  './src/services/image.js',
  './src/services/metadata.js',
  './src/services/block-parser.js',
  './src/services/link-parser.js',
  './src/services/ai-lite.js',
  './src/services/migration.js',
  // v6.0.0+ Plugins
  './src/plugins/records/index.js',
  './src/plugins/calendar/index.js',
  './src/plugins/timeline/index.js',
  './src/plugins/editor/index.js',
  './src/plugins/favorites/index.js',
  './src/plugins/templates/index.js',
  './src/plugins/sync/index.js',
  './src/plugins/settings/index.js',
  './src/plugins/review/index.js',
  // Phase 2 新增插件
  './src/plugins/security/index.js',
  './src/plugins/trash/index.js',
  './src/plugins/batch/index.js',
  './src/plugins/draft/index.js',
  './src/plugins/tags/index.js',
  './src/plugins/visuals/index.js',
  './src/plugins/theme/index.js',
  './src/plugins/search/index.js',
  './src/plugins/hotkeys/index.js',
  './src/plugins/controller/index.js',
  './src/plugins/graph/index.js',
  './src/plugins/example/index.js',
  // Markdown 导入/导出
  './src/plugins/markdown/index.js',
  // v6.0.0+ UI Components
  './src/components/base/index.js',
  './src/components/base/status-states.js',
  './src/components/list/index.js',
  './src/components/list/featured-card.js',
  './src/components/layout/index.js',
  './src/components/layout/category-tabs.js',
  './src/components/layout/header-bar.js',
  './src/components/components.css',
  // v6.1 UX Migration
  './src/hooks/records-hook.js',
  './src/views/home-page.js',
  './src/styles/ux-theme.css',
  // v6.1 Entry
  './src/main.js'
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
