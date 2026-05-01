/**
 * SyncService - 云同步服务
 * 提供数据上传、下载、冲突解决、状态管理
 * @version 6.1.0
 */

class SyncService {
  static CONFIG_KEY = 'journal_sync_config';
  static TOKEN_KEY = 'journal_sync_token_enc'; // 加密后的 Token
  static STATUS = {
    IDLE: 'idle',
    UPLOADING: 'uploading',
    DOWNLOADING: 'downloading',
    MERGING: 'merging',
    SUCCESS: 'success',
    ERROR: 'error'
  };

  static _status = SyncService.STATUS.IDLE;
  static _lastSyncTime = null;
  static _listeners = [];

  /**
   * 获取同步状态
   */
  static getStatus() {
    return this._status;
  }

  /**
   * 获取上次同步时间
   */
  static getLastSyncTime() {
    return this._lastSyncTime;
  }

  /**
   * 订阅同步状态变化
   * @param {Function} callback
   */
  static subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(l => l !== callback);
    };
  }

  /**
   * 通知监听器
   * @private
   */
  static _notify() {
    this._listeners.forEach(cb => cb(this._status));
  }

  /**
   * 设置状态
   * @private
   */
  static _setStatus(status) {
    this._status = status;
    this._notify();
  }

  /**
   * 获取同步配置
   */
  static getConfig() {
    try {
      const saved = localStorage.getItem(this.CONFIG_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * 保存同步配置
   * Token 单独加密存储，其他配置明文存储
   */
  static async saveConfig(config) {
    const existing = this.getConfig() || {};
    const merged = { ...existing, ...config };

    // 如果提供了 token，异步加密后单独存储
    if (config.token) {
      await this._encryptToken(config.token);
      delete merged.token; // 从明文配置中移除 token
    }

    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(merged));
  }

  /**
   * 获取存储的 Token (自动解密)
   */
  static getToken() {
    const encrypted = localStorage.getItem(this.TOKEN_KEY);
    if (!encrypted) return null;

    try {
      const deviceKey = localStorage.getItem('_uj_device_key');
      if (!deviceKey) return null;
      // deviceKey 是 Base64 编码的 AES-GCM 密钥
      return this._decryptToken(encrypted, deviceKey);
    } catch (e) {
      console.warn('[SyncService] Token 解密失败:', e);
      return null;
    }
  }

  /**
   * 检查是否已配置
   */
  static isConfigured() {
    const config = this.getConfig();
    const token = this.getToken();
    return !!(config && config.gistId && token);
  }

  /**
   * 加密 Token 并异步存储
   * @param {string} token - GitHub Token
   * @private
   */
  static async _encryptToken(token) {
    let deviceKey = localStorage.getItem('_uj_device_key');
    if (!deviceKey) {
      const rawKey = new Uint8Array(32);
      crypto.getRandomValues(rawKey);
      deviceKey = btoa(String.fromCharCode(...rawKey));
      localStorage.setItem('_uj_device_key', deviceKey);
    }

    const keyBytes = new Uint8Array(atob(deviceKey).split('').map(c => c.charCodeAt(0)));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(token)
    );
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    localStorage.setItem(this.TOKEN_KEY, btoa(String.fromCharCode(...combined)));
  }

  /**
   * 解密 Token
   * @param {string} encrypted - Base64 编码的密文
   * @param {string} deviceKey - Base64 编码的设备密钥
   * @returns {string}
   * @private
   */
  static _decryptToken(encrypted, deviceKey) {
    return new Promise((resolve, reject) => {
      // 检查是否为降级明文
      if (encrypted.startsWith('plaintext:')) {
        resolve(encrypted.slice(10));
        return;
      }

      const data = new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)));
      const keyBytes = new Uint8Array(atob(deviceKey).split('').map(c => c.charCodeAt(0)));
      const iv = data.slice(0, 12);
      const ciphertext = data.slice(12);

      crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']).then(async (key) => {
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          key,
          ciphertext
        );
        const decoder = new TextDecoder();
        resolve(decoder.decode(plaintext));
      }).catch(reject);
    });
  }

  /**
   * 上传数据到云端
   * @param {Object} options
   * @param {string} [options.provider] - 'github' (默认)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async upload(options = {}) {
    if (!this.isConfigured()) {
      return { success: false, error: '请先配置同步信息' };
    }

    if (this._status !== this.STATUS.IDLE) {
      return { success: false, error: '同步正在进行中' };
    }

    this._setStatus(this.STATUS.UPLOADING);

    try {
      const config = this.getConfig();
      const token = this.getToken();
      const records = await this._getAllRecords();
      
      // 构建数据包
      const payload = {
        version: '6.0.0',
        timestamp: Date.now(),
        count: records.length,
        data: records
      };

      // 加密 (如果配置了密钥)
      let content;
      if (config.encryptionKey) {
        if (window.CryptoService) {
          content = await CryptoService.encrypt(JSON.stringify(payload), config.encryptionKey);
        } else {
          content = btoa(JSON.stringify(payload));
        }
      } else {
        content = JSON.stringify(payload, null, 2);
      }

      // 上传到 GitHub Gist
      const gistData = {
        description: `万物手札备份 - ${new Date().toISOString()}`,
        public: false,
        files: {
          'journal_backup.json': { content }
        }
      };

      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gistData)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`上传失败: ${response.status} - ${errorBody}`);
      }

      this._lastSyncTime = new Date();
      this._setStatus(this.STATUS.SUCCESS);
      
      return { success: true };

    } catch (error) {
      console.error('[SyncService] Upload failed:', error);
      this._setStatus(this.STATUS.ERROR);
      return { success: false, error: error.message };
    } finally {
      // 3秒后重置状态
      setTimeout(() => {
        if (this._status === this.STATUS.SUCCESS || this._status === this.STATUS.ERROR) {
          this._setStatus(this.STATUS.IDLE);
        }
      }, 3000);
    }
  }

  /**
   * 从云端下载数据
   * @param {Object} options
   * @param {string} [options.mergeStrategy] - 'lww' | 'remote_wins' | 'local_wins' (默认 lww)
   * @returns {Promise<{success: boolean, merged?: number, error?: string}>}
   */
  static async download(options = {}) {
    const { mergeStrategy = 'lww' } = options;

    if (!this.isConfigured()) {
      return { success: false, error: '请先配置同步信息' };
    }

    if (this._status !== this.STATUS.IDLE) {
      return { success: false, error: '同步正在进行中' };
    }

    this._setStatus(this.STATUS.DOWNLOADING);

    try {
      const config = this.getConfig();
      const token = this.getToken();

      // 从 GitHub Gist 下载
      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }

      const gist = await response.json();
      let fileContent = gist.files['journal_backup.json']?.content;

      if (!fileContent) {
        throw new Error('备份文件不存在');
      }

      // 解密
      let payload;
      if (config.encryptionKey) {
        if (window.CryptoService) {
          const decrypted = await CryptoService.decrypt(fileContent, config.encryptionKey);
          payload = JSON.parse(decrypted);
        } else {
          payload = JSON.parse(atob(fileContent));
        }
      } else {
        payload = JSON.parse(fileContent);
      }

      // 合并数据
      this._setStatus(this.STATUS.MERGING);
      const result = await this._mergeRecords(payload.data || [], mergeStrategy);

      this._lastSyncTime = new Date();
      this._setStatus(this.STATUS.SUCCESS);

      return { success: true, merged: result.merged };

    } catch (error) {
      console.error('[SyncService] Download failed:', error);
      this._setStatus(this.STATUS.ERROR);
      return { success: false, error: error.message };
    } finally {
      setTimeout(() => {
        if (this._status === this.STATUS.SUCCESS || this._status === this.STATUS.ERROR) {
          this._setStatus(this.STATUS.IDLE);
        }
      }, 3000);
    }
  }

  /**
   * 测试连接
   */
  static async testConnection() {
    if (!this.isConfigured()) {
      return { success: false, error: '请先配置同步信息' };
    }

    try {
      const config = this.getConfig();
      const token = this.getToken();
      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return {
        success: response.ok,
        error: response.ok ? null : `连接失败: ${response.status}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取所有记录
   * @private
   */
  static async _getAllRecords() {
    // 优先从 StorageService 获取
    if (window.StorageService && StorageService.getAll) {
      return await StorageService.getAll();
    }
    // 回退到 Store
    if (window.Store) {
      return window.Store.getState('records.list') || [];
    }
    return [];
  }

  /**
   * 合并记录
   * @param {Array} remoteRecords
   * @param {string} strategy
   * @returns {Promise<{merged: number}>}
   * @private
   */
  static async _mergeRecords(remoteRecords, strategy) {
    const localRecords = await this._getAllRecords();
    const localMap = new Map(localRecords.map(r => [r.id, r]));
    let mergedCount = 0;

    for (const remote of remoteRecords) {
      const local = localMap.get(remote.id);

      if (!local) {
        // 本地不存在，直接添加
        await this._saveRecord(remote);
        mergedCount++;
      } else {
        const remoteTime = new Date(remote.updatedAt || 0).getTime();
        const localTime = new Date(local.updatedAt || 0).getTime();

        let winner;
        switch (strategy) {
          case 'remote_wins':
            winner = remote;
            break;
          case 'local_wins':
            winner = local;
            break;
          case 'lww':
          default:
            winner = remoteTime > localTime ? remote : local;
            break;
        }

        if (winner !== local) {
          await this._saveRecord(winner);
          mergedCount++;
        }
      }
    }

    return { merged: mergedCount };
  }

  /**
   * 保存单条记录
   * @private
   */
  static async _saveRecord(record) {
    if (window.StorageService && StorageService.put) {
      await StorageService.put(record);
    } else if (window.Store) {
      window.Store.dispatch({ type: 'records/update', id: record.id, payload: record });
    }
  }

  /**
   * 创建备份 Gist (首次配置)
   */
  static async createBackupGist() {
    if (!this.isConfigured()) {
      return { success: false, error: '请先配置 Token' };
    }

    try {
      const config = this.getConfig();
      const token = this.getToken();
      const gistData = {
        description: '万物手札备份 (自动创建)',
        public: false,
        files: {
          'journal_backup.json': { content: '{"version":"6.0.0","data":[]}' }
        }
      };

      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gistData)
      });

      if (!response.ok) {
        throw new Error(`创建失败: ${response.status}`);
      }

      const gist = await response.json();
      this.saveConfig({ gistId: gist.id });

      return { success: true, gistId: gist.id };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// 全局暴露
window.SyncService = SyncService;

console.log('[SyncService] 同步服务已加载');
