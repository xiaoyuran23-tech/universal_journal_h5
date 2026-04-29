/**
 * Main - 应用入口
 * 初始化所有核心模块并启动应用
 * @version 6.0.0
 */

async function initApp() {
  console.log('[App] Initializing v6.0.0...');

  try {
    // 1. 初始化存储服务 (IndexedDB)
    if (window.StorageService) {
      await StorageService.init();
      console.log('[App] StorageService initialized');
    }

    // 2. 注册插件
    if (window.PluginLoader && window.Kernel) {
      const loader = new PluginLoader(Kernel);
      
      // 注册核心插件
      loader.register('records', RecordsPlugin);
      loader.register('calendar', CalendarPlugin);
      loader.register('timeline', TimelinePlugin);
      loader.register('editor', EditorPlugin);
      loader.register('favorites', FavoritesPlugin);
      loader.register('templates', TemplatesPlugin);
      loader.register('sync', SyncPlugin);
      loader.register('settings', SettingsPlugin);
      
      // 加载所有插件 (自动处理依赖)
      await loader.loadAll([
        'records', 'calendar', 'timeline', 'editor',
        'favorites', 'templates', 'sync', 'settings'
      ]);
    }

    // 3. 启动 Kernel (包含 Store 初始化)
    if (window.Kernel) {
      // Store 现在从 IndexedDB 加载数据
      await Kernel.boot({
        theme: 'light',
        language: 'zh-CN'
      });
    }

    // 4. 启动迁移适配器 (解决双重状态冲突)
    if (window.MigrationAdapter && window.App) {
      const adapter = new MigrationAdapter(Kernel, App);
      await adapter.start();
      console.log('[App] MigrationAdapter started');
    }

    // 5. 初始化 UI
    initUI();

    // 5.5 初始化 UX 视图 (v6.1 新增)
    initUXViews();

    // 6. 检查新手引导
    initOnboarding();

    console.log('[App] Application initialized successfully');

  } catch (error) {
    console.error('[App] Initialization failed:', error);
  }
}

/**
 * 初始化 UI
 */
function initUI() {
  // 绑定 FAB 按钮
  const fabBtn = document.getElementById('fab-add');
  if (fabBtn) {
    fabBtn.addEventListener('click', () => {
      if (window.Router) {
        Router.navigate('editor', { mode: 'create' });
      }
    });
  }

  // 绑定底部导航
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      if (page && window.Router) {
        Router.navigate(page);
      }
    });
  });

  // 监听路由变化，更新 UI
  if (window.Router) {
    Router.subscribe(route => {
      if (route && route.path) {
        // 更新 Tab 高亮
        document.querySelectorAll('.tab-item').forEach(tab => {
          tab.classList.toggle('active', tab.dataset.page === route.path);
        });

        // 更新页面显示
        updatePageVisibility(route.path);
      }
    });
  }
}

/**
 * 初始化 UX 视图 (v6.1 新增)
 */
function initUXViews() {
  console.log('[UX Views] initUXViews called');
  
  if (!window.HomePage) {
    console.error('[UX Views] HomePage is not defined');
    return;
  }
  
  if (!window.Store) {
    console.error('[UX Views] Store is not defined');
    return;
  }

  console.log('[UX Views] Dependencies ready, initializing...');

  // 在首页容器中渲染 UX 视图
  // 直接替换 page-home 内容（旧版 search-bar/tag-filter/items-container 会被覆盖）
  const homeContainer = document.getElementById('page-home');
  
  if (!homeContainer) {
    console.error('[UX Views] #page-home not found in DOM');
    return;
  }
  
  console.log('[UX Views] Found #page-home, clearing and rendering...');
  
  try {
    // 清空旧内容
    homeContainer.innerHTML = '';
    
    window.homePageInstance = new HomePage(homeContainer);
    window.homePageInstance.render();
    console.log('[UX Views] HomePage initialized successfully');
  } catch (e) {
    console.error('[UX Views] Failed to initialize HomePage:', e);
  }
}

/**
 * 更新页面可见性
 */
function updatePageVisibility(page) {
  document.querySelectorAll('.page').forEach(p => {
    const pageId = p.id.replace('page-', '');
    p.classList.toggle('active', pageId === page);
  });
}

/**
 * 初始化新手引导
 */
function initOnboarding() {
  if (window.Onboarding && Onboarding.shouldShow()) {
    Onboarding.init(Onboarding.DEFAULT_STEPS);
    setTimeout(() => Onboarding.start(), 1000);
  }
}

// DOM 加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
