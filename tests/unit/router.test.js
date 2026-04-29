/**
 * Router 单元测试
 * 测试路由注册、导航、守卫、历史管理
 */

// 直接使用 Router 类实例化
class Router {
  constructor() {
    this._routes = new Map();
    this._currentRoute = null;
    this._history = [];
    this._listeners = new Set();
  }

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

  navigate(path, params = {}, query = {}) {
    const route = this._routes.get(path);
    
    if (!route) {
      return false;
    }

    // 运行守卫
    if (route.guard && !route.guard({ params, query })) {
      return false;
    }

    // 更新当前路由
    this._currentRoute = { ...route, params, query };
    
    // 更新历史
    if (this._historyIndex < this._history.length - 1) {
      this._history = this._history.slice(0, this._historyIndex + 1);
    }
    this._history.push({ path, params, query });
    this._historyIndex = this._history.length - 1;
    
    // 通知订阅者
    this._listeners.forEach(listener => {
      try { listener(this._currentRoute); } catch (e) { console.error('[Router] Listener error:', e); }
    });
    
    return true;
  }

  back() {
    if (this._historyIndex <= 0) return false;
    this._historyIndex--;
    const prev = this._history[this._historyIndex];
    this._currentRoute = { ...this._routes.get(prev.path), params: prev.params, query: prev.query };
    this._listeners.forEach(listener => {
      try { listener(this._currentRoute); } catch (e) { console.error('[Router] Listener error:', e); }
    });
    return true;
  }

