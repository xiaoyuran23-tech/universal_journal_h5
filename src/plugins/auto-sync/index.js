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
  _consecutiveFailures: 0,
  _maxFailures: 5,

  async init() {
    this.routes = [];
  },

  async start() {
    this._apiBase = window.JOURNAL_API_URL || 'http://localhost:4000/api';

    // 从本地恢复 USN
    this._lastSyncUsn = parseInt(localStorage.getItem('journal_last_sync_usn') || '0');
    if (isNaN(this._lastSyncUsn)) this._lastSyncUsn = 0;
    this._pendingChanges = JSON.parse(localStorage.getItem('journal_pending_changes') || '[]');

    // 已登录则启动自动同步
    if (window.AuthPlugin && AuthPlugin.isLoggedIn) {
      this._startAutoSync();
    }

    // 监听登录/登出事件
    document.addEventListener('auth:login', (e) => {
      const isNewUser = e.detail?.isNewUser;
      // 无论新老用户，登录时都从零开始拉取（因为可能是新设备或数据过期）
      // 但本地如果有 pending changes（离线期间创建的），需要保留并推送
      const savedPending = isNewUser ? [] : this._pendingChanges;
      this._lastSyncUsn = 0;
      localStorage.setItem('journal_last_sync_usn', '0');
      this._pendingChanges = savedPending;
      if (isNewUser) {
        localStorage.removeItem('journal_pending_changes');
      } else {
        localStorage.setItem('journal_pending_changes', JSON.stringify(this._pendingChanges));
      }
      this._startAutoSync();
    });
    document.addEventListener('auth:logout', () => { this._stopAutoSync(); });

    // 更新云同步弹窗状态
    this._updateSyncStatusUI();
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
      // v7.0.3: 使用 httpOnly cookie 认证，不再手动附加 token
      const syncHeaders = {
        'Content-Type': 'application/json'
      };

      // 1. 推送本地变更
      let pushResult = { syncedCount: 0, serverUsn: this._lastSyncUsn };
      if (this._pendingChanges.length > 0) {
        const pushRes = await fetch(`${this._apiBase}/sync/push`, {
          method: 'POST',
          headers: syncHeaders,
          credentials: 'include',
          body: JSON.stringify({ changes: this._pendingChanges })
        });
        if (pushRes.ok) {
          pushResult = await pushRes.json();
          // 只在推送成功时清除本地变更
          this._pendingChanges = [];
          localStorage.removeItem('journal_pending_changes');
        } else {
          console.warn('[AutoSyncPlugin] Push failed, changes preserved for retry');
        }
      }

      // 2. 拉取服务端变更
      const pullRes = await fetch(`${this._apiBase}/sync/pull`, {
        method: 'POST',
        headers: syncHeaders,
        credentials: 'include',
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
      } else if (pullRes.status === 401) {
        // Token 无效或过期，自动登出
        console.warn('[AutoSyncPlugin] Token expired, logging out');
        if (window.AuthPlugin) AuthPlugin.logout();
      } else {
        console.warn('[AutoSyncPlugin] Pull failed, status:', pullRes.status);
      }

      // 3. 同步心情数据 (可选)
      this._syncMoodToServer();

      console.log(`[AutoSyncPlugin] Sync complete: pushed=${pushResult.results?.length || pushResult.syncedCount || 0}`);
      this._consecutiveFailures = 0;
      this._dispatchEvent('sync:complete');

    } catch (e) {
      console.error('[AutoSyncPlugin] Sync failed:', e);
      this._consecutiveFailures++;
      if (this._consecutiveFailures >= this._maxFailures) {
        console.warn('[AutoSyncPlugin] Too many consecutive failures, stopping auto sync');
        this._stopAutoSync();
        this._showToast('云同步已暂停，请检查网络连接');
      }
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
    // 先去重：如果同一 id 已在队列中，替换为最新版本
    const existingIndex = this._pendingChanges.findIndex(c => c.id === data.id);
    if (existingIndex !== -1) {
      this._pendingChanges.splice(existingIndex, 1);
    }

    if (action === 'delete') {
      // 删除操作只需推送 id 和标记
      this._pendingChanges.push({ id: data.id, _deleted: true });
    } else {
      this._pendingChanges.push(data);
    }
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
        // 都存在：用 USN 比较（USN 是单调递增的，比时间戳更可靠）
        const serverUsn = serverRecord.usn || 0;
        const localUsn = localRecord.usn || 0;
        if (serverUsn > localUsn) {
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

      // 同步写回 IndexedDB（包括删除服务端已删的记录）
      if (window.StorageBackend) {
        for (const serverRecord of serverChanges) {
          if (serverRecord.deleted) {
            // 服务端已删：从本地 IndexedDB 也删除
            await StorageBackend.delete(serverRecord.id);
          } else {
            // 服务端有更新：写入最新状态
            await StorageBackend.put(serverRecord);
          }
        }
      }
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
  },

  /**
   * 更新云同步弹窗状态
   * @private
   */
  _updateSyncStatusUI() {
    const detail = document.getElementById('sync-status-detail');
    if (!detail) return;

    if (!window.AuthPlugin?.isLoggedIn) {
      detail.textContent = '请先登录查看同步状态';
      return;
    }

    const pending = this._pendingChanges?.length || 0;
    const lastSync = localStorage.getItem('journal_last_sync_usn') || '0';
    const syncingText = this._isSyncing ? ' | 同步中...' : '';
    detail.textContent = `已登录 | 待同步: ${pending} 条 | 最后同步 USN: ${lastSync}${syncingText}`;
  },

  /**
   * 显示 Toast
   * @private
   */
  _showToast(msg) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(msg, { duration: 3000 });
    } else {
      const toast = document.getElementById('toast');
      if (toast) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
    }
  },
};

window.AutoSyncPlugin = AutoSyncPlugin;
console.log('[AutoSyncPlugin] 自动同步插件已加载 (v7.0.0)');
}
