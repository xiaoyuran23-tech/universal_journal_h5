/**
 * AutoSync Plugin v7.4.0 - 自动后台同步
 * 接入 SyncMerge（Vector Clock 字段级冲突解决）、同步日志、心情同步
 */

if (!window.AutoSyncPlugin) {
const AutoSyncPlugin = {
  name: 'auto-sync',
  version: '7.4.0',
  dependencies: ['auth', 'records'],

  _syncTimer: null,
  _isSyncing: false,
  _apiBase: '',
  _lastSyncUsn: 0,
  _pendingChanges: [],
  _consecutiveFailures: 0,
  _maxFailures: 5,
  _syncLog: [],
  _maxLogEntries: 50,

  async init() {
    this.routes = [];
  },

  async start() {
    this._apiBase = window.JOURNAL_API_URL || 'http://localhost:4000/api';
    this._lastSyncUsn = parseInt(localStorage.getItem('journal_last_sync_usn') || '0');
    if (isNaN(this._lastSyncUsn)) this._lastSyncUsn = 0;
    this._pendingChanges = JSON.parse(localStorage.getItem('journal_pending_changes') || '[]');

    if (!window.AuthPlugin) {
      console.log('[AutoSyncPlugin] AuthPlugin not loaded, retrying in 500ms');
      setTimeout(() => this.start(), 500);
      return;
    }

    if (window.AuthPlugin.isLoggedIn) {
      this._startAutoSync();
    }

    document.addEventListener('auth:login', (e) => {
      const isNewUser = e.detail?.isNewUser;
      const savedPending = isNewUser ? [] : this._pendingChanges;
      this._lastSyncUsn = 0;
      localStorage.setItem('journal_last_sync_usn', '0');
      this._pendingChanges = savedPending;
      if (isNewUser) {
        localStorage.removeItem('journal_pending_changes');
      } else {
        localStorage.setItem('journal_pending_changes', JSON.stringify(this._pendingChanges));
      }
      const delay = isNewUser ? 2000 : 1000;
      setTimeout(() => this._startAutoSync(), delay);
    });
    document.addEventListener('auth:logout', () => { this._stopAutoSync(); });
    document.addEventListener('auth:login', () => { this._updateSyncStatusUI(); });
    document.addEventListener('auth:logout', () => { this._updateSyncStatusUI(); });
    this._updateSyncStatusUI();
  },

  stop() {
    this._stopAutoSync();
  },
  routes: [],
  actions: {},

  _startAutoSync() {
    this._stopAutoSync();
    console.log('[AutoSyncPlugin] Starting auto sync (interval: 30s)');
    this._scheduleNextSync();
  },

  _scheduleNextSync() {
    this._fullSync().finally(() => {
      this._syncTimer = setTimeout(() => {
        this._scheduleNextSync();
      }, 30000);
    });
  },

  _stopAutoSync() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  },

  // ==================== 公开 API ====================

  _getCSRFToken() {
    const match = document.cookie?.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  },

  async syncNow() {
    if (!window.AuthPlugin?.isLoggedIn) return;
    if (this._isSyncing) return;
    await this._fullSync();
  },

  /**
   * 获取同步日志
   */
  getSyncLog() {
    return [...this._syncLog];
  },

  /**
   * 清空同步日志
   */
  clearSyncLog() {
    this._syncLog = [];
    this._renderSyncLog();
  },

  // ==================== 内部方法 ====================

  /**
   * 记录同步日志
   * @private
   */
  _addSyncLog(message, type = 'info') {
    const entry = {
      time: new Date().toISOString(),
      message,
      type // 'success' | 'error' | 'info' | 'warning'
    };
    this._syncLog.push(entry);
    if (this._syncLog.length > this._maxLogEntries) {
      this._syncLog.shift();
    }
    this._renderSyncLog();
  },

  /**
   * 渲染同步日志到 DOM
   * @private
   */
  _renderSyncLog() {
    const logEl = document.getElementById('sync-log');
    if (!logEl) return;
    const colorMap = { success: '#52c41a', error: '#ff4d4f', warning: '#faad14', info: '#666' };
    logEl.innerHTML = this._syncLog.slice().reverse().map(entry => {
      const time = new Date(entry.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const color = colorMap[entry.type] || colorMap.info;
      return `<div style="font-size:12px;font-family:monospace;color:${color};margin-bottom:3px;">[${time}] ${entry.message}</div>`;
    }).join('');
  },

  /**
   * 完整双向同步
   * @private
   */
  async _fullSync() {
    if (this._isSyncing || !window.AuthPlugin?.isLoggedIn) return;
    this._isSyncing = true;
    this._addSyncLog('开始同步...', 'info');

    try {
      const csrfToken = this._getCSRFToken();
      const syncHeaders = {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
      };

      // 1. 推送本地变更
      let pushResult = { results: [], serverMaxUsn: this._lastSyncUsn };
      if (this._pendingChanges.length > 0) {
        this._addSyncLog(`推送 ${this._pendingChanges.length} 条本地变更`, 'info');
        const pushController = new AbortController();
        const pushTimeout = setTimeout(() => pushController.abort(), 15000);
        const pushRes = await fetch(`${this._apiBase}/sync/push`, {
          method: 'POST',
          headers: syncHeaders,
          credentials: 'include',
          body: JSON.stringify({ changes: this._pendingChanges }),
          signal: pushController.signal
        });
        clearTimeout(pushTimeout);
        if (pushRes.ok) {
          pushResult = await pushRes.json();
          this._pendingChanges = [];
          localStorage.removeItem('journal_pending_changes');
          this._addSyncLog(`推送成功 (${pushResult.results?.length || 0} 条)`, 'success');
        } else if (pushRes.status === 403) {
          this._addSyncLog('推送被拒: CSRF 验证失败', 'error');
          this._consecutiveFailures++;
        } else {
          this._addSyncLog('推送失败', 'warning');
        }
      }

      // 2. 拉取服务端变更
      const pullController = new AbortController();
      const pullTimeout = setTimeout(() => pullController.abort(), 15000);
      const pullRes = await fetch(`${this._apiBase}/sync/pull`, {
        method: 'POST',
        headers: syncHeaders,
        credentials: 'include',
        body: JSON.stringify({ lastSyncUsn: this._lastSyncUsn }),
        signal: pullController.signal
      });
      clearTimeout(pullTimeout);

      if (pullRes.ok) {
        const pullResult = await pullRes.json();
        this._lastSyncUsn = pullResult.serverMaxUsn || this._lastSyncUsn;
        localStorage.setItem('journal_last_sync_usn', String(this._lastSyncUsn));

        if (pullResult.records?.length > 0) {
          this._addSyncLog(`拉取 ${pullResult.records.length} 条服务端变更`, 'info');
          await this._mergeServerChanges(pullResult.records);
          this._addSyncLog('合并完成', 'success');
        } else {
          this._addSyncLog('服务端无新变更', 'info');
        }
      } else if (pullRes.status === 401) {
        this._consecutiveFailures++;
      } else if (pullRes.status === 403) {
        this._addSyncLog('拉取被拒: CSRF 验证失败', 'error');
        this._consecutiveFailures++;
      } else {
        this._addSyncLog('拉取失败', 'warning');
        this._consecutiveFailures++;
      }

      // 连续失败阈值
      if (this._consecutiveFailures >= this._maxFailures) {
        this._addSyncLog('连续失败过多，暂停自动同步', 'error');
        this._stopAutoSync();
        this._showToast('云同步暂停，点击"云同步设置"可手动重试');
      }

      // 3. 同步心情数据
      await this._syncMoodToServer();

      if (this._consecutiveFailures < this._maxFailures) {
        const now = new Date().toISOString();
        localStorage.setItem('journal_last_sync_time', now);
        this._dispatchEvent('sync:complete');
        this._addSyncLog(`同步完成 | 待同步: ${this._pendingChanges.length} 条`, 'success');
      }

    } catch (e) {
      this._addSyncLog('同步异常: ' + e.message, 'error');
      this._consecutiveFailures++;
      if (this._consecutiveFailures >= this._maxFailures) {
        this._stopAutoSync();
        this._showToast('云同步异常，请检查网络连接');
      }
      this._dispatchEvent('sync:error', { message: 'sync_failed' });
    } finally {
      this._isSyncing = false;
    }
  },

  recordChange(action, data) {
    const existingIndex = this._pendingChanges.findIndex(c => c.id === data.id);
    if (existingIndex !== -1) {
      this._pendingChanges.splice(existingIndex, 1);
    }
    if (action === 'delete') {
      this._pendingChanges.push({ id: data.id, _deleted: true });
    } else {
      this._pendingChanges.push(data);
    }
    localStorage.setItem('journal_pending_changes', JSON.stringify(this._pendingChanges));
  },

  /**
   * 合并服务端变更到本地（接入 SyncMerge Vector Clock 冲突解决）
   * @private
   */
  async _mergeServerChanges(serverChanges) {
    if (!window.Store) return;

    const currentList = window.Store.getState('records.list') || [];
    const localMap = new Map(currentList.map(r => [r.id, r]));
    let merged = false;

    // v7.4.0: 使用 SyncMerge 做字段级冲突解决
    const useSyncMerge = typeof window.SyncMerge?.mergeRecords === 'function';

    for (const serverRecord of serverChanges) {
      if (serverRecord.deleted) {
        if (localMap.has(serverRecord.id)) {
          localMap.delete(serverRecord.id);
          merged = true;
        }
        continue;
      }

      const localRecord = localMap.get(serverRecord.id);
      if (!localRecord) {
        localMap.set(serverRecord.id, serverRecord);
        merged = true;
      } else {
        const serverUsn = serverRecord.usn || 0;
        const localUsn = localRecord.usn || 0;

        if (useSyncMerge && serverUsn > localUsn) {
          // 用 SyncMerge 做精细字段级合并（单条记录包装为数组）
          const result = await window.SyncMerge.mergeRecords([serverRecord], {
            strategy: 'field_merge'
          });
          // 从 Store 中取合并后的结果
          const updated = window.Store.getState('records.list').find(r => r.id === serverRecord.id);
          if (updated) {
            localMap.set(serverRecord.id, updated);
          } else {
            localMap.set(serverRecord.id, serverRecord);
          }
          merged = true;
        } else if (serverUsn > localUsn) {
          // 回退：简单 USN 比较
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

      // 写回 IndexedDB
      if (window.StorageBackend) {
        for (const serverRecord of serverChanges) {
          if (serverRecord.deleted) {
            await StorageBackend.delete(serverRecord.id);
          } else {
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
  async _syncMoodToServer() {
    if (!window.MoodService || !window.AuthPlugin?.isLoggedIn) return;

    try {
      // 从 MoodService 获取最近 30 天的心情记录
      const moodHistory = window.MoodService.getHistory?.(30);
      if (!moodHistory || moodHistory.length === 0) return;

      const csrfToken = this._getCSRFToken();
      const headers = {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${this._apiBase}/mood/sync`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ entries: moodHistory }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        this._addSyncLog('心情数据同步成功', 'success');
      }
    } catch (e) {
      this._addSyncLog('心情数据同步失败: ' + e.message, 'warning');
    }
  },

  _dispatchEvent(name, detail = null) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  },

  _updateSyncStatusUI() {
    const detail = document.getElementById('sync-status-detail');
    if (!detail) return;

    if (!window.AuthPlugin?.isLoggedIn) {
      detail.textContent = '请先登录查看同步状态';
      const timeDisplay = document.getElementById('last-sync-time-display');
      if (timeDisplay) timeDisplay.style.display = 'none';
      return;
    }

    const pending = this._pendingChanges?.length || 0;
    const lastSync = localStorage.getItem('journal_last_sync_usn') || '0';
    const syncingText = this._isSyncing ? ' | 同步中...' : '';
    detail.textContent = `已登录 | 待同步: ${pending} 条 | 最后同步 USN: ${lastSync}${syncingText}`;
    this._renderLastSyncTime();
  },

  _renderLastSyncTime() {
    const timeDisplay = document.getElementById('last-sync-time-display');
    const timeValue = document.getElementById('last-sync-time-value');
    if (!timeDisplay || !timeValue) return;

    const lastSyncTime = localStorage.getItem('journal_last_sync_time');
    if (!lastSyncTime) {
      timeDisplay.style.display = 'none';
      return;
    }

    timeDisplay.style.display = 'flex';
    const date = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    let timeStr;
    if (diffMin < 1) timeStr = '刚刚';
    else if (diffMin < 60) timeStr = `${diffMin} 分钟前`;
    else if (diffHr < 24) timeStr = `${diffHr} 小时前`;
    else if (diffDay < 7) timeStr = `${diffDay} 天前`;
    else timeStr = date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    timeValue.textContent = timeStr;
  },

  _showToast(msg) {
    if (window.UIComponents && window.UIComponents.Toast) {
      window.UIComponents.Toast.show(msg, { duration: 3000 });
    } else {
      const toast = document.getElementById('toast');
      if (toast) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
    }
  }
};

window.AutoSyncPlugin = AutoSyncPlugin;
}