  forward() {
    if (this._historyIndex >= this._history.length - 1) return false;
    this._historyIndex++;
    const next = this._history[this._historyIndex];
    this._currentRoute = { ...this._routes.get(next.path), params: next.params, query: next.query };
    this._listeners.forEach(listener => {
      try { listener(this._currentRoute); } catch (e) { console.error('[Router] Listener error:', e); }
    });
    return true;
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  getCurrentRoute() {
    return this._currentRoute ? { ...this._currentRoute } : null;
  }

  getRouteInfo(path) {
    const route = this._routes.get(path);
    return route ? { ...route } : null;
  }

  getHistory() {
    return [...this._history];
  }
}

let router;

beforeEach(() => {
  router = new Router();
});

describe('Router - 路由注册', () => {
  test('register 添加路由', () => {
    router.register('home', {
      title: '首页',
      component: 'home-view'
    });
    
    expect(router._routes.get('home')).toBeDefined();
    expect(router._routes.get('home').title).toBe('首页');
  });

  test('register 带守卫的路由', () => {
    const guard = jest.fn(() => true);
    router.register('editor', {
      title: '编辑器',
      guard: guard
    });
    
    expect(router._routes.get('editor').guard).toBe(guard);
  });

  test('register 重复覆盖', () => {
    router.register('home', { title: '旧首页' });
    router.register('home', { title: '新首页' });
    
    expect(router._routes.get('home').title).toBe('新首页');
  });

  test('register 多个路由', () => {
    router.register('a', { title: 'A' });
    router.register('b', { title: 'B' });
    router.register('c', { title: 'C' });
    
    expect(router._routes.size).toBe(3);
  });
});

describe('Router - 导航', () => {
  beforeEach(() => {
    router.register('home', { title: '首页' });
    router.register('editor', { title: '编辑器' });
    router.register('settings', { title: '设置' });
  });

  test('navigate 到已注册路由', () => {
    const result = router.navigate('home');
    expect(result).toBe(true);
    expect(router._currentRoute.path).toBe('home');
  });

  test('navigate 传递参数', () => {
    router.navigate('editor', { id: '123', mode: 'edit' });
    expect(router._currentRoute.params).toEqual({ id: '123', mode: 'edit' });
  });

  test('navigate 到未注册路由返回 false', () => {
    const result = router.navigate('unknown');
    expect(result).toBe(false);
    expect(router._currentRoute).toBeNull();
  });

  test('navigate 触发订阅', () => {
    const listener = jest.fn();
    router.subscribe(listener);
    
    router.navigate('home');
    expect(listener).toHaveBeenCalledWith(router._currentRoute);
  });
});

describe('Router - 路由守卫', () => {
  beforeEach(() => {
    router.register('public', { title: '公开' });
    router.register('protected', {
      title: '受保护',
      guard: ({ params }) => params.auth === true
    });
  });

  test('守卫通过时导航成功', () => {
    const result = router.navigate('protected', { auth: true });
    expect(result).toBe(true);
  });

  test('守卫不通过时导航失败', () => {
    const result = router.navigate('protected', { auth: false });
    expect(result).toBe(false);
    expect(router._currentRoute).toBeNull();
  });
});

describe('Router - 历史记录', () => {
  beforeEach(() => {
    router.register('home', { title: '首页' });
    router.register('editor', { title: '编辑器' });
    router.register('settings', { title: '设置' });
  });

  test('back 返回上一页', () => {
    router.navigate('home');
    router.navigate('editor');
    router.navigate('settings');
    
    const result = router.back();
    expect(result).toBe(true);
    expect(router._currentRoute.path).toBe('editor');
  });

  test('forward 前进到下一页', () => {
    router.navigate('home');
    router.navigate('editor');
    router.back();
    
    const result = router.forward();
    expect(result).toBe(true);
    expect(router._currentRoute.path).toBe('editor');
  });

  test('back 在起点返回 false', () => {
    router.navigate('home');
    const result = router.back();
    expect(result).toBe(false);
  });

  test('forward 在终点返回 false', () => {
    router.navigate('home');
    router.navigate('editor');
    const result = router.forward();
    expect(result).toBe(false);
  });

  test('新导航清空前进历史', () => {
    router.register('home', { title: 'Home' });
    router.register('editor', { title: 'Editor' });
    router.register('settings', { title: 'Settings' });
    router.register('new', { title: 'New' });
    
    router.navigate('home');
    router.navigate('editor');
    router.navigate('settings');
    router.back();
    router.back();
    
    // 现在在 home，forward 应该到 editor
    expect(router.forward()).toBe(true);
    expect(router._currentRoute.path).toBe('editor');
    
    // 新导航应该清空前进历史
    router.navigate('new');
    
    // forward 应该返回 false (没有前进历史了)
    expect(router.forward()).toBe(false);
    expect(router._currentRoute.path).toBe('new');
  });
});

describe('Router - 订阅', () => {
  test('subscribe 返回取消函数', () => {
    const listener = jest.fn();
    const unsubscribe = router.subscribe(listener);
    
    router.register('home', { title: 'Home' });
    router.navigate('home');
    expect(listener).toHaveBeenCalledTimes(1);
    
    unsubscribe();
    router.navigate('home');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('Router - 工具方法', () => {
  test('getCurrentRoute 返回当前路由', () => {
    router.register('home', { title: 'Home' });
    router.navigate('home', { tab: 'recent' });
    
    const route = router.getCurrentRoute();
    expect(route.path).toBe('home');
    expect(route.params.tab).toBe('recent');
  });

  test('getCurrentRoute 无路由返回 null', () => {
    expect(router.getCurrentRoute()).toBeNull();
  });

  test('getRouteInfo 返回路由信息', () => {
    router.register('home', { title: 'Home', icon: '🏠' });
    
    const info = router.getRouteInfo('home');
    expect(info.title).toBe('Home');
    expect(info.icon).toBe('🏠');
  });

  test('getRouteInfo 不存在路由返回 null', () => {
    expect(router.getRouteInfo('unknown')).toBeNull();
  });

  test('getHistory 返回历史记录', () => {
    router.register('a', { title: 'A' });
    router.register('b', { title: 'B' });
    router.navigate('a');
    router.navigate('b');
    
    const history = router.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].path).toBe('a');
    expect(history[1].path).toBe('b');
  });
});
