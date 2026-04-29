/**
 * Kernel - 微内核
 * 应用的核心控制器，负责协调各模块
 * @version 6.0.0
 */
class Kernel {
  constructor() {
    this._plugins = new Map();
    this._initialized = false;
    this._bootSequence = [];
  }

  /**
   * 注册插件
   * @param {string} name - 插件名称
   * @param {Object} plugin - 插件对象
   */
  registerPlugin(name, plugin) {
    if (this._plugins.has(name)) {
      console.warn(`[Kernel] Plugin "${name}" already registered, overwriting`);
    }

    this._plugins.set(name, {
      name,
      ...plugin,
      enabled: plugin.enabled !== false
    });

    console.log(`[Kernel] Plugin registered: ${name}`);
    return this;
  }

  /**
   * 获取插件
   * @param {string} name
   * @returns {Object|null}
   */
  getPlugin(name) {
    return this._plugins.get(name) || null;
  }

  /**
   * 检查插件是否存在
   * @param {string} name
   * @returns {boolean}
   */
  hasPlugin(name) {
    return this._plugins.has(name);
  }

  /**
   * 启用/禁用插件
   * @param {string} name
   * @param {boolean} enabled
   */
  togglePlugin(name, enabled) {
    const plugin = this._plugins.get(name);
    if (plugin) {
      plugin.enabled = enabled;
      console.log(`[Kernel] Plugin "${name}" ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * 启动应用
   * @param {Object} config - 启动配置
   */
  async boot(config = {}) {
    if (this._initialized) {
      console.warn('[Kernel] Already initialized');
      return;
    }

    console.log('[Kernel] Booting application...');

    try {
      // 1. 初始化核心模块
      await this._initCore(config);

      // 2. 加载插件
      await this._loadPlugins();

      // 3. 启动插件
      await this._startPlugins();

      // 4. 初始化路由
      this._initRouter();

      // 5. 绑定全局事件
      this._bindGlobalEvents();

      this._initialized = true;
      console.log('[Kernel] Application booted successfully');

      // 触发启动完成事件
      if (window.EventBus) {
        window.EventBus.emit('app:booted', config);
      }

    } catch (error) {
      console.error('[Kernel] Boot failed:', error);
      throw error;
    }
  }

  /**
   * 初始化核心模块
   * @private
   */
  async _initCore(config) {
    // 初始化 Store
    if (window.Store) {
      // 尝试从本地存储恢复状态
      const hydrated = Store.hydrate('journal_v6_state');
      if (!hydrated) {
        // 初始化默认状态
        Store.dispatch({
          type: 'SET_STATE',
          payload: {
            app: {
              currentPage: 'home',
              theme: config.theme || 'light',
              language: config.language || 'zh-CN'
            }
          }
        });
      }
    }

    // 初始化 Router
    if (window.Router) {
      Router.init();
    }
  }

  /**
   * 加载插件
   * @private
   */
  async _loadPlugins() {
    for (const [name, plugin] of this._plugins) {
      if (!plugin.enabled) continue;

      try {
        if (plugin.load) {
          await plugin.load();
          console.log(`[Kernel] Plugin "${name}" loaded`);
        }
      } catch (error) {
        console.error(`[Kernel] Failed to load plugin "${name}":`, error);
      }
    }
  }

  /**
   * 启动插件
   * @private
   */
  async _startPlugins() {
    for (const [name, plugin] of this._plugins) {
      if (!plugin.enabled) continue;

      try {
        if (plugin.start) {
          await plugin.start();
          console.log(`[Kernel] Plugin "${name}" started`);
        }
      } catch (error) {
        console.error(`[Kernel] Failed to start plugin "${name}":`, error);
      }
    }
  }

  /**
   * 初始化路由
   * @private
   */
  _initRouter() {
    if (!window.Router) return;

    // 订阅路由变化
    Router.subscribe(route => {
      if (route && route.path) {
        Store.dispatch({
          type: 'app.currentPage',
          payload: route.path
        });

        // 更新页面标题
        if (route.title) {
          document.title = `${route.title} - 万物手札`;
        }
      }
    });

    // 解析初始路由
    const initial = Router.parseURL();
    if (initial.path) {
      Router.navigate(initial.path, {}, initial.query);
    }
  }

  /**
   * 绑定全局事件
   * @private
   */
  _bindGlobalEvents() {
    // 错误处理
    window.onerror = (msg, url, line, col, error) => {
      console.error('[Kernel] Global error:', { msg, url, line, col, error });
      
      if (window.EventBus) {
        EventBus.emit('app:error', { msg, url, line, col, error });
      }
    };

    // 未处理的 Promise rejection
    window.addEventListener('unhandledrejection', event => {
      console.error('[Kernel] Unhandled rejection:', event.reason);
      
      if (window.EventBus) {
        EventBus.emit('app:unhandledRejection', { reason: event.reason });
      }
    });

    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        Store.persist('journal_v6_state');
      }
    });

    // 页面卸载前保存状态
    window.addEventListener('beforeunload', () => {
      Store.persist('journal_v6_state');
    });
  }

  /**
   * 关闭应用
   */
  shutdown() {
    console.log('[Kernel] Shutting down...');

    // 保存状态
    Store.persist('journal_v6_state');

    // 停止插件
    for (const [name, plugin] of this._plugins) {
      if (plugin.stop) {
        try {
          plugin.stop();
        } catch (error) {
          console.error(`[Kernel] Failed to stop plugin "${name}":`, error);
        }
      }
    }

    this._initialized = false;
    console.log('[Kernel] Application shut down');
  }

  /**
   * 获取应用状态
   * @returns {Object}
   */
  getStatus() {
    return {
      initialized: this._initialized,
      plugins: Array.from(this._plugins.keys()),
      activePlugins: Array.from(this._plugins.entries())
        .filter(([_, p]) => p.enabled)
        .map(([name, _]) => name)
    };
  }
}

// 全局单例
window.Kernel = new Kernel();

console.log('[Kernel] 微内核已初始化');
