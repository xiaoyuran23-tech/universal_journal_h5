/**
 * Main - 应用入口
 * 初始化所有核心模块并启动应用
 * @version 6.1.0
 */

async function initApp() {
  console.log('[App] Initializing v6.1.0...');

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

    // 1.5 执行 DB Schema 迁移
    if (window.MigrationService && MigrationService.needsMigration()) {
      try {
        const result = await MigrationService.migrate();
        if (result.migrated) {
          console.log(`[App] Schema migrated: ${result.from} → ${result.to}`);
        }
      } catch (e) {
        console.warn('[App] Schema migration failed, continuing anyway:', e);
      }
    }

    // 2. 注册插件 - 关键依赖失败时阻断流程
    try {
      if (window.PluginLoader && window.Kernel) {
        const loader = new PluginLoader(window.Kernel);
        
        // 注册核心插件 + Phase 2 新增插件
        const pluginMap = {
          records: window.RecordsPlugin,
          calendar: window.CalendarPlugin,
          timeline: window.TimelinePlugin,
          editor: window.EditorPlugin,
          favorites: window.FavoritesPlugin,
          templates: window.TemplatesPlugin,
          sync: window.SyncPlugin,
          settings: window.SettingsPlugin,
          // Phase 2 新增插件
          security: window.SecurityPlugin,
          trash: window.TrashPlugin,
          batch: window.BatchPlugin,
          draft: window.DraftPlugin,
          tags: window.TagsPlugin,
          visuals: window.VisualsPlugin,
          theme: window.ThemePlugin,
          search: window.SearchPlugin,
          hotkeys: window.HotkeysPlugin,
          controller: window.ControllerPlugin,
          markdown: window.MarkdownPlugin,
          review: window.ReviewPlugin,
          graph: window.GraphPlugin,
          example: window.ExamplePlugin,
          // v7.0.0 新增
          auth: window.AuthPlugin,
          mood: window.MoodPlugin,
          autoSync: window.AutoSyncPlugin,
          transitions: window.TransitionsPlugin
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
          'favorites', 'templates', 'sync', 'settings',
          'security', 'trash', 'batch', 'draft',
          'tags', 'visuals', 'theme', 'search', 'hotkeys', 'controller', 'markdown', 'review', 'graph', 'auth', 'mood', 'autoSync', 'transitions'
        ]);
        
        console.log('[App] Plugin loading completed');
      }
    } catch (e) {
      console.error('[App] Plugin loading failed (CRITICAL):', e);
      // 核心依赖失败时抛出，阻止后续流程
      throw e;
    }

    // 3. 启动 Kernel (包含 Store 初始化) - 关键依赖失败时阻断
    if (window.Kernel) {
      try {
        await window.Kernel.boot({
          theme: 'light',
          language: 'zh-CN'
        });
        console.log('[App] Kernel booted successfully');
      } catch (e) {
        console.error('[App] Kernel boot failed (CRITICAL):', e);
        throw new Error(`Kernel boot failed: ${e.message}`);
      }
    } else {
      throw new Error('Kernel is not available');
    }

    // 5. [已移除] 迁移适配器 (旧架构已不存在)

    // 6. 初始化 UI
    initUI();

    // 7. 初始化 UX 视图 (v6.1 新增)
    initUXViews();

    // 7.5 渲染连续打卡徽章 (v7.0)
    renderStreakBadge();

    // 7.6 渲染心情趋势 (v7.0)
    setTimeout(() => renderMoodTrend(), 500);

    // 8. 检查新手引导
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
 * 渲染连续打卡徽章
 */
function renderStreakBadge() {
  const container = document.getElementById('streak-badge-container');
  if (!container || !window.StreakService) return;

  const badge = StreakService.getBadge();
  if (!badge) {
    container.innerHTML = '<div style="font-size:12px;color:#999;text-align:center;">今天写一条吧 🔥</div>';
    return;
  }

  const flame = badge.isToday ? '' : '<span style="font-size:11px;color:#ff6b35;">今日未写</span>';
  container.innerHTML = `
    <div class="streak-badge" style="display:flex;flex-direction:column;align-items:center;gap:4px;">
      <span class="streak-flame" style="font-size:20px;">🔥</span>
      <span style="font-size:14px;font-weight:700;color:white;">${badge.current}</span>
      ${flame}
    </div>
  `;
}

