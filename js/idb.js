/**
 * 万物手札 - IndexedDB 数据持久化模块
 * 提供高性能、大容量的本地数据存储
 * 版本：v3.0.0
 */

const IDBModule = {
  DB_NAME: 'UniversalJournalDB',
  DB_VERSION: 1,
  STORE_NAME: 'items',
  db: null,
  
  // 缓存配置
  CACHE_SIZE: 100, // 每次加载的数量
  cache: [],
  cacheOffset: 0,
  hasMore: true,
  
  /**
   * 初始化数据库
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = (event) => {
        console.error('IndexedDB 打开失败:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;

        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 创建主存储
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          // 创建索引
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('favorite', 'favorite', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
      };
    });
  },
  
  /**
   * 从 localStorage 迁移数据到 IndexedDB
   */
  async migrateFromLocalStorage() {
    if (!this.db) return { migrated: 0 };
    
    const localStorageData = localStorage.getItem('universal_journal_items');
    if (!localStorageData) return { migrated: 0 };
    
    try {
      const items = JSON.parse(localStorageData);
      if (!Array.isArray(items) || items.length === 0) return { migrated: 0 };
      
      // 检查是否已迁移
      const count = await this.count();
      if (count > 0) return { migrated: 0 };
      
      // 批量插入
      await this.putMany(items);
      
      // 迁移成功后删除 localStorage 数据
      localStorage.removeItem('universal_journal_items');
      

      return { migrated: items.length };
    } catch (e) {
      console.error('迁移失败:', e);
      return { migrated: 0, error: e.message };
    }
  },
  
  /**
   * 添加单条记录
   */
  async put(item) {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(item);
      
      request.onsuccess = () => resolve(item);
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 批量添加记录
   */
  async putMany(items) {
    if (!this.db || items.length === 0) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      items.forEach(item => {
        store.put(item);
      });
      
      transaction.oncomplete = () => resolve(items.length);
      transaction.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 获取单条记录
   */
  async get(id) {
    if (!this.db) return null;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 获取所有记录（用于导出等场景）
   */
  async getAll() {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 分页获取记录（按创建时间倒序）
   */
  async getPaginated(offset = 0, limit = 50) {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('createdAt');
      
      const items = [];
      const request = index.openCursor(null, 'prev');
      let skipped = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (skipped >= offset && items.length < limit) {
            items.push(cursor.value);
          }
          if (skipped < offset + limit) {
            skipped++;
            cursor.continue();
          }
        } else {
          resolve(items);
        }
      };
      
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 删除单条记录
   */
  async delete(id) {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 批量删除
   */
  async deleteMany(ids) {
    if (!this.db || ids.length === 0) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      ids.forEach(id => {
        store.delete(id);
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 清空所有数据
   */
  async clear() {
    if (!this.db) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 获取记录总数
   */
  async count() {
    if (!this.db) return 0;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 按分类获取记录
   */
  async getByCategory(category) {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('category');
      const request = index.getAll(category);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 按标签获取记录
   */
  async getByTag(tag) {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('tags');
      const request = index.getAll(tag);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 获取收藏的记录
   */
  async getFavorites() {
    if (!this.db) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('favorite');
      const request = index.getAll(true);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  },
  
  /**
   * 搜索记录（标题或备注包含关键词）
   */
  async search(keyword) {
    if (!this.db || !keyword) return [];
    
    const allItems = await this.getAll();
    const lowerKeyword = keyword.toLowerCase();
    
    return allItems.filter(item => 
      (item.name && item.name.toLowerCase().includes(lowerKeyword)) ||
      (item.notes && item.notes.toLowerCase().includes(lowerKeyword)) ||
      (item.tags && item.tags.some(tag => tag.toLowerCase().includes(lowerKeyword)))
    );
  },
  
  /**
   * 获取所有标签及其使用次数
   */
  async getAllTags() {
    if (!this.db) return [];
    
    const allItems = await this.getAll();
    const tagMap = {};
    
    allItems.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        });
      }
    });
    
    return Object.entries(tagMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
};

// 全局导出
window.IDBModule = IDBModule;
