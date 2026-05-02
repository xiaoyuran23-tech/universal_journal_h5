/**
 * Sync Plugin - 云同步插件 (UI 层)
 * 提供同步操作的 UI 交互
 * v7.0.3: 移除 Gist 流程，改用 AutoSyncPlugin 后端 API 同步
 * @version 7.0.3
 */

// 幂等加载保护
if (!window.SyncPlugin) {
const SyncPlugin = {
  name: 'sync',
  version: '1.1.0',
  dependencies: ['records'],

  _eventsBound: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[SyncPlugin] Initializing (delegating to AutoSyncPlugin)...');
    this.routes = [];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[SyncPlugin] Starting...');
    this._bindEvents();
    this._bindAutoSync();
  },

  stop() {
    console.log('[SyncPlugin] Stopping...');
    this._eventsBound = false;
  },

  routes: [],
  actions: {},

  /**
   * 手动触发一次完整同步
   */
  async syncNow() {
    if (!window.AutoSyncPlugin) {
      this._showToast('自动同步服务不可用', { type: 'error' });
      return;
    }
    if (!window.AuthPlugin?.isLoggedIn) {
      this._showToast('请先登录', { type: 'error' });
      return;
    }

    this._showToast('正在同步...');
    try {
      await AutoSyncPlugin._fullSync();
      this._showToast('同步完成', { type: 'success' });
    } catch (e) {
      this._showToast('同步失败: ' + e.message, { type: 'error' });
    }
  },

  /**
   * 绑定 AutoSync 状态变化
   * @private
   */
  _bindAutoSync() {
    if (!window.AutoSyncPlugin) return;

    document.addEventListener('sync:complete', () => {
      this._showToast('云同步完成', { type: 'success' });
    });

    document.addEventListener('sync:error', (e) => {
      this._showToast('同步失败: ' + e.detail, { type: 'error' });
    });
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-sync-action]');
      if (target) {
        const action = target.dataset.syncAction;
        if (action === 'sync-now') {
          this.syncNow();
        }
      }
    });
  },

  /**
   * 显示 Toast
   * @private
   */
  _showToast(message, options = {}) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(message, { duration: 3000, ...options });
    } else if (window.App) {
      App.showToast(message);
    }
  }
};

// 全局暴露
window.SyncPlugin = SyncPlugin;

console.log('[SyncPlugin] 同步插件已加载 (v7.0.3, 委托 AutoSyncPlugin)');
} else {
  console.log('[SyncPlugin] 已存在，跳过加载');
}
