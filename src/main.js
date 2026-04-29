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
      
      // 加载所有插件 (自动处理依赖)
      await loader.loadAll(['records', 'calendar', 'timeline', 'editor']);
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
