/**
 * Main - 应用入口
 * 初始化所有核心模块并启动应用
 * @version 6.0.0
 */

// 导入核心模块 (通过 script 标签加载)
// Store, Router, Kernel, PluginLoader 已在全局作用域

async function initApp() {
  console.log('[App] Initializing v6.0.0...');

  try {
    // 1. 注册插件
    if (window.PluginLoader && window.Kernel) {
      const loader = new PluginLoader(Kernel);
      
      // 注册 Records 插件
      loader.register('records', RecordsPlugin);
      
      // 加载所有插件到 Kernel
      await loader.loadAll(['records']);
    }

    // 2. 启动 Kernel
    if (window.Kernel) {
      await Kernel.boot({
        theme: 'light',
        language: 'zh-CN'
      });
    }

    // 3. 初始化 UI
    initUI();

    // 4. 检查新手引导
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
