/**
 * 万物手札 - 云端同步模块 v2
 * 基于 GitHub Gist + 客户端零知识加密
 * 支持：增量同步、冲突处理、同步日志
 */

const CloudSync = {
  STORAGE_KEY: 'universal_journal_cloud',
  
  config: {
    token: '',
    gistId: '',
    password: '',
    enabled: false,
    lastSync: null,
    syncOnStart: true,
    useIndexedDB: true,
    conflictStrategy: 'newer' // 'manual' | 'local' | 'remote' | 'newer'
  },

  // ========== 加密模块 ==========
  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encrypt(data, password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);
    const plaintext = JSON.stringify(data);
    const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
    return { version: '1.0', salt: this.buf2hex(salt), iv: this.buf2hex(iv), data: this.buf2hex(new Uint8Array(encryptedBuffer)) };
  },

  async decrypt(cipher, password) {
    const decoder = new TextDecoder();
    const salt = this.hex2buf(cipher.salt);
    const iv = this.hex2buf(cipher.iv);
    const key = await this.deriveKey(password, salt);
    const encryptedBuffer = this.hex2buf(cipher.data);
    const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedBuffer);
    return JSON.parse(decoder.decode(decryptedBuffer));
  },

  buf2hex(buffer) { return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''); },
  hex2buf(hex) { const bytes = new Uint8Array(hex.length / 2); for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16); return bytes; },

  // ========== 配置管理 ==========
  loadConfig() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed, password: '' };
      }
    } catch (e) { console.warn('加载云同步配置失败:', e); }
  },

  saveConfig() {
    const toSave = { ...this.config };
    delete toSave.password;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
  },

  // ========== GitHub Gist API ==========
  async pushToGist(content) {
    const { token, gistId } = this.config;
    const body = { description: '📦 万物手札 云端同步数据（已加密）', public: false, files: { 'journal.sync.json': { content: JSON.stringify(content) } } };
    const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'UniversalJournal-H5' }, body: JSON.stringify(body) });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.message || `Gist API 错误：${response.status}`); }
    const result = await response.json();
    this.config.gistId = result.id;
    this.saveConfig();
    return result;
  },

  async pullFromGist() {
    const { token, gistId } = this.config;
    if (!gistId) throw new Error('未找到同步 Gist，请先执行上传');
    const response = await fetch(`https://api.github.com/gists/${gistId}`, { headers: { 'Authorization': `token ${token}`, 'User-Agent': 'UniversalJournal-H5' } });
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.message || `Gist 拉取失败：${response.status}`); }
    const gist = await response.json();
    const file = gist.files['journal.sync.json'];
    if (!file) throw new Error('Gist 中未找到同步数据文件');
    return JSON.parse(file.content);
  },

  // ========== 同步核心 ==========
  async upload(items, password) {
    const startTime = Date.now();
    try {
      const payload = { items, metadata: { app: 'universal_journal', version: '2.0', syncedAt: new Date().toISOString(), recordCount: items.length } };
      const encrypted = await this.encrypt(payload, password);
      await this.pushToGist(encrypted);
      this.config.enabled = true;
      this.config.lastSync = new Date().toISOString();
      this.saveConfig();
      await this.logSync('upload', true, '上传完成', startTime, { count: items.length });
      return { success: true, message: `已上传 ${items.length} 条记录到云端`, timestamp: this.config.lastSync };
    } catch (e) {
      await this.logSync('upload', false, e.message, startTime);
      return { success: false, message: `上传失败：${e.message}` };
    }
  },

  async download(localItems, password) {
    const startTime = Date.now();
    try {
      const encrypted = await this.pullFromGist();
      let remotePayload;
      try { remotePayload = await this.decrypt(encrypted, password); }
      catch (e) { await this.logSync('download', false, '解密失败', startTime); return { success: false, message: '解密失败：密码错误或数据已损坏' }; }
      
      const remoteItems = remotePayload.items || [];
      const { merged, conflicts } = this.mergeItems(localItems, remoteItems);
      this.config.lastSync = new Date().toISOString();
      this.saveConfig();
      await this.logSync('download', true, '下载完成', startTime, { remoteCount: remoteItems.length, localCount: localItems.length, mergedCount: merged.length, conflictCount: conflicts.length });
      return { success: true, items: merged, conflicts, message: `同步完成：云端 ${remoteItems.length} 条，本地 ${localItems.length} 条，合并后 ${merged.length} 条，冲突 ${conflicts.length} 个`, remoteCount: remoteItems.length, localCount: localItems.length, mergedCount: merged.length, conflictCount: conflicts.length };
    } catch (e) {
      await this.logSync('download', false, e.message, startTime);
      return { success: false, message: `下载失败：${e.message}` };
    }
  },

  mergeItems(localItems, remoteItems) {
    const map = new Map();
    const conflicts = [];
    remoteItems.forEach(item => map.set(item._id, { ...item, _source: 'remote' }));
    localItems.forEach(item => {
      const existing = map.get(item._id);
      if (!existing) { map.set(item._id, { ...item, _source: 'local' }); }
      else if (item.updatedAt && existing.updatedAt) {
        const localTime = new Date(item.updatedAt).getTime();
        const remoteTime = new Date(existing.updatedAt).getTime();
        if (localTime !== remoteTime) {
          conflicts.push({ id: item._id, name: item.name || '未命名', local: item, remote: existing, localModified: item.updatedAt, remoteModified: existing.updatedAt });
          if (this.config.conflictStrategy === 'local') map.set(item._id, { ...item, _source: 'local' });
          else if (this.config.conflictStrategy === 'newer' && localTime > remoteTime) map.set(item._id, { ...item, _source: 'local' });
        }
      } else if (!existing.updatedAt) { map.set(item._id, { ...item, _source: 'local' }); }
    });
    const merged = Array.from(map.values()).map(item => { const { _source, ...rest } = item; return rest; });
    merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return { merged, conflicts };
  },

  async syncBidirectional(localItems, password) {
    const startTime = Date.now();
    const downResult = await this.download(localItems, password);
    if (!downResult.success) {
      if (downResult.message.includes('未找到同步 Gist')) return await this.upload(localItems, password);
      return downResult;
    }
    const upResult = await this.upload(downResult.items, password);
    if (!upResult.success) return upResult;
    await this.logSync('sync_bidirectional', true, '双向同步完成', startTime, { count: downResult.items.length, conflicts: downResult.conflicts.length });
    return { success: true, items: downResult.items, conflicts: downResult.conflicts, message: `双向同步完成，共 ${downResult.items.length} 条记录，冲突 ${downResult.conflicts.length} 个`, mergedCount: downResult.items.length };
  },

  // ========== 同步日志 ==========
  async logSync(type, success, message, startTime, extra = {}) {
    if (!window.IDB) return;
    const duration = startTime ? Date.now() - startTime : 0;
    await IDB.logSync({ type, success, message, duration, ...extra });
  },

  async getSyncHistory(limit = 20) {
    if (!window.IDB) return [];
    return await IDB.getSyncLogs(limit);
  },

  // ========== 增量同步 ==========
  async uploadIncremental(password) {
    const startTime = Date.now();
    try {
      if (!window.IDB) return await this.upload(Storage.getAll(), password);
      const modifiedItems = await IDB.getModifiedItems();
      if (modifiedItems.length === 0) return { success: true, message: '没有需要同步的更改', uploaded: 0 };
      
      const encrypted = await this.pullFromGist();
      let remotePayload;
      try { remotePayload = await this.decrypt(encrypted, password); }
      catch (e) { return { success: false, message: '解密失败：密码错误' }; }
      
      const remoteItems = remotePayload.items || [];
      const remoteMap = new Map(remoteItems.map(item => [item._id, item]));
      modifiedItems.forEach(item => remoteMap.set(item._id, item));
      const merged = Array.from(remoteMap.values());
      
      const result = await this.upload(merged, password);
      if (result.success) { await IDB.clearModifiedFlags(); await this.logSync('upload_incremental', true, '增量上传完成', startTime, { uploaded: modifiedItems.length }); }
      return { ...result, uploaded: modifiedItems.length };
    } catch (e) {
      await this.logSync('upload_incremental', false, e.message, startTime);
      return { success: false, message: `增量上传失败：${e.message}` };
    }
  },

  // ========== 状态查询 ==========
  isConfigured() { return !!(this.config.token && this.config.gistId); },
  isEnabled() { return this.config.enabled && this.isConfigured(); },
  getLastSyncTime() { return this.config.lastSync; },
  getStatusText() {
    if (!this.config.token) return '未配置';
    if (!this.config.gistId) return '已配置 Token，未创建 Gist';
    if (!this.config.lastSync) return '已连接，未同步';
    const diff = Math.floor((new Date() - new Date(this.config.lastSync)) / 1000);
    if (diff < 60) return '刚刚同步';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return `${Math.floor(diff / 86400)} 天前`;
  },

  async testConnection() {
    try {
      const response = await fetch('https://api.github.com/user', { headers: { 'Authorization': `token ${this.config.token}`, 'User-Agent': 'UniversalJournal-H5' } });
      if (!response.ok) { const err = await response.json().catch(() => ({})); return { success: false, message: `连接失败：${err.message || response.status}` }; }
      const user = await response.json();
      return { success: true, message: `连接成功！登录用户：${user.login}`, user: user.login };
    } catch (e) { return { success: false, message: `网络错误：${e.message}` }; }
  }
};