/**
 * 渲染心情趋势
 */
function renderMoodTrend() {
  if (window.MoodPlugin) {
    MoodPlugin.renderMoodTrend('mood-trend-container');
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
        window.Router.navigate('editor', { mode: 'create' });
      }
    });
  }

  // 绑定回收站入口 (v6.2 新增)
  const trashBtn = document.getElementById('settings-trash');
  if (trashBtn) {
    trashBtn.addEventListener('click', () => {
      if (window.Router) {
        window.Router.navigate('trash');
      }
      // 渲染回收站列表
      if (window.TrashManager) {
        TrashManager.renderTrashList('trash-container');
      }
    });
  }

  // 绑定底部导航
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      if (page && window.Router) {
        window.Router.navigate(page);
      }
    });
  });

  // 绑定表单返回按钮（确保在 ControllerPlugin 之前绑定）
  const formBackBtn = document.getElementById('create-back-btn');
  if (formBackBtn) {
    formBackBtn.addEventListener('click', () => {
      if (window.Router) window.Router.navigate('home');
    });
  }

  // 绑定详情页返回按钮
  const detailBackBtn = document.getElementById('detail-back-btn');
  if (detailBackBtn) {
    detailBackBtn.addEventListener('click', () => {
      if (window.Router) window.Router.navigate('home');
    });
  }

  // 绑定云同步弹窗关闭（背景点击关闭）
  const cloudModal = document.getElementById('cloud-modal');
  if (cloudModal) {
    cloudModal.addEventListener('click', (e) => {
      if (e.target === cloudModal) cloudModal.style.display = 'none';
    });
    const closeBtn = document.getElementById('cloud-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => { cloudModal.style.display = 'none'; });
    }
  }

  // 监听路由变化，更新 UI
  if (window.Router) {
    window.Router.subscribe(route => {
      if (route && route.path) {
        // 更新 Tab 高亮
        document.querySelectorAll('.tab-item').forEach(tab => {
          tab.classList.toggle('active', tab.dataset.page === route.path);
        });

        // 更新页面显示
        updatePageVisibility(route.path);

        // 回收站页面渲染
        if (route.path === 'trash' && window.TrashManager) {
          TrashManager.renderTrashList('trash-container');
        }

        // 那年今日全屏页
        if (route.path === 'review/on-this-day' && window.ReviewPlugin) {
          ReviewPlugin.renderOnThisDayFull(document.getElementById('on-this-day-container'));
        }

        // 每周回顾全屏页
        if (route.path === 'review/weekly' && window.ReviewPlugin) {
          ReviewPlugin.renderWeeklyFull(document.getElementById('weekly-review-container'));
        }
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

  // 2. 隐藏旧版 Header（旧 TabBar 保留，旧架构仍需要它导航到各页面）
  const oldHeader = document.querySelector('header.header');
  if (oldHeader) oldHeader.style.display = 'none';
  
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
  // 路由名到页面 ID 的映射
  const routeMap = {
    editor: 'form',
    'review/on-this-day': 'on-this-day',
    'review/weekly': 'weekly-review'
  };
  const targetPage = routeMap[page] || page;

  document.querySelectorAll('.page').forEach(p => {
    const pageId = p.id.replace('page-', '');
    p.classList.toggle('active', pageId === targetPage);
  });
}

/**
 * 初始化新手引导
 */
function initOnboarding() {
  const onboarding = window.Onboarding;
  if (onboarding && Onboarding.shouldShow()) {
    onboarding.init(Onboarding.DEFAULT_STEPS);
    setTimeout(() => onboarding.start(), 1000);
  }
}

// DOM 加载完成后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
