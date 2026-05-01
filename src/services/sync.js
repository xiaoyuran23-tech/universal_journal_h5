/**
 * SyncService - 云同步服务 (v6.4.0 重构版)
 * 使用 SyncMerge 共享合并模块 + Vector Clock
 * 状态机简化为: idle | syncing | error
 */

class SyncService {
  static CONFIG_KEY = 'journal_sync_config';
  static TOKEN_KEY = 'journal_sync_token_enc';

  static _status = 'idle';
  static _lastSyncTime = null;
  static _listeners = [];

  static getStatus() { return this._status; }
  static getLastSyncTime() { return this._lastSyncTime; }

  static subscribe(callback) {
    this._listeners.push(callback);
    return () => { this._listeners = this._listeners.filter(l => l !== callback); };
  }

  static _notify() { this._listeners.forEach(cb => cb(this._status)); }

  static _setStatus(status) {
    this._status = status;
    this._notify();
  }

  static getConfig() {
    try {
      const saved = localStorage.getItem(this.CONFIG_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }

  static async saveConfig(config) {
    const existing = this.getConfig() || {};
    const merged = { ...existing, ...config };
    if (config.token) {
      await this._encryptToken(config.token);
      delete merged.token;
    }
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(merged));
  }

  static getToken() {
    const encrypted = localStorage.getItem(this.TOKEN_KEY);
    if (!encrypted) return null;
    try {
      const deviceKey = localStorage.getItem('_uj_device_key');
      if (!deviceKey) return null;
      return this._decryptToken(encrypted, deviceKey);
    } catch (e) {
      console.warn('[SyncService] Token 解密失败:', e);
      return null;
    }
  }

  static isConfigured() {
    const config = this.getConfig();
    const token = this.getToken();
    return !!(config && config.gistId && token);
  }

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
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(token));
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    localStorage.setItem(this.TOKEN_KEY, btoa(String.fromCharCode(...combined)));
  }

  static _decryptToken(encrypted, deviceKey) {
    return new Promise((resolve, reject) => {
      if (encrypted.startsWith('plaintext:')) { resolve(encrypted.slice(10)); return; }
      const data = new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)));
      const keyBytes = new Uint8Array(atob(deviceKey).split('').map(c => c.charCodeAt(0)));
      const iv = data.slice(0, 12);
      const ciphertext = data.slice(12);
      crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']).then(async (key) => {
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        resolve(new TextDecoder().decode(plaintext));
      }).catch(reject);
    });
  }

  static async upload(options = {}) {
    if (!this.isConfigured()) return { success: false, error: '请先配置同步信息' };
    if (this._status !== 'idle') return { success: false, error: '同步正在进行中' };

    this._setStatus('syncing');

    try {
      const config = this.getConfig();
      const token = this.getToken();
      const records = await SyncMerge._getAllRecords();

      const payload = {
        version: '6.4.0',
        timestamp: Date.now(),
        count: records.length,
        data: records
      };

      let content;
      if (config.encryptionKey && window.CryptoService) {
        content = await CryptoService.encrypt(JSON.stringify(payload), config.encryptionKey);
      } else {
        content = JSON.stringify(payload, null, 2);
      }

      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: `万物手札备份 - ${new Date().toISOString()}`,
          public: false,
          files: { 'journal_backup.json': { content } }
        })
      });

      if (!response.ok) throw new Error(`上传失败: ${response.status} - ${await response.text()}`);

      this._lastSyncTime = new Date();
      this._setStatus('idle');
      return { success: true };
    } catch (error) {
      console.error('[SyncService] Upload failed:', error);
      this._setStatus('error');
      return { success: false, error: error.message };
    }
  }

  static async download(options = {}) {
    if (!this.isConfigured()) return { success: false, error: '请先配置同步信息' };
    if (this._status !== 'idle') return { success: false, error: '同步正在进行中' };

    this._setStatus('syncing');

    try {
      const config = this.getConfig();
      const token = this.getToken();

      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`下载失败: ${response.status}`);

      const gist = await response.json();
      let fileContent = gist.files['journal_backup.json']?.content;
      if (!fileContent) throw new Error('备份文件不存在');

      let payload;
      if (config.encryptionKey && window.CryptoService) {
        payload = JSON.parse(await CryptoService.decrypt(fileContent, config.encryptionKey));
      } else {
        payload = JSON.parse(fileContent);
      }

      const result = await SyncMerge.mergeRecords(payload.data || [], options.mergeStrategy || 'field_merge');

      this._lastSyncTime = new Date();
      this._setStatus('idle');
      return { success: true, merged: result.merged, conflicts: result.conflicts };
    } catch (error) {
      console.error('[SyncService] Download failed:', error);
      this._setStatus('error');
      return { success: false, error: error.message };
    }
  }

  static async testConnection() {
    if (!this.isConfigured()) return { success: false, error: '请先配置同步信息' };
    try {
      const config = this.getConfig();
      const token = this.getToken();
      const response = await fetch(`https://api.github.com/gists/${config.gistId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return { success: response.ok, error: response.ok ? null : `连接失败: ${response.status}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async createBackupGist() {
    if (!this.isConfigured()) return { success: false, error: '请先配置 Token' };
    try {
      const config = this.getConfig();
      const token = this.getToken();
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: '万物手札备份 (自动创建)',
          public: false,
          files: { 'journal_backup.json': { content: '{"version":"6.4.0","data":[]}' } }
        })
      });
      if (!response.ok) throw new Error(`创建失败: ${response.status}`);
      const gist = await response.json();
      await this.saveConfig({ gistId: gist.id });
      return { success: true, gistId: gist.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

window.SyncService = SyncService;
console.log('[SyncService] 同步服务已加载 (v6.4.0 重构)');
