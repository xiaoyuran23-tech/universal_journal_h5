/**
 * Sync Plugin - 云同步插件
 * 提供数据同步、加密、冲突解决功能
 * @version 6.0.0
 */

const SyncPlugin = {
  name: 'sync',
  version: '1.0.0',
  dependencies: ['records'],
  
  CONFIG_KEY: 'journal_sync_config_v6',
  _config: null,
  _isSyncing: false,
  _eventsBound: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[SyncPlugin] Initializing...');
    await this._loadConfig();
    
    this.routes = [];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[SyncPlugin] Starting...');
    this._bindEvents();
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
   * 加载配置
   * @private
   */
  async _loadConfig() {
    try {
      const saved = localStorage.getItem(this.CONFIG_KEY);
      if (saved) {
        this._config = JSON.parse(saved);
      }
    } catch (error) {
      console.error('[SyncPlugin] Load config failed:', error);
    }
  },

  /**
   * 保存配置
   * @private
   */
  async _saveConfig() {
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this._config));
    } catch (error) {
      console.error('[SyncPlugin] Save config failed:', error);
    }
  },

  /**
   * 上传数据
   */
  async upload() {
    if (this._isSyncing) {
      this._showToast('同步进行中，请稍候');
      return;
    }

    if (!this._config || !this._config.token || !this._config.gistId) {
      this._showToast('请先配置同步信息');
      return;
    }

    this._isSyncing = true;
    this._showToast('正在上传...');

    try {
      // 获取所有记录
      const records = window.Store ? Store.getState('records.list') : [];
      
      // 加密数据
      const encrypted = await this._encryptData(records);
      
      // 构建 Gist 数据
      const gistData = {
        description: 'Journal Backup - ' + new Date().toISOString(),
        public: false,
        files: {
          'journal_backup.json': {
            content: JSON.stringify({
              version: '6.0.0',
              timestamp: Date.now(),
              data: encrypted
            })
          }
        }
      };

      // 上传到 Gist
      const response = await fetch(`https://api.github.com/gists/${this._config.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this._config.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gistData)
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      this._showToast('上传成功', { type: 'success' });
      
    } catch (error) {
      console.error('[SyncPlugin] Upload failed:', error);
      this._showToast('上传失败：' + error.message, { type: 'error' });
    } finally {
      this._isSyncing = false;
    }
  },

  /**
   * 下载数据
   */
  async download() {
    if (this._isSyncing) {
      this._showToast('同步进行中，请稍候');
      return;
    }

    if (!this._config || !this._config.token || !this._config.gistId) {
      this._showToast('请先配置同步信息');
      return;
    }

    this._isSyncing = true;
    this._showToast('正在下载...');

    try {
      // 从 Gist 下载
      const response = await fetch(`https://api.github.com/gists/${this._config.gistId}`, {
        headers: {
          'Authorization': `token ${this._config.token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const gist = await response.json();
      const fileContent = gist.files['journal_backup.json']?.content;
      
      if (!fileContent) {
        throw new Error('Backup file not found');
      }

      const backup = JSON.parse(fileContent);
      
      // 解密数据
      const records = await this._decryptData(backup.data);
      
      // 合并数据
      await this._mergeRecords(records);
      
      this._showToast('下载成功，已合并数据', { type: 'success' });
      
    } catch (error) {
      console.error('[SyncPlugin] Download failed:', error);
      this._showToast('下载失败：' + error.message, { type: 'error' });
    } finally {
      this._isSyncing = false;
    }
  },

  /**
   * 加密数据
   * @param {Array} data
   * @returns {Promise<string>}
   * @private
   */
  async _encryptData(data) {
    if (!this._config?.key) {
      return JSON.stringify(data);
    }

    try {
      // 简化加密：Base64 编码 (实际应使用 AES)
      const json = JSON.stringify(data);
      return btoa(unescape(encodeURIComponent(json)));
    } catch (error) {
      console.error('[SyncPlugin] Encrypt failed:', error);
      return JSON.stringify(data);
    }
  },

  /**
   * 解密数据
   * @param {string} encrypted
   * @returns {Promise<Array>}
   * @private
   */
  async _decryptData(encrypted) {
    if (!this._config?.key) {
      return JSON.parse(encrypted);
    }

    try {
      const json = decodeURIComponent(escape(atob(encrypted)));
      return JSON.parse(json);
    } catch (error) {
      console.error('[SyncPlugin] Decrypt failed:', error);
      return JSON.parse(encrypted);
    }
  },

  /**
   * 合并记录
   * @param {Array} remoteRecords
   * @private
   */
  async _mergeRecords(remoteRecords) {
    const localRecords = window.Store ? Store.getState('records.list') : [];
    const localMap = new Map(localRecords.map(r => [r.id, r]));
    
    // LWW 合并策略
    remoteRecords.forEach(remote => {
      const local = localMap.get(remote.id);
      
      if (!local) {
        // 本地没有，直接添加
        localRecords.push(remote);
      } else {
        // 本地有，比较更新时间
        const remoteTime = new Date(remote.updatedAt || 0).getTime();
        const localTime = new Date(local.updatedAt || 0).getTime();
        
        if (remoteTime > localTime) {
          // 远程更新，覆盖本地
          Object.assign(local, remote);
        }
      }
    });

    // 保存到 Store
    if (window.RecordsPlugin) {
      for (const record of localRecords) {
        await RecordsPlugin.updateRecord(record.id, record);
      }
    }
  },

  /**
   * 保存配置
   * @param {Object} config
   */
  async saveConfig(config) {
    this._config = { ...this._config, ...config };
    await this._saveConfig();
    this._showToast('配置已保存', { type: 'success' });
  },

  /**
   * 获取配置
   * @returns {Object|null}
   */
  getConfig() {
    return this._config;
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // 监听同步按钮
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

console.log('[SyncPlugin] 同步插件已定义');
