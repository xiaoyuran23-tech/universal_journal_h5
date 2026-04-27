/**
 * 万物手札 - 云同步模块
 * 负责与 GitHub Gist 的数据同步
 * 注意：当前使用 Base64 编码传输，非真正加密
 * 版本：v2.3.0
 */

const Sync = {
  // 同步配置
  config: {
    gistId: null,
    gistToken: null,
    encryptionKey: null,
    lastSyncTime: null
  },
  
  // 初始化
  init() {
    console.log('Sync module initialized');
    this.loadConfig();
  },
  
  // 加载配置
  loadConfig() {
    try {
      const configData = localStorage.getItem('sync_config');
      if (configData) {
        this.config = { ...this.config, ...JSON.parse(configData) };
      }
    } catch (e) {
      console.error('Sync.loadConfig error:', e);
    }
  },
  
  // 保存配置
  saveConfig() {
    try {
      localStorage.setItem('sync_config', JSON.stringify(this.config));
    } catch (e) {
      console.error('Sync.saveConfig error:', e);
    }
  },
  
  // 设置同步配置
  setConfig(gistId, gistToken, encryptionKey) {
    this.config.gistId = gistId;
    this.config.gistToken = gistToken;
    this.config.encryptionKey = encryptionKey;
    this.saveConfig();
  },
  
  // 检查是否已配置
  isConfigured() {
    return !!(this.config.gistId && this.config.gistToken && this.config.encryptionKey);
  },
  
  // 上传数据到 Gist
  async upload() {
    if (!this.isConfigured()) {
      throw new Error('同步配置不完整');
    }
    
    try {
      const data = {
        items: Storage.getAll(),
        settings: Storage.getSettings(),
        syncTime: new Date().toISOString(),
        version: '2.2.1'
      };
      
      const encrypted = await this.encrypt(JSON.stringify(data));
      
      const response = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this.config.gistToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          files: {
            'journal_data.json': {
              content: encrypted
            }
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }
      
      this.config.lastSyncTime = new Date().toISOString();
      this.saveConfig();
      
      return true;
    } catch (e) {
      console.error('Sync.upload error:', e);
      throw e;
    }
  },
  
  // 从 Gist 下载数据
  async download() {
    if (!this.isConfigured()) {
      throw new Error('同步配置不完整');
    }
    
    try {
      const response = await fetch(`https://api.github.com/gists/${this.config.gistId}`, {
        headers: {
          'Authorization': `token ${this.config.gistToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }
      
      const gistData = await response.json();
      const fileContent = gistData.files['journal_data.json']?.content;
      
      if (!fileContent) {
        throw new Error('Gist 中未找到数据文件');
      }
      
      const decrypted = await this.decrypt(fileContent);
      const data = JSON.parse(decrypted);
      
      // 恢复数据
      if (data.items) {
        Storage.saveAll(data.items);
      }
      if (data.settings) {
        Storage.saveSettings(data.settings);
      }
      
      this.config.lastSyncTime = new Date().toISOString();
      this.saveConfig();
      
      return true;
    } catch (e) {
      console.error('Sync.download error:', e);
      throw e;
    }
  },
  
  // Base64 编码（注意：非真正加密，仅简单编码）
  // TODO: 后续应升级为 Web Crypto API (AES-GCM) 实现真正的加密
  async encrypt(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    return btoa(String.fromCharCode(...data));
  },
  
  // Base64 解码
  async decrypt(encrypted) {
    const binary = atob(encrypted);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  },
  
  // 双向同步
  async sync() {
    try {
      // 先下载最新数据
      await this.download();
      
      // 再上传本地数据
      await this.upload();
      
      return true;
    } catch (e) {
      console.error('Sync.sync error:', e);
      throw e;
    }
  }
};

// 注意：初始化由 App.init() 统一处理，避免重复初始化
