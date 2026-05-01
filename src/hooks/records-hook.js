/**
 * RecordsHook - 记录数据聚合层 (v6.4.0 简化版)
 * 移除废弃分类系统，改用直接 Store 读取替代 JSON.stringify 比较
 */

class RecordsHook {
  static DEFAULT_CATEGORIES = [
    { key: 'all', label: '全部', icon: '' }
  ];

  constructor(options = {}) {
    this._activeKey = options.activeKey || 'all';
    this._loading = false;
    this._error = null;
    this._listeners = [];
    this._records = [];
    this._storeUnsubscribe = null;
    this._subscribeToStore();
  }

  _subscribeToStore() {
    const store = window.Store;
    if (!store || typeof store.subscribe !== 'function') {
      console.warn('[RecordsHook] Store.subscribe not available');
      return;
    }

    // 直接引用 Store 数组，避免 JSON.stringify 比较
    this._storeUnsubscribe = store.subscribe((state, prevState) => {
      const newList = state?.records?.list || [];
      const oldList = prevState?.records?.list || [];
      if (newList !== oldList) {
        this._records = newList;
        this._notify();
      }
    });

    const initialState = store.getState?.();
    this._records = initialState?.records?.list || [];
  }

  destroy() {
    if (this._storeUnsubscribe) { this._storeUnsubscribe(); this._storeUnsubscribe = null; }
  }

  get activeKey() { return this._activeKey; }
  set activeKey(key) { this._activeKey = key; this._notify(); }
  set records(data) { this._records = Array.isArray(data) ? data : []; this._notify(); }

  get featured() {
    const records = this._getFilteredRecords();
    if (!records.length) return null;
    return [...records].sort((a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.createdAt || 0).getTime()
    )[0];
  }

  get records() { return this._getFilteredRecords(); }
  get categories() { return this.constructor.DEFAULT_CATEGORIES; }
  get loading() { return this._loading; }
  get error() { return this._error; }

  async refresh() {
    try {
      this._loading = true;
      this._error = null;
      this._notify();

      const store = window.Store;
      if (store && typeof store.hydrate === 'function') {
        await store.hydrate();
      }

      this._loading = false;
      this._notify();
    } catch (err) {
      this._error = err.message || '加载失败，请稍后重试';
      this._loading = false;
      this._notify();
    }
  }

  subscribe(listener) {
    this._listeners.push(listener);
    listener(this._getState());
    return () => { this._listeners = this._listeners.filter(l => l !== listener); };
  }

  _getFilteredRecords() {
    let allRecords = this._records;
    if (allRecords.length === 0) {
      const store = window.Store;
      if (store) {
        allRecords = typeof store.getState === 'function'
          ? (store.getState()?.records?.list || [])
          : (store._state?.records?.list || []);
      }
    }

    if (this._activeKey === 'all') return allRecords;
    return allRecords.filter(r =>
      r.category === this._activeKey || (r.tags && r.tags.includes(this._activeKey))
    );
  }

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

  _notify() {
    const state = this._getState();
    this._listeners.forEach(listener => {
      try { listener(state); } catch (e) { console.error('[RecordsHook] Listener error:', e); }
    });
  }
}

window.RecordsHook = RecordsHook;
console.log('[RecordsHook] 记录数据聚合层已加载 (v6.4.0 简化)');
