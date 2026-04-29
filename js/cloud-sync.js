/**
 * 万物手札 v4.0.0 - 云同步模块
 * 基于 GitHub Gist API + AES-GCM 端到端加密
 * 特性：完整加密、冲突解决、离线队列、自动重试
 */

const CloudSync = {
  config: {
    gistId: '',
    token: '',
    key: '',
    enabled: false,
    autoSync: true,
    syncInterval: 300000,
  },
  state: {
    isSyncing: false,
    lastSyncTime: null,
    error: null,
    queue: [],
  },
  _syncTimer: null,
  GIST_FILE: 'universal_journal_data.json',

  init() {
    this.loadConfig();
    if (this.config.enabled && this.config.autoSync) {
      this.startAutoSync();
    }
    window.addEventListener('online', () => this.flushQueue());
  },

  loadConfig() {
    try {
      const saved = localStorage.getItem('cloud_sync_config_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      }
    } catch (e) {
      console.error('加载同步配置失败:', e);
    }
  },

  saveConfig() {
    try {
      this.config.enabled = true;
      localStorage.setItem('cloud_sync_config_v4', JSON.stringify(this.config));
    } catch (e) {
      console.error('保存同步配置失败:', e);
    }
  },

  startAutoSync() {
    if (this._syncTimer) clearInterval(this._syncTimer);
    this._syncTimer = setInterval(() => {
      if (navigator.onLine && !this.state.isSyncing && this.config.enabled) {
        this.autoSync().catch(e => console.warn('自动同步失败:', e));
      }
    }, this.config.syncInterval);
  },

  stopAutoSync() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  },

  async autoSync() {
    if (!window.StorageBackend) return;
    try {
      const items = await StorageBackend.getAll();
      const encrypted = await this.encryptData(items);
      await this.uploadToGist(encrypted);
      this.state.lastSyncTime = new Date();
      console.log('✅ 自动同步成功');
    } catch (e) {
      console.error('自动同步失败:', e);
      this.state.queue.push({ type: 'auto_sync', timestamp: Date.now() });
    }
  },

  async flushQueue() {
    if (this.state.queue.length === 0) return;
    console.log(`尝试刷新 ${this.state.queue.length} 个待同步任务`);
    const queueCopy = [...this.state.queue];
    this.state.queue = [];
    for (const task of queueCopy) {
      if (task.type === 'auto_sync') {
        await this.autoSync();
      }
    }
  },

  /** 测试连接 */
  async testConnection() {
    if (!this.config.token) return { success: false, message: '请输入 GitHub Token' };
    try {
      const res = await fetch('https://api.github.com/gists', {
        headers: { 'Authorization': `token ${this.config.token}` }
      });
      if (res.ok) return { success: true, message: '连接成功' };
      if (res.status === 401) return { success: false, message: 'Token 无效或已过期' };
      return { success: false, message: `连接失败: ${res.status}` };
    } catch (e) {
      return { success: false, message: '网络错误，请检查连接' };
    }
  },

  /** 获取状态文本 */
  getStatusText() {
    if (this.state.isSyncing) return '同步中...';
    if (this.state.error) return `错误: ${this.state.error}`;
    if (this.state.lastSyncTime) {
      return `上次同步: ${this.state.lastSyncTime.toLocaleString('zh-CN')}`;
    }
    return '尚未同步';
  },

  // ==================== 加密/解密 ====================

  async getKeyMaterial() {
    const enc = new TextEncoder();
    return window.crypto.subtle.importKey('raw', enc.encode(this.config.key), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
  },

  async getKey(salt) {
    const keyMaterial = await this.getKeyMaterial();
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encryptData(items) {
    if (!this.config.key || this.config.key.length < 6) {
      throw new Error('加密密钥至少 6 位');
    }
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.getKey(salt);
    const data = JSON.stringify({ items, version: '4.0.0', timestamp: Date.now() });
    const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data));
    // 组合：salt(16) + iv(12) + ciphertext
    const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, 16);
    result.set(new Uint8Array(encrypted), 28);
    return btoa(String.fromCharCode(...result));
  },

  async decryptData(encryptedBase64) {
    if (!this.config.key || this.config.key.length < 6) {
      throw new Error('解密密钥不匹配');
    }
    try {
      const data = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      if (data.length < 28) throw new Error('数据格式错误');
      const salt = data.slice(0, 16);
      const iv = data.slice(16, 28);
      const ciphertext = data.slice(28);
      const key = await this.getKey(salt);
      const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
    } catch (e) {
      throw new Error('解密失败，请检查密钥是否正确');
    }
  },

  // ==================== Gist 操作 ====================

  async uploadToGist(encryptedContent) {
    const url = this.config.gistId
      ? `https://api.github.com/gists/${this.config.gistId}`
      : 'https://api.github.com/gists';

    const method = this.config.gistId ? 'PATCH' : 'POST';

    const body = {
      description: `Universal Journal Backup - ${new Date().toISOString()}`,
      public: false,
      files: { [this.GIST_FILE]: { content: encryptedContent } }
    };

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `上传失败: ${res.status}`);
    }

    const gist = await res.json();
    if (!this.config.gistId) {
      this.config.gistId = gist.id;
      this.saveConfig();
    }
    return gist;
  },

  async downloadFromGist() {
    if (!this.config.gistId) throw new Error('未配置 Gist ID');
    const url = `https://api.github.com/gists/${this.config.gistId}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `token ${this.config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!res.ok) throw new Error(`下载失败: ${res.status}`);
    const gist = await res.json();
    return gist.files[this.GIST_FILE]?.content || null;
  },

  // ==================== 公开接口 ====================

  /** 上传：加密并推送到云端 */
  async upload(items, password) {
    if (password) this.config.key = password;
    try {
      const encrypted = await this.encryptData(items);
      await this.uploadToGist(encrypted);
      this.state.lastSyncTime = new Date();
      return { success: true, message: `✅ 已上传 ${items.length} 条记录到云端` };
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  /** 下载：从云端获取并解密 */
  async download(localItems, password) {
    if (password) this.config.key = password;
    try {
      const encrypted = await this.downloadFromGist();
      if (!encrypted) return { success: false, message: '云端无数据' };
      const decrypted = await this.decryptData(encrypted);
      const cloudItems = decrypted.items || [];
      // 合并策略：云端优先（简单 Last-Write-Wins）
      const merged = this.mergeItems(localItems, cloudItems);
      return { success: true, items: merged, message: `✅ 已从云端下载 ${cloudItems.length} 条记录` };
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  /** 双向同步 */
  async syncBidirectional(localItems, password) {
    if (password) this.config.key = password;
    try {
      // 1. 下载云端
      const encrypted = await this.downloadFromGist();
      if (!encrypted) {
        // 云端无数据，直接上传本地
        return await this.upload(localItems, password);
      }
      const decrypted = await this.decryptData(encrypted);
      const cloudItems = decrypted.items || [];
      // 2. 合并
      const merged = this.mergeItems(localItems, cloudItems);
      // 3. 加密并上传
      const reEncrypted = await this.encryptData(merged);
      await this.uploadToGist(reEncrypted);
      this.state.lastSyncTime = new Date();
      return { success: true, items: merged, message: `✅ 双向同步完成，共 ${merged.length} 条记录` };
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  /** 合并数据（Last-Write-Wins based on updatedAt） */
  mergeItems(localItems, cloudItems) {
    const map = new Map();
    // 先放入本地
    localItems.forEach(item => map.set(item.id, item));
    // 云端覆盖（如果云端更新）
    cloudItems.forEach(cloudItem => {
      const local = map.get(cloudItem.id);
      if (!local || new Date(cloudItem.updatedAt) > new Date(local.updatedAt)) {
        map.set(cloudItem.id, cloudItem);
      }
    });
    // 新增：云端有但本地没有的
    cloudItems.forEach(cloudItem => {
      if (!map.has(cloudItem.id)) {
        map.set(cloudItem.id, cloudItem);
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
};

window.CloudSync = CloudSync;
