/**
 * PluginAPI - 插件 API 接口
 * 插件通过此接口与内核交互，不直接访问内核内部模块
 * @version 6.3.0
 */
class PluginAPI {
  constructor(kernel) {
    this._kernel = kernel;

    // api.store - 访问 Store
    this.store = {
      getState: (path) => window.Store ? window.Store.getState(path) : undefined,
      dispatch: (action) => { if (window.Store) window.Store.dispatch(action); },
      subscribe: (listener) => window.Store ? window.Store.subscribe(listener) : (() => {}),
      undo: () => window.Store ? window.Store.undo() : false,
      redo: () => window.Store ? window.Store.redo() : false,
    };

    // api.storage - 访问存储 (统一 StorageBackend / StorageService / IDBModule)
    this.storage = {
      get: async (id) => {
        if (window.StorageBackend) return StorageBackend.get(id);
        if (window.IDBModule) return IDBModule.get(id);
        if (window.StorageService) return StorageService.get(id);
        return null;
      },
      put: async (record) => {
        if (window.StorageBackend) return StorageBackend.put(record);
        if (window.IDBModule) return IDBModule.put(record);
        if (window.StorageService) return StorageService.put(record);
      },
      delete: async (id) => {
        if (window.StorageBackend) return StorageBackend.delete(id);
        if (window.IDBModule) return IDBModule.delete(id);
        if (window.StorageService) return StorageService.delete(id);
      },
      getAll: async () => {
        if (window.StorageBackend) return StorageBackend.getAll();
        if (window.IDBModule) return IDBModule.getAll();
        if (window.StorageService) return StorageService.getAll();
        return [];
      },
    };

    // api.router - 路由导航
    this.router = {
      navigate: (path, params = {}, query = {}) => {
        if (window.Router) window.Router.navigate(path, params, query);
      },
      current: () => window.Router ? window.Router.getCurrent() : null,
    };

    // api.ui - UI 操作
    this.ui = {
      toast: (message, duration = 2000) => {
        if (window.App && typeof App.showToast === 'function') {
          App.showToast(message, duration);
        } else if (window.EventBus) {
          EventBus.emit('toast:show', { message, duration });
        } else {
          console.log('[PluginAPI] Toast:', message);
        }
      },
      modal: {
        open: (html, options = {}) => {
          const overlay = document.createElement('div');
          overlay.className = 'plugin-modal-overlay';
          Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: options.zIndex || 9999,
          });

          const content = document.createElement('div');
          content.className = 'plugin-modal-content';
          Object.assign(content.style, {
            background: '#fff', borderRadius: '12px', padding: '20px',
            maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto',
            width: options.width || '400px',
          });
          content.innerHTML = html;

          // 点击遮罩关闭
          overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
          });

          overlay.appendChild(content);
          document.body.appendChild(overlay);
          return {
            close: () => overlay.remove(),
            element: content,
          };
        },
        close: () => {
          const overlays = document.querySelectorAll('.plugin-modal-overlay');
          overlays.forEach(el => el.remove());
        },
      },
    };

    // api.events - 事件总线
    this.events = {
      on: (event, handler) => window.EventBus ? EventBus.on(event, handler) : (() => {}),
      off: (event, handler) => { if (window.EventBus) EventBus.off(event, handler); },
      emit: (event, data) => { if (window.EventBus) EventBus.emit(event, data); },
      once: (event, handler) => { if (window.EventBus) EventBus.once(event, handler); },
    };

    // api.hooks - 钩子注册
    this.hooks = {
      register: (name, fn) => window.Hooks ? Hooks.register(name, fn) : (() => {}),
    };

    // api.kernel - 内核信息
    this.kernel = {
      hasPlugin: (name) => this._kernel ? this._kernel.hasPlugin(name) : false,
      getPlugin: (name) => this._kernel ? this._kernel.getPlugin(name) : null,
      getStatus: () => this._kernel ? this._kernel.getStatus() : {},
    };
  }
}

/**
 * PluginLoader - 插件加载器
 * 支持动态加载、依赖管理、生命周期
 * @version 6.3.0
 */
class PluginLoader {
  constructor(kernel) {
    this._kernel = kernel;
    this._registry = new Map();
    this._api = null; // 插件 API 实例
  }

