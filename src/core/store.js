/**
 * Store - 集中式状态管理 (类似 Redux)
 * 单一数据源，状态变更必须通过 Action
 * @version 6.2.0
 */
class Store {
  constructor(initialState = {}) {
    this._state = this._deepClone(initialState);
    this._listeners = new Set();
    this._middlewares = [];

    // 初始化历史记录 (用于撤销/重做)
    this._history = [JSON.stringify(this._state)];
    this._historyIndex = 0;
    this._batchDepth = 0;
  }

  /**
   * 获取状态
   * @param {string} [path] - 点号分隔的路径，如 'records.list'
   * @returns {*}
   */
  getState(path) {
    if (!path) return this._state;

    return path.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, this._state);
  }

  /**
   * 订阅状态变化
   * @param {Function} listener - 监听函数
   * @returns {Function} 取消订阅函数
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * 注册中间件
   * @param {Function} middleware - 中间件函数
   */
  use(middleware) {
    this._middlewares.push(middleware);
  }

  /**
   * 分发 Action (状态变更的唯一方式)
   * @param {Object} action - { type, payload }
   */
  dispatch(action) {
    if (!action || !action.type) {
      throw new Error('[Store] Action 必须包含 type 字段');
    }

    // 执行中间件
    let processedAction = action;
    for (const middleware of this._middlewares) {
      const result = middleware(processedAction, this._state);
      if (result !== undefined) {
        processedAction = result;
      }
    }

    // 获取变更前的状态引用 (浅拷贝，不再深拷贝整个状态)
    const prevState = this._snapshot();

    // 处理 Action
    this._handleAction(processedAction);

    // 记录历史 (仅序列化关键数据，避免序列化大对象)
    this._recordHistory();

    // 通知订阅者 (传递引用，由订阅者自行决定是否需要深拷贝)
    this._notify(prevState);
  }

  /**
   * 创建状态快照 (结构化克隆，优于 JSON 往返)
   * @private
   */
  _snapshot() {
    // 仅快照 records.list 的元数据 (不含 photos base64)
    const recordsSnapshot = {
      loading: this._state.records?.loading,
      error: this._state.records?.error,
      list: (this._state.records?.list || []).map(r => ({
        id: r.id,
        name: r.name,
        tags: r.tags,
        status: r.status,
        favorite: r.favorite,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
        // 排除 photos、notes 等大字段
      })),
      count: this._state.records?.list?.length || 0
    };

    return {
      app: { ...this._state.app },
      records: recordsSnapshot,
      ui: { ...this._state.ui }
    };
  }

  /**
   * 深克隆 (使用 structuredClone 或 JSON 回退)
   * @private
   */
  _deepClone(obj) {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 处理 Action
   * @private
   */
  _handleAction(action) {
    const { type, payload } = action;

    // 优先检查动态 reducer (支持 'records/add' 等格式)
    const reducerKey = type.replace(/\//g, '.');
    if (this._reducers && this._reducers[reducerKey]) {
      this._state = this._reducers[reducerKey](this._state, payload);
      return;
    }

    // 支持嵌套路径更新 (如 'app.currentPage')
    if (type.includes('.')) {
      this._setNestedState(type, payload);
      return;
    }

    // 根据 type 处理
    switch (type) {
      case 'SET_STATE':
        if (payload && typeof payload === 'object') {
          this._state = { ...this._state, ...payload };
        }
        break;

      case 'RESET_STATE':
        this._state = { ...payload };
        break;
    }
  }

  /**
   * 设置嵌套状态
   * @private
   */
  _setNestedState(path, value) {
    const keys = path.split('.');
    const newState = JSON.parse(JSON.stringify(this._state));
    let target = newState;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) {
        target[keys[i]] = {};
      }
      target = target[keys[i]];
    }

    target[keys[keys.length - 1]] = value;
    this._state = newState;
  }

  /**
   * 通知订阅者
   * @private
   */
  _notify(prevState) {
    if (this._batchDepth > 0) return; // defer until batch completes
    this._listeners.forEach(listener => {
      try {
        listener(this._state, prevState);
      } catch (error) {
        console.error('[Store] Listener error:', error);
      }
    });
  }

  /**
   * 记录历史
   * @private
   */
  _recordHistory() {
    // 删除当前索引之后的历史
    this._history = this._history.slice(0, this._historyIndex + 1);

    // 仅序列化轻量级状态快照 (不含 photos 等大字段)
    const lightweight = {
      app: this._state.app,
      records: {
        list: (this._state.records?.list || []).map(r => ({
          id: r.id, name: r.name, tags: r.tags,
          status: r.status, favorite: r.favorite,
          createdAt: r.createdAt, updatedAt: r.updatedAt
        })),
        filtered: this._state.records?.filtered?.map(r => r.id) || [],
        loading: this._state.records?.loading
      },
      ui: { ...this._state.ui, toasts: [], modals: [] }
    };

    this._history.push(JSON.stringify(lightweight));
    this._historyIndex++;

    // 限制历史记录数量
    if (this._history.length > 50) {
      this._history.shift();
      this._historyIndex--;
    }
  }

  /**
   * 撤销
   * @returns {boolean} 是否成功
   */
  undo() {
    if (this._historyIndex > 0) {
      this._historyIndex--;
      const restored = JSON.parse(this._history[this._historyIndex]);
      // 恢复轻量字段，保留 notes/photos 等大字段
      if (restored.records?.list) {
        const currentList = this._state.records?.list || [];
        const restoredIds = new Set(restored.records.list.map(r => r.id));
        // 合并: 恢复元数据 + 保留当前大字段
        restored.records.list = restored.records.list.map(restoredItem => {
          const current = currentList.find(r => r.id === restoredItem.id);
          return current ? { ...restoredItem, notes: current.notes, photos: current.photos } : restoredItem;
        });
        // 保留不在恢复列表中的记录
        const extraItems = currentList.filter(r => !restoredIds.has(r.id));
        restored.records.list = [...restored.records.list, ...extraItems];
      }
      this._state = { ...this._state, ...restored };
      this._notify();
      return true;
    }
    return false;
  }

  /**
   * 重做
   * @returns {boolean} 是否成功
   */
  redo() {
    if (this._historyIndex < this._history.length - 1) {
      this._historyIndex++;
      const restored = JSON.parse(this._history[this._historyIndex]);
      if (restored.records?.list) {
        const currentList = this._state.records?.list || [];
        restored.records.list = restored.records.list.map(restoredItem => {
          const current = currentList.find(r => r.id === restoredItem.id);
          return current ? { ...restoredItem, notes: current.notes, photos: current.photos } : restoredItem;
        });
      }
      this._state = { ...this._state, ...restored };
      this._notify();
      return true;
    }
    return false;
  }

  canUndo() {
    return this._history.length > 0 && this._historyIndex > 0;
  }

  /**
   * 批量更新 (仅一次通知，支持嵌套)
   * @param {Function} updates - 返回多个 action 的函数
   */
  batch(updates) {
    this._batchDepth++;
    try {
      updates(this.dispatch.bind(this));
    } finally {
      this._batchDepth--;
      if (this._batchDepth === 0) {
        this._notify();
      }
    }
  }

  /**
   * 持久化到 IndexedDB (异步)
   */
  async persist() {
    try {
      if (window.StorageService) {
        await StorageService.bulkPut(this._state.records.list);
      }
    } catch (error) {
      console.error('[Store] Persist error:', error);
    }
  }

  /**
   * 从 IndexedDB 加载 (异步)
   * @returns {Promise<boolean>}
   */
  async hydrate() {
    try {
      if (window.StorageService) {
        const records = await window.StorageService.getAll();
        if (records && records.length > 0) {
          this._state.records = {
            ...this._state.records,
            list: records,
            filtered: records
          };
          this._history = [JSON.stringify(this._state)];
          this._notify();
          return true;
        }
      }
    } catch (error) {
      console.error('[Store] Hydrate error:', error);
    }
    return false;
  }
}

// 全局单例
window.Store = new Store({
  app: {
    currentPage: 'home',
    theme: 'light',
    language: 'zh-CN',
    locked: false
  },
  records: {
    list: [],
    filtered: [],
    loading: false,
    error: null
  },
  ui: {
    toasts: [],
    modals: [],
    loading: false,
    sidebar: false
  }
});

console.log('[Store] 状态管理已初始化 (v6.2.0: 结构化快照优化)');
