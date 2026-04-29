/**
 * StorageService - 基于 IndexedDB 的高性能存储服务
 * 替代 localStorage，解决大数据量卡顿和 5MB 限制问题
 * 纯原生 IndexedDB 实现，无外部依赖
 * @version 6.1.0
 */

class StorageService {
  constructor() {
    this._db = null;
    this._dbName = 'journal_v6_db';
    this._storeName = 'records';
    this._dbVersion = 2; // 增加版本号以支持新索引
  }

  /**
   * 初始化数据库
   * @returns {Promise<void>}
   */
  async init() {
    if (this._db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this._dbName, this._dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains(this._storeName)) {
          const store = db.createObjectStore(this._storeName, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          store.createIndex('favorite', 'favorite', { unique: false });
        } else {
          const store = request.transaction.objectStore(this._storeName);
          if (!store.indexNames.contains('favorite')) {
            store.createIndex('favorite', 'favorite', { unique: false });
          }
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        console.log('[StorageService] IndexedDB initialized');
        resolve();
      };

      request.onerror = (event) => {
        const error = new Error('IndexedDB 打开失败: ' + event.target.error.message);
        console.error('[StorageService]', error);
        reject(error);
      };
    });
  }

  /**
   * 获取所有记录
   * @returns {Promise<Array>}
   */
  async getAll() {
    if (!this._db) await this.init();
    return this._request('readonly', (store) => store.getAll());
  }

  /**
   * 获取单条记录
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async get(id) {
    if (!this._db) await this.init();
    return this._request('readonly', (store) => store.get(id));
  }

  /**
   * 保存/更新记录
   * @param {Object} record
   * @returns {Promise<void>}
   */
  async put(record) {
    if (!this._db) await this.init();
    return this._request('readwrite', (store) => store.put(record));
  }

  /**
   * 删除记录
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (!this._db) await this.init();
    return this._request('readwrite', (store) => store.delete(id));
  }

  /**
   * 清空所有记录
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this._db) await this.init();
    return this._request('readwrite', (store) => store.clear());
  }

  /**
   * 批量保存
   * @param {Array} records
   * @returns {Promise<void>}
   */
  async bulkPut(records) {
    if (!this._db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._storeName, 'readwrite');
      const store = tx.objectStore(this._storeName);

      records.forEach(record => store.put(record));

      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(new Error('批量保存失败'));
    });
  }

  /**
   * 按标签查询
   * @param {string} tag
   * @returns {Promise<Array>}
   */
  async getByTag(tag) {
    if (!this._db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._storeName, 'readonly');
      const store = tx.objectStore(this._storeName);
      const index = store.index('tags');
      const request = index.getAll(tag);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('标签查询失败'));
    });
  }

  /**
   * 获取收藏记录
   * @returns {Promise<Array>}
   */
  async getFavorites() {
    if (!this._db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._storeName, 'readonly');
      const store = tx.objectStore(this._storeName);
      const index = store.index('favorite');
      const request = index.getAll(true);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('收藏查询失败'));
    });
  }

  /**
   * 获取记录总数
   * @returns {Promise<number>}
   */
  async count() {
    if (!this._db) await this.init();
    return this._request('readonly', (store) => store.count());
  }

  /**
   * 数据库健康检查
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async healthCheck() {
    try {
      if (!this._db) await this.init();
      await this.count();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * 导出全部数据
   * @returns {Promise<Object>}
   */
  async export() {
    const records = await this.getAll();
    return {
      version: '6.0.0',
      exportDate: new Date().toISOString(),
      count: records.length,
      records
    };
  }

  /**
   * 导入数据
   * @param {Object} data
   * @returns {Promise<number>} - 导入数量
   */
  async import(data) {
    if (!data.records || !Array.isArray(data.records)) {
      throw new Error('无效的数据格式');
    }
    await this.bulkPut(data.records);
    return data.records.length;
  }

  /**
   * 封装 IndexedDB 请求
   * @private
   */
  _request(mode, operation) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._storeName, mode);
      const store = tx.objectStore(this._storeName);
      const request = operation(store);

      // getAll/count 返回 request，put/delete 返回 undefined
      if (request && request.onsuccess !== undefined) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('操作失败'));
      }

      tx.oncomplete = () => {
        if (!request) resolve();
      };
      tx.onerror = () => {
        if (!request) reject(new Error('事务失败'));
      };
    });
  }
}

// 全局单例
window.StorageService = new StorageService();

console.log('[StorageService] 存储服务已定义');
