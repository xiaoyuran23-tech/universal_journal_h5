/**
 * MigrationService - DB Schema 版本迁移服务
 * 负责 IndexedDB 数据结构的版本升级与数据迁移
 * @version 6.2.0
 */

class MigrationService {
  static CURRENT_SCHEMA_VERSION = '6.2.0';
  static SCHEMA_KEY = '_uj_schema_version';

  /**
   * 获取当前数据库版本
   */
  static getSchemaVersion() {
    return localStorage.getItem(this.SCHEMA_KEY) || '6.0.0';
  }

  /**
   * 设置数据库版本
   */
  static setSchemaVersion(version) {
    localStorage.setItem(this.SCHEMA_KEY, version);
  }

  /**
   * 检查是否需要迁移
   */
  static needsMigration() {
    const current = this.getSchemaVersion();
    return this._compareVersions(current, this.CURRENT_SCHEMA_VERSION) < 0;
  }

  /**
   * 执行迁移
   * @returns {Promise<{migrated: boolean, from: string, to: string}>}
   */
  static async migrate() {
    const from = this.getSchemaVersion();
    const to = this.CURRENT_SCHEMA_VERSION;

    if (this._compareVersions(from, to) >= 0) {
      return { migrated: false, from, to };
    }

    console.log(`[MigrationService] Migrating from ${from} to ${to}`);

    // 按版本依次执行迁移
    if (this._compareVersions(from, '6.1.0') < 0) {
      await this._migrateTo610();
    }
    if (this._compareVersions(from, '6.2.0') < 0) {
      await this._migrateTo620();
    }

    this.setSchemaVersion(to);
    console.log(`[MigrationService] Migration complete: ${from} → ${to}`);
    return { migrated: true, from, to };
  }

  /**
   * v6.0.0 → v6.1.0 迁移
   * - 添加 metadata 字段到所有记录
   * - 添加 _dataVersion 标记
   */
  static async _migrateTo610() {
    console.log('[MigrationService] Running migration to 6.1.0...');

    if (!window.StorageBackend) return;

    try {
      const records = await StorageBackend.getAll();
      let updated = 0;

      for (const record of records) {
        if (!record.metadata) {
          record.metadata = {
            wordCount: this._countWords(record.notes || ''),
            readingTime: this._calcReadingTime(record.notes || ''),
            emotionTags: [],
            summary: this._extractSummary(record.notes || ''),
            hasPhotos: !!(record.photos && record.photos.length > 0),
            hasLocation: !!record.location
          };
          record._dataVersion = '6.1.0';
          await StorageBackend.put(record);
          updated++;
        }
      }

      console.log(`[MigrationService] Updated ${updated} records with metadata`);
    } catch (e) {
      console.warn('[MigrationService] Migration to 6.1.0 failed, continuing:', e);
    }
  }

  /**
   * v6.1.0 → v6.2.0 迁移
   * - 添加 blocks 字段 (块级数据模型准备)
   * - 添加 links 字段 (双向链接准备)
   * - 规范化 tags 为数组格式
   */
  static async _migrateTo620() {
    console.log('[MigrationService] Running migration to 6.2.0...');

    if (!window.StorageBackend) return;

    try {
      const records = await StorageBackend.getAll();
      let updated = 0;

      for (const record of records) {
        let changed = false;

        // 添加 blocks 字段
        if (!record.blocks) {
          record.blocks = [];
          changed = true;
        }

        // 添加 links 字段
        if (!record.links) {
          record.links = [];
          changed = true;
        }

        // 规范化 tags
        if (record.tags && typeof record.tags === 'string') {
          record.tags = record.tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
          changed = true;
        }

        // 确保 _dataVersion
        if (!record._dataVersion || record._dataVersion === '6.0.0') {
          record._dataVersion = '6.2.0';
          changed = true;
        }

        if (changed) {
          await StorageBackend.put(record);
          updated++;
        }
      }

      console.log(`[MigrationService] Updated ${updated} records for 6.2.0 schema`);
    } catch (e) {
      console.warn('[MigrationService] Migration to 6.2.0 failed, continuing:', e);
    }
  }

  /**
   * 字数统计
   * @private
   */
  static _countWords(html) {
    const text = html.replace(/<[^>]*>/g, '').trim();
    const chinese = (text.match(/[一-鿿]/g) || []).length;
    const english = (text.match(/[a-zA-Z]+/g) || []).length;
    return chinese + english;
  }

  /**
   * 计算阅读时间 (分钟)
   * @private
   */
  static _calcReadingTime(html) {
    const words = this._countWords(html);
    const chinese = (html.replace(/<[^>]*>/g, '').match(/[一-鿿]/g) || []).length;
    const english = (html.replace(/<[^>]*>/g, '').match(/[a-zA-Z]+/g) || []).length;
    const minutes = Math.ceil(chinese / 300 + english / 200);
    return Math.max(1, minutes);
  }

  /**
   * 提取摘要
   * @private
   */
  static _extractSummary(html) {
    const text = html.replace(/<[^>]*>/g, '').trim();
    return text.substring(0, 100);
  }

  /**
   * 版本号比较
   * @returns {number} -1: a<b, 0: a==b, 1: a>b
   * @private
   */
  static _compareVersions(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const va = partsA[i] || 0;
      const vb = partsB[i] || 0;
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    return 0;
  }
}

window.MigrationService = MigrationService;
console.log('[MigrationService] DB Schema 迁移服务已定义 (当前版本: 6.2.0)');
