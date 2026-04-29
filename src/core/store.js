/**
 * Store - 集中式状态管理 (类似 Redux)
 * 单一数据源，状态变更必须通过 Action
 * @version 6.0.0
 */
class Store {
  constructor(initialState = {}) {
    this._state = { ...initialState };
    this._listeners = new Set();
    this._middlewares = [];
    
    // 初始化历史记录 (用于撤销/重做)
    this._history = [JSON.stringify(this._state)];
    this._historyIndex = 0;
  }

  /**
   * 获取状态
   * @param {string} [path] - 点号分隔的路径，如 'records.list'
   * @returns {*}
   */
  getState(path) {
    if (!path) return { ...this._state };
    
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

    // 获取变更前的状态
    const prevState = JSON.parse(JSON.stringify(this._state));
    
    // 处理 Action
    this._handleAction(processedAction);
    
    // 记录历史 (用于撤销)
    this._recordHistory();
    
    // 通知订阅者
    this._notify(prevState);
  }

  /**
   * 处理 Action
   * @private
   */
  _handleAction(action) {
    const { type, payload } = action;
    
    // 支持嵌套路径更新
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
      
      default:
        // 支持动态 reducer
        if (this._reducers && this._reducers[type]) {
          this._state = this._reducers[type](this._state, payload);
        }
        break;
    }
  }

  /**
   * 设置嵌套状态
   * @private
   */
  _setNestedState(path, value) {
    const keys = path.split('.');
    let target = this._state;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) {
        target[keys[i]] = {};
      }
      target = target[keys[i]];
    }
    
    target[keys[keys.length - 1]] = value;
  }

  /**
   * 通知订阅者
   * @private
   */
  _notify(prevState) {
    const newState = { ...this._state };
    this._listeners.forEach(listener => {
      try {
        listener(newState, prevState);
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
    
    // 添加新状态
    this._history.push(JSON.stringify(this._state));
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
      this._state = JSON.parse(this._history[this._historyIndex]);
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
      this._state = JSON.parse(this._history[this._historyIndex]);
      this._notify();
      return true;
    }
    return false;
  }

  /**
   * 批量更新
   * @param {Function} updates - 返回多个 action 的函数
   */
  batch(updates) {
    // 临时禁用通知
    const originalNotify = this._notify.bind(this);
    this._notify = () => {};
    
    try {
      updates(this.dispatch.bind(this));
    } finally {
      this._notify = originalNotify;
      this._notify();
    }
  }

  /**
   * 持久化到 localStorage
   * @param {string} key - 存储键名
   */
  persist(key = 'journal_state') {
    try {
      localStorage.setItem(key, JSON.stringify(this._state));
    } catch (error) {
      console.error('[Store] Persist error:', error);
    }
  }

  /**
   * 从 localStorage 加载
   * @param {string} key - 存储键名
   * @returns {boolean} 是否成功加载
   */
  hydrate(key = 'journal_state') {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        this._state = JSON.parse(saved);
        this._history = [JSON.stringify(this._state)];
        this._historyIndex = 0;
        this._notify();
        return true;
      }
    } catch (error) {
      console.error('[Store] Hydrate error:', error);
    }
    return false;
  }
}

// 全局单例
window.Store = new Store({
  // 应用状态
  app: {
    currentPage: 'home',
    theme: 'light',
    language: 'zh-CN',
    locked: false
  },
  
  // 记录数据
  records: {
    list: [],
    filtered: [],
    loading: false,
    error: null
  },
  
  // UI 状态
  ui: {
    toasts: [],
    modals: [],
    loading: false,
    sidebar: false
  }
});

console.log('[Store] 状态管理已初始化');
