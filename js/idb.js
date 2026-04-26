/**
 * 万物手札 - IndexedDB 存储模块
 * 突破 localStorage 5MB 限制，支持大量照片存储
 */

const IDB = {
  DB_NAME: 'universal_journal_db',
  DB_VERSION: 1,
  STORE_NAME: 'items',
  
  db: null,

  /**
   * 初始化数据库
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('📦 IndexedDB 初始化成功');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 创建对象仓库
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: '_id' });
          
          // 创建索引
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('isFavorite', 'isFavorite', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
        
        // 创建元数据存储
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
        
        // 创建同步日志存储
        if (!db.objectStoreNames.contains('sync_logs')) {
          const logStore = db.createObjectStore('sync_logs', { keyPath: 'id', autoIncrement: true });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
          logStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  },

  /**
   * 确保数据库已初始化
   */
  async ensureDB() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  },

  /**
   * 存储单个物品
   */
  async put(item) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.put(item);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 批量存储物品
   */
  async putMany(items) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      
      items.forEach(item => {
        store.put(item);
      });
      
      tx.oncomplete = () => resolve(items.length);
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * 获取单个物品
   */
  async get(id) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 获取所有物品
   */
  async getAll() {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        // 按创建时间倒序
        const items = request.result.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 删除单个物品
   */
  async delete(id) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 清空所有物品
   */
  async clear() {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 获取物品数量
   */
  async count() {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 按条件查询
   */
  async query(indexName, value) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 获取收藏的物品
   */
  async getFavorites() {
    const items = await this.getAll();
    return items.filter(item => item.isFavorite);
  },

  // ==================== 元数据管理 ====================

  /**
   * 设置元数据
   */
  async setMetadata(key, value) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.put({ key, value, updatedAt: new Date().toISOString() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 获取元数据
   */
  async getMetadata(key) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== 同步日志 ====================

  /**
   * 记录同步日志
   */
  async logSync(type, result, details = {}) {
    const db = await this.ensureDB();
    const log = {
      timestamp: new Date().toISOString(),
      type, // 'upload' | 'download' | 'sync' | 'error'
      success: result.success,
      message: result.message,
      ...details
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_logs', 'readwrite');
      const store = tx.objectStore('sync_logs');
      const request = store.add(log);
      
      request.onsuccess = () => {
        // 清理旧日志（保留最近 100 条）
        this.cleanupLogs();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 获取同步日志
   */
  async getLogs(limit = 50) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_logs', 'readonly');
      const store = tx.objectStore('sync_logs');
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');
      
      const logs = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && logs.length < limit) {
          logs.push(cursor.value);
          cursor.continue();
        } else {
          resolve(logs);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 清理旧日志（保留最近 100 条）
   */
  async cleanupLogs() {
    const db = await this.ensureDB();
    const logs = await this.getLogs(1000);
    
    if (logs.length > 100) {
      const toDelete = logs.slice(100);
      const tx = db.transaction('sync_logs', 'readwrite');
      const store = tx.objectStore('sync_logs');
      
      toDelete.forEach(log => {
        store.delete(log.id);
      });
    }
  },

  /**
   * 清空同步日志
   */
  async clearLogs() {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_logs', 'readwrite');
      const store = tx.objectStore('sync_logs');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== 迁移工具 ====================

  /**
   * 从 localStorage 迁移到 IndexedDB
   */
  async migrateFromLocalStorage() {
    const localStorageData = localStorage.getItem('universal_journal_items');
    if (!localStorageData) {
      return { migrated: 0, message: 'localStorage 无数据' };
    }

    try {
      const items = JSON.parse(localStorageData);
      if (!Array.isArray(items) || items.length === 0) {
        return { migrated: 0, message: '数据为空' };
      }

      await this.putMany(items);
      
      // 标记迁移完成
      await this.setMetadata('migrated_from_local', true);
      await this.setMetadata('migration_date', new Date().toISOString());
      
      return {
        migrated: items.length,
        message: `成功迁移 ${items.length} 条记录`
      };
    } catch (e) {
      console.error('迁移失败:', e);
      return {
        migrated: 0,
        message: `迁移失败：${e.message}`,
        error: e
      };
    }
  },

  /**
   * 检查是否已迁移
   */
  async isMigrated() {
    return await this.getMetadata('migrated_from_local') === true;
  },

  // ==================== 统计信息 ====================

  /**
   * 获取数据库统计
   */
  async getStats() {
    const db = await this.ensureDB();
    const itemCount = await this.count();
    const logs = await this.getLogs(1);
    
    // 估算存储大小
    const allItems = await this.getAll();
    const estimatedSize = new Blob([JSON.stringify(allItems)]).size;
    
    return {
      itemCount,
      estimatedSize,
      estimatedSizeFormatted: this.formatSize(estimatedSize),
      lastSync: logs.length > 0 ? logs[0].timestamp : null,
      isMigrated: await this.isMigrated()
    };
  },

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  },

  /**
   * 导出所有数据（用于备份）
   */
  async exportAll() {
    const items = await this.getAll();
    const metadata = {};
    
    const db = await this.ensureDB();
    const metaItems = await new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    metaItems.forEach(m => { metadata[m.key] = m.value; });

    return { version: '2.0', exportedAt: new Date().toISOString(), metadata, items };
  },

  // ==================== 增量同步支持 ====================

  /**
   * 标记物品为已修改（需要同步）
   */
  async markAsModified(id) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.put({ 
        key: `modified_${id}`, 
        value: true, 
        markedAt: new Date().toISOString() 
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 获取所有已修改的物品
   */
  async getModifiedItems() {
    const db = await this.ensureDB();
    
    // 获取所有修改标记
    const modifiedIds = await new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.getAll();
      
      const ids = [];
      request.onsuccess = () => {
        request.result.forEach(m => {
          if (m.key.startsWith('modified_')) {
            ids.push(m.key.replace('modified_', ''));
          }
        });
        resolve(ids);
      };
      request.onerror = () => reject(request.error);
    });
    
    // 获取对应的物品
    const items = [];
    for (const id of modifiedIds) {
      const item = await this.get(id);
      if (item) items.push(item);
    }
    
    return items;
  },

  /**
   * 清除修改标记（同步完成后调用）
   */
  async clearModifiedFlags() {
    const db = await this.ensureDB();
    const modifiedIds = await new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.getAll();
      
      const ids = [];
      request.onsuccess = () => {
        request.result.forEach(m => {
          if (m.key.startsWith('modified_')) {
            ids.push(m.key);
          }
        });
        resolve(ids);
      };
      request.onerror = () => reject(request.error);
    });
    
    const tx = db.transaction('metadata', 'readwrite');
    const store = tx.objectStore('metadata');
    modifiedIds.forEach(key => store.delete(key));
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(request.error);
    });
  },

  /**
   * 标记物品为已删除（需要同步删除）
   */
  async markAsDeleted(id) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.put({ 
        key: `deleted_${id}`, 
        value: true, 
        markedAt: new Date().toISOString() 
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 获取已删除的物品 ID 列表
   */
  async getDeletedIds() {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.getAll();
      
      const ids = [];
      request.onsuccess = () => {
        request.result.forEach(m => {
          if (m.key.startsWith('deleted_')) {
            ids.push(m.key.replace('deleted_', ''));
          }
        });
        resolve(ids);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 清除删除标记
   */
  async clearDeletedFlags() {
    const db = await this.ensureDB();
    const deletedIds = await new Promise((resolve, reject) => {
      const tx = db.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.getAll();
      
      const ids = [];
      request.onsuccess = () => {
        request.result.forEach(m => {
          if (m.key.startsWith('deleted_')) {
            ids.push(m.key);
          }
        });
        resolve(ids);
      };
      request.onerror = () => reject(request.error);
    });
    
    const tx = db.transaction('metadata', 'readwrite');
    const store = tx.objectStore('metadata');
    deletedIds.forEach(key => store.delete(key));
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(request.error);
    });
  }
};
