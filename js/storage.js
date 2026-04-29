/**
 * 万物手札 v4.0.0 - 统一数据访问层
 * 设计理念：单一数据源、IndexedDB 优先、自动迁移、幂等操作
 */

const StorageBackend = {
  useIndexedDB: false,
  DATA_VERSION: '4.0.0',
  STORAGE_KEY: 'universal_journal_items',
  VERSION_KEY: 'universal_journal_data_version',

  async init() {
    if (window.IDBModule) {
      try {
        await IDBModule.init();
        this.useIndexedDB = true;
        // 自动从 localStorage 迁移
        await this.migrateFromLocalStorage();
      } catch (e) {
        console.warn('IndexedDB 初始化失败，降级到 localStorage:', e);
        this.useIndexedDB = false;
      }
    }
  },

  /** 从 localStorage 迁移到 IndexedDB（幂等） */
  async migrateFromLocalStorage() {
    if (!this.useIndexedDB || !window.IDBModule) return { migrated: 0 };
    const localData = localStorage.getItem(this.STORAGE_KEY);
    if (!localData) return { migrated: 0 };
    try {
      const items = JSON.parse(localData);
      if (!Array.isArray(items) || items.length === 0) return { migrated: 0 };
      // 检查 IndexedDB 是否已有数据
      const count = await IDBModule.count();
      if (count > 0) {
        localStorage.removeItem(this.STORAGE_KEY);
        return { migrated: 0 };
      }
      await IDBModule.putMany(items);
      localStorage.removeItem(this.STORAGE_KEY);
      console.log(`✅ 已迁移 ${items.length} 条记录到 IndexedDB`);
      return { migrated: items.length };
    } catch (e) {
      console.error('迁移失败:', e);
      return { migrated: 0, error: e.message };
    }
  },

  /** 获取所有记录 */
  async getAll() {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      return await IDBModule.getAll();
    }
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('localStorage 数据解析失败:', e);
      localStorage.removeItem(this.STORAGE_KEY);
      return [];
    }
  },

  /** 保存全量数据 */
  async save(items) {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.clear();
      await IDBModule.putMany(items);
      return;
    }
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
      localStorage.setItem(this.VERSION_KEY, this.DATA_VERSION);
    } catch (e) {
      console.error('localStorage 写入失败:', e);
      if (window.App?.showToast) {
        App.showToast('⚠️ 存储空间不足，请清理旧记录');
      }
    }
  },

  /** 新增/更新单条记录 */
  async put(item) {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.put(item);
      return;
    }
    const items = await this.getAll();
    const index = items.findIndex(i => i.id === item.id);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.unshift(item);
    }
    await this.save(items);
  },

  /** 删除单条记录 */
  async delete(id) {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.delete(id);
      return;
    }
    const items = await this.getAll();
    await this.save(items.filter(i => i.id !== id));
  },

  /** 批量删除 */
  async deleteMany(ids) {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.deleteMany(ids);
      return;
    }
    const items = await this.getAll();
    await this.save(items.filter(i => !ids.includes(i.id)));
  },

  /** 清空所有数据 */
  async clear() {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.clear();
      return;
    }
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.VERSION_KEY);
  },

  /** 获取单条记录 */
  async get(id) {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      return await IDBModule.get(id);
    }
    const items = await this.getAll();
    return items.find(i => i.id === id) || null;
  },

  /** 数据模型标准化（确保纯标签化、版本标记） */
  normalizeItem(item) {
    const normalized = { ...item };
    // 确保 id
    if (!normalized.id) {
      normalized.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
    // 确保 tags 是数组
    if (!Array.isArray(normalized.tags)) normalized.tags = [];
    // 分类转标签（迁移遗留数据）
    if (normalized.category && normalized.category.trim() !== '') {
      if (!normalized.tags.includes(normalized.category)) {
        normalized.tags.push(normalized.category);
      }
      delete normalized.category;
    }
    // 确保时间戳
    if (!normalized.createdAt) normalized.createdAt = new Date().toISOString();
    if (!normalized.updatedAt) normalized.updatedAt = new Date().toISOString();
    // 数据版本标记
    normalized._dataVersion = this.DATA_VERSION;
    return normalized;
  },

  /** 批量标准化数据 */
  normalizeAll(items) {
    return items.map(item => this.normalizeItem(item));
  },

  /** 检查是否需要迁移 */
  needsMigration(items) {
    if (!Array.isArray(items)) return false;
    return items.some(item => {
      // 有 category 字段或无 _dataVersion 标记
      return item.category || !item._dataVersion;
    });
  }
};

window.StorageBackend = StorageBackend;
