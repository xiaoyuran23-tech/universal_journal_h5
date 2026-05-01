/**
 * AutoSync Plugin - 自动后台同步
 * 替代 Gist 手动同步，使用后端 API 实现增量双向同步
 * @version 7.0.0
 */

if (!window.AutoSyncPlugin) {
const AutoSyncPlugin = {
  name: 'auto-sync',
  version: '1.0.0',
  dependencies: ['auth', 'records'],

  _syncTimer: null,
  _isSyncing: false,
  _apiBase: '',
  _lastSyncUsn: 0,
  _pendingChanges: [],

  async init() {
    this.routes = [];
  },

  async start() {
    this._apiBase = window.JOURNAL_API_URL || 'http://localhost:4000/api';

    // 从本地恢复 USN
    this._lastSyncUsn = parseInt(localStorage.getItem('journal_last_sync_usn') || '0');
    this._pendingChanges = JSON.parse(localStorage.getItem('journal_pending_changes') || '[]');

    // 已登录则启动自动同步
    if (window.AuthPlugin && AuthPlugin.isLoggedIn) {
      this._startAutoSync();
    }

    // 监听登录/登出事件
    document.addEventListener('auth:login', () => { this._startAutoSync(); this._fullSync(); });
    document.addEventListener('auth:logout', () => { this._stopAutoSync(); });
  },

  stop() {
    this._stopAutoSync();
  },
  routes: [],
  actions: {},

  /**
   * 启动定时同步 (每 30 秒)
   * @private
   */
  _startAutoSync() {
    this._stopAutoSync();
    console.log('[AutoSyncPlugin] Starting auto sync (interval: 30s)');

    // 立即同步一次
    this._fullSync();

    // 定时同步
    this._syncTimer = setInterval(() => this._fullSync(), 30000);
  },

  /**
   * 停止自动同步
   * @private
   */
  _stopAutoSync() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  },

  /**
   * 完整双向同步
   * 流程: 先推送本地变更 → 拉取服务端变更 → 合并
   */
  async _fullSync() {
    if (this._isSyncing || !window.AuthPlugin?.isLoggedIn) return;
    this._isSyncing = true;

    try {
      const token = localStorage.getItem('journal_token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // 1. 推送本地变更
      let pushResult = { syncedCount: 0, serverUsn: this._lastSyncUsn };
      if (this._pendingChanges.length > 0) {
        const pushRes = await fetch(`${this._apiBase}/sync/push`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ changes: this._pendingChanges })
        });
        if (pushRes.ok) pushResult = await pushRes.json();
        this._pendingChanges = [];
        localStorage.removeItem('journal_pending_changes');
      }

      // 2. 拉取服务端变更
      const pullRes = await fetch(`${this._apiBase}/sync/pull`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ lastSyncUsn: this._lastSyncUsn })
      });

      if (pullRes.ok) {
        const pullResult = await pullRes.json();
        this._lastSyncUsn = pullResult.serverMaxUsn || this._lastSyncUsn;
        localStorage.setItem('journal_last_sync_usn', String(this._lastSyncUsn));

        // 合并服务端变更到本地
        if (pullResult.records?.length > 0) {
          await this._mergeServerChanges(pullResult.records);
        }
      }

      // 3. 同步心情数据 (可选)
      this._syncMoodToServer(token);

      console.log(`[AutoSyncPlugin] Sync complete: pushed=${pushResult.syncedCount}`);
      this._dispatchEvent('sync:complete');

    } catch (e) {
      console.error('[AutoSyncPlugin] Sync failed:', e);
      this._dispatchEvent('sync:error', e.message);
    } finally {
      this._isSyncing = false;
    }
  },

  /**
   * 记录本地变更 (用于下次同步推送)
   * @param {string} action - create|update|delete
   * @param {Object} data - 记录数据
   */
  recordChange(action, data) {
    this._pendingChanges.push(data);
    localStorage.setItem('journal_pending_changes', JSON.stringify(this._pendingChanges));
  },

  /**
   * 合并服务端变更到本地 Store
   * @private
   */
  async _mergeServerChanges(serverChanges) {
    if (!window.Store) return;

    const currentList = window.Store?.getState('records.list') || [];
    const localMap = new Map(currentList.map(r => [r.id, r]));
    let merged = false;

    for (const serverRecord of serverChanges) {
      if (serverRecord.deleted) {
        // 服务端删除：本地也删除
        if (localMap.has(serverRecord.id)) {
          localMap.delete(serverRecord.id);
          merged = true;
        }
        continue;
      }

      const localRecord = localMap.get(serverRecord.id);
      if (!localRecord) {
        // 本地不存在：直接添加
        localMap.set(serverRecord.id, serverRecord);
        merged = true;
      } else {
        // 都存在：用 updatedAt 比较
        const serverTime = new Date(serverRecord.updatedAt || 0).getTime();
        const localTime = new Date(localRecord.updatedAt || 0).getTime();
        if (serverTime > localTime) {
          localMap.set(serverRecord.id, serverRecord);
          merged = true;
        }
      }
    }

    if (merged) {
      const newList = Array.from(localMap.values()).sort((a, b) =>
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      window.Store.dispatch({
        type: 'SET_STATE',
        payload: { records: { list: newList, filtered: [...newList], loading: false } }
      });
    }
  },

  /**
   * 同步心情数据到服务端
   * @private
   */
  _syncMoodToServer(token) {
    // 心情数据目前存储在 localStorage，可选同步到服务端
    // 这里只同步最近 30 天的心情趋势元数据
  },

  /**
   * 触发自定义事件
   * @private
   */
  _dispatchEvent(name, detail = null) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }
};

window.AutoSyncPlugin = AutoSyncPlugin;
console.log('[AutoSyncPlugin] 自动同步插件已加载 (v7.0.0)');
}
