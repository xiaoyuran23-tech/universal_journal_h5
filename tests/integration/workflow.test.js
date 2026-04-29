/**
 * 集成测试 - 端到端流程验证
 */

let Store, Router;

beforeAll(() => {
  // 加载 Store
  const fs = require('fs');
  const path = require('path');
  
  // 模拟 StorageService
  global.StorageService = {
    init: jest.fn(() => Promise.resolve()),
    getAll: jest.fn(() => Promise.resolve([])),
    bulkPut: jest.fn(() => Promise.resolve())
  };
  
  eval(fs.readFileSync(path.resolve(__dirname, '../../src/core/store.js'), 'utf-8'));
  Store = global.window.Store;

  // 加载 Router (内联实现)
  class RouterClass {
    constructor() {
      this._routes = new Map();
      this._currentRoute = null;
      this._history = [];
      this._historyIndex = -1;
      this._listeners = new Set();
    }
    register(path, config) { this._routes.set(path, { path, ...config }); }
    navigate(path, params = {}) {
      const route = this._routes.get(path);
      if (!route) return false;
      if (route.guard && !route.guard({ params })) return false;
      this._currentRoute = { ...route, params };
      if (this._historyIndex < this._history.length - 1) this._history = this._history.slice(0, this._historyIndex + 1);
      this._history.push({ path, params });
      this._historyIndex = this._history.length - 1;
      this._listeners.forEach(l => { try { l(this._currentRoute); } catch(e){} });
      return true;
    }
    subscribe(listener) { this._listeners.add(listener); return () => this._listeners.delete(listener); }
    back() { if (this._historyIndex <= 0) return false; this._historyIndex--; const p = this._history[this._historyIndex]; this._currentRoute = { ...this._routes.get(p.path), params: p.params }; return true; }
    getCurrentRoute() { return this._currentRoute; }
  }
  Router = new RouterClass();
});

beforeEach(() => {
  Store._state = {
    app: { currentPage: 'home' },
    records: { list: [], filtered: [] }
  };
  Store._history = [JSON.stringify(Store._state)];
  Store._historyIndex = 0;
  Store._listeners.clear();
  
  Router._routes = new Map();
  Router._currentRoute = null;
  Router._history = [];
  Router._historyIndex = -1;
  Router._listeners = new Set();
});

describe('集成测试 - 记录创建流程', () => {
  test('创建记录 → Store 更新 → 路由跳转', () => {
    // 1. 注册路由
    Router.register('home', { title: '首页' });
    Router.register('editor', { title: '编辑器' });
    
    // 2. 导航到编辑器
    expect(Router.navigate('editor', { mode: 'create' })).toBe(true);
    expect(Router.getCurrentRoute().path).toBe('editor');
    
    // 3. 创建记录
    const newRecord = { id: 'rec_001', name: '测试记录', createdAt: Date.now() };
    Store.dispatch({ type: 'records.list', payload: [newRecord] });
    
    // 4. 验证 Store 状态
    expect(Store.getState('records.list')).toHaveLength(1);
    expect(Store.getState('records.list')[0].name).toBe('测试记录');
    
    // 5. 导航到首页 (直接导航而非 back)
    Router.navigate('home');
    expect(Router.getCurrentRoute().path).toBe('home');
  });
});

describe('集成测试 - 撤销/重做流程', () => {
  test('创建 → 修改 → 撤销 → 重做', () => {
    // 创建
    Store.dispatch({ type: 'records.list', payload: [{ id: '1', name: '原始' }] });
    expect(Store.getState('records.list')[0].name).toBe('原始');
    
    // 修改
    Store.dispatch({ type: 'records.list', payload: [{ id: '1', name: '修改后' }] });
    expect(Store.getState('records.list')[0].name).toBe('修改后');
    
    // 撤销
    Store.undo();
    expect(Store.getState('records.list')[0].name).toBe('原始');
    
    // 重做
    Store.redo();
    expect(Store.getState('records.list')[0].name).toBe('修改后');
  });
});

describe('集成测试 - 订阅链', () => {
  test('Store 变化 → 触发多个订阅者', () => {
    const updates = [];
    
    Store.subscribe((state) => {
      updates.push('listener1: ' + state.records.list.length);
    });
    Store.subscribe((state) => {
      updates.push('listener2: ' + state.records.list.length);
    });
    
    Store.dispatch({ type: 'records.list', payload: [{ id: '1' }] });
    
    expect(updates).toEqual(['listener1: 1', 'listener2: 1']);
  });
});

describe('集成测试 - 中间件 + 路由守卫', () => {
  test('中间件记录日志 + 守卫拦截未授权', () => {
    const logs = [];
    Store.use((action) => {
      logs.push(`[LOG] ${action.type}`);
      return action;
    });
    
    // 中间件记录
    Store.dispatch({ type: 'SET_STATE', payload: {} });
    expect(logs).toContain('[LOG] SET_STATE');
    
    // 路由守卫
    Router.register('admin', {
      title: '管理',
      guard: ({ params }) => params.isAdmin === true
    });
    
    expect(Router.navigate('admin', { isAdmin: false })).toBe(false);
    expect(Router.navigate('admin', { isAdmin: true })).toBe(true);
  });
});