  /**
   * 获取 PluginAPI 实例 (懒初始化)
   * @returns {PluginAPI}
   */
  getAPI() {
    if (!this._api) {
      this._api = new PluginAPI(this._kernel);
    }
    return this._api;
  }

  /**
   * 注册插件
   * @param {string} name - 插件名称
   * @param {Object} plugin - 插件定义
   */
  register(name, plugin) {
    this._registry.set(name, {
      name,
      version: plugin.version || '1.0.0',
      dependencies: plugin.dependencies || [],
      init: plugin.init || (() => {}),
      start: plugin.start || (() => {}),
      stop: plugin.stop || (() => {}),
      routes: plugin.routes || [],
      components: plugin.components || [],
      actions: plugin.actions || {},
      reducers: plugin.reducers || {},
      ...plugin
    });

    return this;
  }

  /**
   * 加载插件到 Kernel
   * @param {string} name
   */
  async loadToKernel(name) {
    const plugin = this._registry.get(name);
    if (!plugin) {
      throw new Error(`Plugin "${name}" not found`);
    }

    // 检查依赖
    await this._checkDependencies(plugin);

    // 创建插件 API 实例
    const api = this.getAPI();

    // 注册到 Kernel
    this._kernel.registerPlugin(name, {
      load: async () => {
        // 将 PluginAPI 传递给插件的 init 方法
        await plugin.init(api);

        // 注册路由
        if (plugin.routes && window.Router) {
          plugin.routes.forEach(route => {
            window.Router.register(route.path, route);
          });
        }

        // 注册 Action (到 Store)
        if (plugin.actions && window.Store) {
          Object.entries(plugin.actions).forEach(([type, handler]) => {
            window.Store._reducers = window.Store._reducers || {};
            // type 已经是 'records/add' 格式，不需要再加 name 前缀
            // 转换为 'records.add' 格式 (slash → dot)
            const key = type.replace(/\//g, '.');
            window.Store._reducers[key] = handler;
          });
        }
      },
      start: async () => {
        // start 也接收 api
        await plugin.start(api);
      },
      stop: plugin.stop.bind(plugin)
    });

    console.log(`[PluginLoader] Plugin "${name}" loaded to Kernel`);
  }

  /**
   * 加载所有插件
   * @param {Array<string>} [names] - 指定要加载的插件名称
   */
  async loadAll(names = null) {
    const pluginsToLoad = names 
      ? names.filter(n => this._registry.has(n))
      : Array.from(this._registry.keys());

    // 拓扑排序 (处理依赖)
    const sorted = this._topologicalSort(pluginsToLoad);

    for (const name of sorted) {
      try {
        await this.loadToKernel(name);
      } catch (error) {
        console.error(`[PluginLoader] Failed to load "${name}":`, error);
      }
    }
  }

  /**
   * 检查依赖
   * @private
   */
  async _checkDependencies(plugin) {
    for (const dep of plugin.dependencies) {
      if (!this._registry.has(dep)) {
        throw new Error(`Plugin "${plugin.name}" depends on "${dep}" which is not registered`);
      }
      
      // 递归检查
      const depPlugin = this._registry.get(dep);
      await this._checkDependencies(depPlugin);
    }
  }

  /**
   * 拓扑排序 (处理依赖关系)
   * @private
   */
  _topologicalSort(plugins) {
    const visited = new Set();
    const result = [];

    const visit = (name) => {
      if (visited.has(name)) return;
      visited.add(name);

      const plugin = this._registry.get(name);
      if (plugin) {
        for (const dep of plugin.dependencies) {
          visit(dep);
        }
      }

      result.push(name);
    };

    plugins.forEach(visit);
    return result;
  }

  /**
   * 获取插件信息
   * @param {string} name
   * @returns {Object|null}
   */
  getInfo(name) {
    return this._registry.get(name) || null;
  }

  /**
   * 列出所有插件
   * @returns {Array}
   */
  list() {
    return Array.from(this._registry.entries()).map(([name, plugin]) => ({
      name,
      version: plugin.version,
      dependencies: plugin.dependencies
    }));
  }
}

// 全局暴露
window.PluginLoader = PluginLoader;

console.log('[PluginLoader] 插件加载器已初始化');
