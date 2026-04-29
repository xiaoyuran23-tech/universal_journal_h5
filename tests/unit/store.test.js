/**
 * Store 单元测试
 * 测试核心状态管理功能
 */

// 导入 Store (由于是 script 标签加载，需要模拟)
let Store;

beforeAll(() => {
  // 重新初始化 Store
  delete global.window.Store;
  
  // 模拟 StorageService
  global.StorageService = {
    init: jest.fn(() => Promise.resolve()),
    getAll: jest.fn(() => Promise.resolve([])),
    bulkPut: jest.fn(() => Promise.resolve())
  };
  
  // 加载 Store 源码
  const fs = require('fs');
  const path = require('path');
  const storeCode = fs.readFileSync(path.resolve(__dirname, '../../src/core/store.js'), 'utf-8');
  
  // 执行源码以创建 window.Store
  eval(storeCode);
  
  Store = global.window.Store;
});

beforeEach(() => {
  // 每个测试前重置 Store
  Store._state = {
    app: { currentPage: 'home', theme: 'light', language: 'zh-CN', locked: false },
    records: { list: [], filtered: [], loading: false, error: null },
    ui: { toasts: [], modals: [], loading: false, sidebar: false }
  };
  Store._history = [JSON.stringify(Store._state)];
  Store._historyIndex = 0;
  Store._listeners.clear();
  Store._middlewares = [];
  StorageService.getAll.mockClear();
  StorageService.bulkPut.mockClear();
});

describe('Store - 状态管理', () => {
  test('getState 无参数返回完整状态', () => {
    const state = Store.getState();
    expect(state).toHaveProperty('app');
    expect(state).toHaveProperty('records');
    expect(state).toHaveProperty('ui');
  });

  test('getState 通过路径获取嵌套值', () => {
    expect(Store.getState('app.currentPage')).toBe('home');
    expect(Store.getState('records.loading')).toBe(false);
    expect(Store.getState('ui.sidebar')).toBe(false);
  });

  test('getState 返回不存在的路径为 undefined', () => {
    expect(Store.getState('nonexistent.path')).toBeUndefined();
  });

  test('dispatch SET_STATE 更新状态', () => {
    Store.dispatch({
      type: 'SET_STATE',
      payload: { app: { currentPage: 'editor', theme: 'dark' } }
    });
    
    expect(Store.getState('app.currentPage')).toBe('editor');
    expect(Store.getState('app.theme')).toBe('dark');
  });

  test('dispatch 嵌套路径更新', () => {
    Store.dispatch({
      type: 'records.list',
      payload: [{ id: '1', name: 'Test' }]
    });
    
    const list = Store.getState('records.list');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Test');
  });

  test('dispatch 无 type 抛出错误', () => {
    expect(() => Store.dispatch({})).toThrow('Action 必须包含 type 字段');
    expect(() => Store.dispatch(null)).toThrow();
  });
});

