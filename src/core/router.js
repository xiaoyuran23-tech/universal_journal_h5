/**
 * Router - 路由系统
 * 支持页面切换、历史记录、参数传递
 * @version 6.1.0
 */
class Router {
  constructor() {
    this._routes = new Map();
    this._currentRoute = null;
    this._history = [];
    this._listeners = new Set();
  }

  /**
   * 注册路由
   * @param {string} path - 路由路径
   * @param {Object} config - 路由配置
   */
  register(path, config) {
    this._routes.set(path, {
      path,
      component: config.component,
      title: config.title || '',
      meta: config.meta || {},
      guard: config.guard || null,
      ...config
    });
  }

  /**
   * 导航到指定路由
   * @param {string} path - 目标路径
   * @param {Object} params - 路由参数
   * @param {Object} query - 查询参数
   */
  navigate(path, params = {}, query = {}) {
    const route = this._routes.get(path);
    
    if (!route) {
      console.error(`[Router] Route not found: ${path}`);
      return false;
    }

    // 执行路由守卫
    if (route.guard) {
      const canProceed = route.guard({ path, params, query });
      if (!canProceed) return false;
    }

    // 记录历史
    this._history.push({ path, params, query });
    
    // 更新当前路由
    this._currentRoute = { path, params, query, ...route };
    
    // 更新 URL (可选)
    this._updateURL(path, params, query);
    
    // 通知监听者
    this._notify();
    
    return true;
  }

  /**
   * 返回上一页
   */
  back() {
    if (this._history.length > 1) {
      this._history.pop();
      const prev = this._history[this._history.length - 1];
      this._currentRoute = prev;
      this._updateURL(prev.path, prev.params, prev.query);
      this._notify();
      return true;
    }
    return false;
  }

  /**
   * 前进
   */
  forward() {
    // 简化实现，实际可使用完整历史栈
    return false;
  }

  /**
   * 替换当前路由 (不记录历史)
   * @param {string} path
   * @param {Object} params
   * @param {Object} query
   */
  replace(path, params = {}, query = {}) {
    const route = this._routes.get(path);
    if (!route) return false;

    this._currentRoute = { path, params, query, ...route };
    this._updateURL(path, params, query);
    this._notify();
    return true;
  }

  /**
   * 获取当前路由
   * @returns {Object|null}
   */
  getCurrentRoute() {
    return this._currentRoute;
  }

  /**
   * 订阅路由变化
   * @param {Function} listener
   * @returns {Function} 取消订阅
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * 通知监听者
   * @private
   */
  _notify() {
    this._listeners.forEach(listener => {
      try {
        listener(this._currentRoute);
      } catch (error) {
        console.error('[Router] Listener error:', error);
      }
    });
  }

  /**
   * 更新 URL
   * @private
   */
  _updateURL(path, params, query) {
    // 构建 URL
    let url = `#${path}`;
    
    if (Object.keys(params).length > 0) {
      url += '/' + Object.values(params).join('/');
    }
    
    if (Object.keys(query).length > 0) {
      const qs = new URLSearchParams(query).toString();
      url += '?' + qs;
    }
    
    // 更新 hash (不触发页面刷新)
    if (window.location.hash !== url) {
      window.history.pushState(null, '', url);
    }
  }

  /**
   * 从 URL 解析路由
   * @returns {Object|null}
   */
  parseURL() {
    const hash = window.location.hash.slice(1) || 'home';
    const [path, queryStr] = hash.split('?');
    
    const query = {};
    if (queryStr) {
      const params = new URLSearchParams(queryStr);
      for (const [key, value] of params) {
        query[key] = value;
      }
    }
    
    return { path, query };
  }

  /**
   * 监听浏览器前进/后退
   */
  init() {
    window.addEventListener('popstate', () => {
      const { path, query } = this.parseURL();
      if (path) {
        this._currentRoute = { path, query, ...this._routes.get(path) };
        this._notify();
      }
    });
  }
}

// 全局单例
window.Router = new Router();

// 注册默认路由
window.Router.register('home', {
  title: '记录',
  component: 'records-list'
});

window.Router.register('calendar', {
  title: '日历',
  component: 'calendar-view'
});

window.Router.register('timeline', {
  title: '故事',
  component: 'timeline-view'
});

window.Router.register('favorites', {
  title: '收藏',
  component: 'favorites-list'
});

window.Router.register('profile', {
  title: '我',
  component: 'profile-view'
});

window.Router.register('editor', {
  title: '编辑',
  component: 'record-editor',
  guard: ({ params }) => {
    // 编辑模式需要 id 参数
    return true;
  }
});

window.Router.register('trash', {
  title: '回收站',
  component: 'trash-view'
});

console.log('[Router] 路由系统已初始化');
