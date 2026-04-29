/**
 * PluginLoader - 插件加载器
 * 支持动态加载、依赖管理、生命周期
 * @version 6.1.0
 */
class PluginLoader {
  constructor(kernel) {
    this._kernel = kernel;
    this._registry = new Map();
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

    // 注册到 Kernel
    this._kernel.registerPlugin(name, {
      load: async () => {
        await plugin.init();

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
      start: plugin.start.bind(plugin),
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
