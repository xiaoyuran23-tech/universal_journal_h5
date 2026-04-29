/**
 * Main - 应用入口
 * 初始化所有核心模块并启动应用
 * @version 6.0.0
 */

async function initApp() {
  console.log('[App] Initializing v6.0.0...');

  try {
    // 1. 初始化存储服务 (IndexedDB) - 容错处理
    if (window.StorageService) {
      try {
        await StorageService.init();
        console.log('[App] StorageService initialized');
      } catch (e) {
        console.warn('[App] StorageService init failed, continuing anyway:', e);
      }
    }

    // 2. 注册插件 - 关键依赖失败时阻断流程
    try {
      if (window.PluginLoader && window.Kernel) {
        const loader = new PluginLoader(Kernel);
        
        // 注册核心插件 (跳过未定义的插件)
        const pluginMap = {
          records: window.RecordsPlugin,
          calendar: window.CalendarPlugin,
          timeline: window.TimelinePlugin,
          editor: window.EditorPlugin,
          favorites: window.FavoritesPlugin,
          templates: window.TemplatesPlugin,
          sync: window.SyncPlugin,
          settings: window.SettingsPlugin
        };
        
        // 检查核心依赖
        if (!pluginMap.records) {
          throw new Error('RecordsPlugin is not loaded - critical dependency missing');
        }
        
        // 只注册已加载的插件
        Object.entries(pluginMap).forEach(([name, plugin]) => {
          if (plugin) {
            loader.register(name, plugin);
          } else {
            console.warn(`[App] Skipping plugin "${name}" - not loaded`);
          }
        });
        
        // 加载所有插件 (自动处理依赖)
        await loader.loadAll([
          'records', 'calendar', 'timeline', 'editor',
          'favorites', 'templates', 'sync', 'settings'
        ]);
        
        console.log('[App] Plugin loading completed');
      }
    } catch (e) {
      console.error('[App] Plugin loading failed (CRITICAL):', e);
      // 核心依赖失败时抛出，阻止后续流程
      throw e;
    }

    // 3. 启动 Kernel (包含 Store 初始化) - 容错处理
    try {
      if (window.Kernel) {
        // Store 现在从 IndexedDB 加载数据
        await Kernel.boot({
          theme: 'light',
          language: 'zh-CN'
        });
      }
    } catch (e) {
      console.warn('[App] Kernel boot failed, continuing anyway:', e);
    }

    // 4. 启动迁移适配器 (解决双重状态冲突) - 容错处理
    try {
      if (window.MigrationAdapter && window.App) {
        const adapter = new MigrationAdapter(Kernel, App);
        await adapter.start();
        console.log('[App] MigrationAdapter started');
      }
    } catch (e) {
      console.warn('[App] MigrationAdapter failed, continuing anyway:', e);
    }

    // 5. 初始化 UI
    initUI();

    // 5.5 初始化 UX 视图 (v6.1 新增) - 关键！必须执行
    initUXViews();

    // 6. 检查新手引导
    initOnboarding();

    console.log('[App] Application initialized successfully');

  } catch (error) {
    console.error('[App] Initialization failed:', error);
    // 即使整体失败，也尝试初始化 UX 视图
    try {
      initUXViews();
    } catch (e) {
      console.error('[App] UX Views also failed:', e);
    }
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

  // 1. 应用暖色主题 (v6.1 UX 默认主题)
  document.documentElement.setAttribute('data-theme', 'warm');
  document.body.setAttribute('data-theme', 'warm');

  // 2. 隐藏旧版 UI 容器，防止重叠
  // 旧版 Header 和 Nav 是 body 的直接子元素，不在 #page-home 内
  const oldHeader = document.querySelector('header.header');
  if (oldHeader) oldHeader.style.display = 'none';
  
  const oldNav = document.querySelector('nav.tab-bar');
  if (oldNav) oldNav.style.display = 'none';
  
  // 3. 在首页容器中渲染 UX 视图
  const homeContainer = document.getElementById('page-home');
  
  if (!homeContainer) {
    console.error('[UX Views] #page-home not found in DOM');
    return;
  }
  
  console.log('[UX Views] Found #page-home, clearing and rendering...');
  
  try {
    // 清空旧内容 (search-bar, tag-filter 等)
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
