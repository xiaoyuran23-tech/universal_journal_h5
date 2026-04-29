/**
 * StorageService - 基于 IndexedDB 的高性能存储服务
 * 替代 localStorage，解决大数据量卡顿和 5MB 限制问题
 * @version 6.0.0
 */

import { openDB } from 'idb';

class StorageService {
  constructor() {
    this._db = null;
    this._dbName = 'journal_v6_db';
    this._storeName = 'records';
  }

  /**
   * 初始化数据库
   * @returns {Promise<void>}
   */
  async init() {
    try {
      this._db = await openDB(this._dbName, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('records')) {
            const store = db.createObjectStore('records', { keyPath: 'id' });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
            store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          }
        }
      });
      console.log('[StorageService] IndexedDB initialized');
    } catch (error) {
      console.error('[StorageService] Failed to init DB:', error);
      throw error;
    }
  }

  /**
   * 获取所有记录
   * @returns {Promise<Array>}
   */
  async getAll() {
    if (!this._db) await this.init();
    try {
      return await this._db.getAll(this._storeName);
    } catch (error) {
      console.error('[StorageService] Get all failed:', error);
      return [];
    }
  }

  /**
   * 获取单条记录
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async get(id) {
    if (!this._db) await this.init();
    try {
      return await this._db.get(this._storeName, id);
    } catch (error) {
      console.error('[StorageService] Get failed:', error);
      return null;
    }
  }

  /**
   * 保存/更新记录
   * @param {Object} record
   * @returns {Promise<void>}
   */
  async put(record) {
    if (!this._db) await this.init();
    try {
      await this._db.put(this._storeName, record);
    } catch (error) {
      console.error('[StorageService] Put failed:', error);
      throw error;
    }
  }

  /**
   * 删除记录
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (!this._db) await this.init();
    try {
      await this._db.delete(this._storeName, id);
    } catch (error) {
      console.error('[StorageService] Delete failed:', error);
      throw error;
    }
  }

  /**
   * 清空所有记录
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this._db) await this.init();
    try {
      await this._db.clear(this._storeName);
    } catch (error) {
      console.error('[StorageService] Clear failed:', error);
      throw error;
    }
  }

  /**
   * 批量保存
   * @param {Array} records
   * @returns {Promise<void>}
   */
  async bulkPut(records) {
    if (!this._db) await this.init();
    const tx = this._db.transaction(this._storeName, 'readwrite');
    const store = tx.objectStore(this._storeName);
    
    try {
      for (const record of records) {
        await store.put(record);
      }
      await tx.done;
    } catch (error) {
      console.error('[StorageService] Bulk put failed:', error);
      throw error;
    }
  }
}

// 全局单例
window.StorageService = new StorageService();

console.log('[StorageService] 存储服务已定义');
