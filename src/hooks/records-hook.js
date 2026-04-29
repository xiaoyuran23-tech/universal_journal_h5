/**
 * RecordsHook - 记录数据聚合层
 * 等效 React 的 useRecords Hook
 * 提供分类筛选 + 精选推荐 + 加载/错误状态
 * @version 6.1.0
 */

class RecordsHook {
  static DEFAULT_CATEGORIES = [
    { key: 'all', label: '全部', icon: '' },
    { key: 'plant', label: '植物', icon: '' },
    { key: 'food', label: '美食', icon: '' },
    { key: 'city', label: '足迹', icon: '🏙️' },
    { key: 'daily', label: '日常', icon: '☕' }
  ];

  constructor(options = {}) {
    this._activeKey = options.activeKey || 'all';
    this._loading = false;
    this._error = null;
    this._listeners = [];
    this._records = [];
    this._storeUnsubscribe = null;
    
    // 订阅 Store 变化
    this._subscribeToStore();
  }

  /**
   * 订阅 Store 数据变化
   * @private
   */
  _subscribeToStore() {
    const store = window.Store;
    if (!store || typeof store.subscribe !== 'function') {
      console.warn('[RecordsHook] Store.subscribe not available');
      return;
    }
    
    // 订阅 records.list 变化
    this._storeUnsubscribe = store.subscribe((state) => {
      const newList = state?.records?.list || [];
      // 如果数据变化，更新内部缓存并通知
      if (JSON.stringify(this._records) !== JSON.stringify(newList)) {
        this._records = newList;
        this._notify();
      }
    });
  }

  /**
   * 销毁
   */
  destroy() {
    if (this._storeUnsubscribe) {
      this._storeUnsubscribe();
      this._storeUnsubscribe = null;
    }
  }

  /**
   * 获取当前激活的分类
   */
  get activeKey() {
    return this._activeKey;
  }

  /**
   * 设置分类
   */
  set activeKey(key) {
    this._activeKey = key;
    this._notify();
  }

  /**
   * 设置记录数据
   */
  set records(data) {
    this._records = Array.isArray(data) ? data : [];
    this._notify();
  }

  /**
   * 获取精选记录（最新更新的记录）
   */
  get featured() {
    const records = this._getFilteredRecords();
    if (!records.length) return null;
    
    // 按 updatedAt 排序，取最新的一条
    return [...records].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    })[0];
  }

  /**
   * 获取当前分类下的记录
   */
  get records() {
    return this._getFilteredRecords();
  }

  /**
   * 获取分类标签
   */
  get categories() {
    return this.constructor.DEFAULT_CATEGORIES;
  }

  /**
   * 加载状态
   */
  get loading() {
    return this._loading;
  }

  /**
   * 错误信息
   */
  get error() {
    return this._error;
  }

  /**
   * 刷新数据
   */
  async refresh() {
    try {
      this._loading = true;
      this._error = null;
      this._notify();

      // 触发 Store 数据刷新
      const store = window.Store;
      if (store && typeof store.dispatch === 'function') {
        await store.dispatch({ type: 'RECORDS/FETCH' });
      }

      this._loading = false;
      this._notify();
    } catch (err) {
      this._error = err.message || '加载失败，请稍后重试';
      this._loading = false;
      this._notify();
    }
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener) {
    this._listeners.push(listener);
    // 立即通知一次当前状态
    listener(this._getState());
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  }

  /**
   * 根据分类筛选记录
   * @private
   */
  _getFilteredRecords() {
    // 优先使用内部缓存，否则从 Store 获取
    let allRecords = this._records;
    
    // 如果内部缓存为空，尝试从 Store 获取
    if (allRecords.length === 0) {
      const store = window.Store;
      if (store) {
        if (typeof store.getState === 'function') {
          const state = store.getState();
          allRecords = state?.records?.list || [];
        } else if (store._state) {
          allRecords = store._state.records?.list || [];
        }
      }
    }
    
    if (this._activeKey === 'all') {
      return allRecords;
    }

    // 通过 tags 或 category 字段筛选
    return allRecords.filter(record => {
      // 支持 category 字段
      if (record.category === this._activeKey) return true;
      
      // 支持 tags 字段（兼容现有数据）
      if (record.tags && record.tags.includes(this._activeKey)) return true;
      
      return false;
    });
  }

  /**
   * 获取当前状态
   * @private
   */
  _getState() {
    return {
      activeKey: this._activeKey,
      records: this.records,
      featured: this.featured,
      loading: this._loading,
      error: this._error,
      categories: this.categories
    };
  }

  /**
   * 通知订阅者
   * @private
   */
  _notify() {
    const state = this._getState();
    this._listeners.forEach(listener => {
      try {
        listener(state);
      } catch (e) {
        console.error('[RecordsHook] Listener error:', e);
      }
    });
  }
}

window.RecordsHook = RecordsHook;
console.log('[RecordsHook] 记录数据聚合层已加载');
