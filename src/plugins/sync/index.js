/**
 * Sync Plugin - 云同步插件 (UI 层)
 * 提供同步操作的 UI 交互，底层委托 SyncService
 * @version 6.0.0
 */

// 幂等加载保护
if (!window.SyncPlugin) {
const SyncPlugin = {
  name: 'sync',
  version: '1.0.0',
  dependencies: ['records'],
  
  _eventsBound: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[SyncPlugin] Initializing (delegating to SyncService)...');
    this.routes = [];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[SyncPlugin] Starting...');
    this._bindEvents();
    this._bindSyncService();
  },

  /**
   * 停止插件
   */
  stop() {
    console.log('[SyncPlugin] Stopping...');
    this._eventsBound = false;
  },

  /**
   * 路由定义
   */
  routes: [],

  /**
   * Actions
   */
  actions: {},

  /**
   * 上传数据
   */
  async upload() {
    if (!window.SyncService) {
      this._showToast('同步服务不可用', { type: 'error' });
      return;
    }

    this._showToast('正在上传...');
    const result = await SyncService.upload();
    
    if (result.success) {
      this._showToast('上传成功', { type: 'success' });
    } else {
      this._showToast(result.error || '上传失败', { type: 'error' });
    }
  },

  /**
   * 下载数据
   */
  async download() {
    if (!window.SyncService) {
      this._showToast('同步服务不可用', { type: 'error' });
      return;
    }

    this._showToast('正在下载...');
    const result = await SyncService.download();
    
    if (result.success) {
      this._showToast(`下载成功，合并 ${result.merged || 0} 条记录`, { type: 'success' });
    } else {
      this._showToast(result.error || '下载失败', { type: 'error' });
    }
  },

  /**
   * 配置同步
   * @param {Object} config - { token, gistId, encryptionKey }
   */
  async configure(config) {
    if (window.SyncService) {
      SyncService.saveConfig(config);
      this._showToast('配置已保存', { type: 'success' });
    }
  },

  /**
   * 测试连接
   */
  async testConnection() {
    if (!window.SyncService) {
      this._showToast('同步服务不可用', { type: 'error' });
      return;
    }

    this._showToast('正在测试连接...');
    const result = await SyncService.testConnection();
    
    if (result.success) {
      this._showToast('连接成功', { type: 'success' });
    } else {
      this._showToast(result.error, { type: 'error' });
    }
  },

  /**
   * 绑定同步服务状态变化
   * @private
   */
  _bindSyncService() {
    if (!window.SyncService) return;

    SyncService.subscribe((status) => {
      const STATUS_MAP = {
        idle: '',
        uploading: '正在上传...',
        downloading: '正在下载...',
        merging: '正在合并...',
        success: '同步完成',
        error: '同步失败'
      };

      const message = STATUS_MAP[status];
      if (message && status !== 'idle') {
        // 更新同步按钮状态
        const syncBtn = document.querySelector('[data-sync-action]');
        if (syncBtn) {
          syncBtn.disabled = status !== 'idle' && status !== 'success' && status !== 'error';
        }
      }
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
        
        switch (action) {
          case 'upload':
            this.upload();
            break;
          case 'download':
            this.download();
            break;
          case 'test-connection':
            this.testConnection();
            break;
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

console.log('[SyncPlugin] 同步插件已定义 (委托 SyncService)');
} else {
  console.log('[SyncPlugin] 已存在，跳过加载');
}