describe('Store - 订阅机制', () => {
  test('subscribe 返回取消函数', () => {
    const listener = jest.fn();
    const unsubscribe = Store.subscribe(listener);
    
    Store.dispatch({ type: 'SET_STATE', payload: { app: { test: true } } });
    expect(listener).toHaveBeenCalledTimes(1);
    
    unsubscribe();
    Store.dispatch({ type: 'SET_STATE', payload: { app: { test: false } } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('订阅者接收新旧状态', () => {
    const listener = jest.fn();
    Store.subscribe(listener);
    
    Store.dispatch({
      type: 'SET_STATE',
      payload: { app: { currentPage: 'editor' } }
    });
    
    expect(listener).toHaveBeenCalled();
    const [newState, prevState] = listener.mock.calls[0];
    expect(newState.app.currentPage).toBe('editor');
    expect(prevState.app.currentPage).toBe('home');
  });

  test('订阅者错误不影响其他订阅者', () => {
    const badListener = jest.fn(() => { throw new Error('oops'); });
    const goodListener = jest.fn();
    
    Store.subscribe(badListener);
    Store.subscribe(goodListener);
    
    Store.dispatch({ type: 'SET_STATE', payload: {} });
    expect(goodListener).toHaveBeenCalled();
  });
});

describe('Store - 中间件', () => {
  test('use 注册中间件', () => {
    const middleware = jest.fn((action, state) => action);
    Store.use(middleware);
    
    Store.dispatch({ type: 'SET_STATE', payload: {} });
    expect(middleware).toHaveBeenCalled();
  });

  test('中间件可以修改 action', () => {
    Store.use((action) => {
      if (action.type === 'TEST') {
        return { type: 'SET_STATE', payload: { modified: true } };
      }
      return action;
    });
    
    Store.dispatch({ type: 'TEST' });
    expect(Store.getState('modified')).toBe(true);
  });

  test('多个中间件按顺序执行', () => {
    const order = [];
    Store.use((action) => { order.push(1); return action; });
    Store.use((action) => { order.push(2); return action; });
    
    Store.dispatch({ type: 'SET_STATE', payload: {} });
    expect(order).toEqual([1, 2]);
  });
});

describe('Store - 撤销/重做', () => {
  test('undo 回退到上一状态', () => {
    Store.dispatch({ type: 'SET_STATE', payload: { app: { currentPage: 'a' } } });
    Store.dispatch({ type: 'SET_STATE', payload: { app: { currentPage: 'b' } } });
    
    expect(Store.getState('app.currentPage')).toBe('b');
    
    const result = Store.undo();
    expect(result).toBe(true);
    expect(Store.getState('app.currentPage')).toBe('a');
  });

  test('redo 重做被撤销的操作', () => {
    Store.dispatch({ type: 'SET_STATE', payload: { app: { currentPage: 'a' } } });
    Store.undo();
    
    const result = Store.redo();
    expect(result).toBe(true);
    expect(Store.getState('app.currentPage')).toBe('a');
  });

  test('undo 在初始状态返回 false', () => {
    const result = Store.undo();
    expect(result).toBe(false);
  });

  test('redo 在最后状态返回 false', () => {
    Store.dispatch({ type: 'SET_STATE', payload: { app: { currentPage: 'a' } } });
    
    const result = Store.redo();
    expect(result).toBe(false);
  });

  test('新操作清空 redo 历史', () => {
    Store.dispatch({ type: 'SET_STATE', payload: { app: { currentPage: 'a' } } });
    Store.dispatch({ type: 'SET_STATE', payload: { app: { currentPage: 'b' } } });
    Store.undo();
    
    // 新操作应该覆盖 redo 历史
    Store.dispatch({ type: 'SET_STATE', payload: { app: { currentPage: 'c' } } });
    
    expect(Store.redo()).toBe(false);
    expect(Store.getState('app.currentPage')).toBe('c');
  });
});

describe('Store - 批量更新', () => {
  test('batch 只触发一次通知', () => {
    const listener = jest.fn();
    Store.subscribe(listener);
    
    Store.batch((dispatch) => {
      dispatch({ type: 'SET_STATE', payload: { count: 1 } });
      dispatch({ type: 'SET_STATE', payload: { count: 2 } });
      dispatch({ type: 'SET_STATE', payload: { count: 3 } });
    });
    
    // batch 只在最后通知一次
    expect(listener).toHaveBeenCalledTimes(1);
    expect(Store.getState('count')).toBe(3);
  });
});

describe('Store - 持久化', () => {
  test('persist 调用 StorageService.bulkPut', async () => {
    Store.dispatch({
      type: 'records.list',
      payload: [{ id: '1', name: 'Test' }]
    });
    
    await Store.persist();
    expect(StorageService.bulkPut).toHaveBeenCalled();
  });

  test('hydrate 从 StorageService 加载数据', async () => {
    const mockRecords = [
      { id: '1', name: 'Record 1' },
      { id: '2', name: 'Record 2' }
    ];
    StorageService.getAll.mockResolvedValue(mockRecords);
    
    const result = await Store.hydrate();
    
    expect(result).toBe(true);
    expect(Store.getState('records.list')).toHaveLength(2);
    expect(Store.getState('records.list')[0].name).toBe('Record 1');
  });

  test('hydrate 无数据返回 false', async () => {
    StorageService.getAll.mockResolvedValue([]);
    const result = await Store.hydrate();
    expect(result).toBe(false);
  });
});

describe('Store - 历史记录限制', () => {
  test('历史记录不超过 50 条', () => {
    for (let i = 0; i < 60; i++) {
      Store.dispatch({ type: 'SET_STATE', payload: { step: i } });
    }
    
    expect(Store._history.length).toBeLessThanOrEqual(51);
  });
});
