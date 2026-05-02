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
    this._indexStoreName = 'searchIndex';
    this._dbVersion = 4; // v4: 添加 links 索引以支持双向链接查询
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
          store.createIndex('links.targetId', 'links.targetId', { unique: false, multiEntry: true });
        } else {
          const store = request.transaction.objectStore(this._storeName);
          if (!store.indexNames.contains('favorite')) {
            store.createIndex('favorite', 'favorite', { unique: false });
          }
          // P2-2: 添加 links.targetId 索引 (v4)
          if (!store.indexNames.contains('links.targetId')) {
            store.createIndex('links.targetId', 'links.targetId', { unique: false, multiEntry: true });
          }
        }

        // 搜索索引 store: key = recordId, value = { id, text }
        if (!db.objectStoreNames.contains(this._indexStoreName)) {
          db.createObjectStore(this._indexStoreName, { keyPath: 'id' });
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
    const result = this._request('readwrite', (store) => store.put(record));
    // 异步更新搜索索引 (不阻塞主流程)
    this.searchIndex(record).catch(() => {});
    return result;
  }

  /**
   * 删除记录
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (!this._db) await this.init();
    const result = this._request('readwrite', (store) => store.delete(id));
    // 异步删除搜索索引
    this.searchDelete(id).catch(() => {});
    return result;
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

      tx.oncomplete = () => {
        // 异步更新搜索索引
        this.bulkSearchIndex(records).catch(() => {});
        resolve();
      };
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

  // ========== 全文搜索 ==========

  /**
   * 构建/更新单条记录的搜索索引文本
   * @param {Object} record
   * @returns {Promise<void>}
   */
  async searchIndex(record) {
    if (!this._db) await this.init();

    // 提取纯文本 (去除 HTML 标签)
    const plainNotes = record.notes
      ? record.notes.replace(/<[^>]*>/g, ' ').replace(/&\w+;/g, ' ')
      : '';

    const tagsText = Array.isArray(record.tags) ? record.tags.join(' ') : '';
    const searchText = `${record.name || ''} ${plainNotes} ${tagsText}`.toLowerCase().trim();

    const indexEntry = {
      id: record.id,
      text: searchText,
      updatedAt: record.updatedAt || Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._indexStoreName, 'readwrite');
      const store = tx.objectStore(this._indexStoreName);
      store.put(indexEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('搜索索引更新失败'));
    });
  }

  /**
   * 删除搜索索引
   * @param {string} recordId
   * @returns {Promise<void>}
   */
  async searchDelete(recordId) {
    if (!this._db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._indexStoreName, 'readwrite');
      const store = tx.objectStore(this._indexStoreName);
      store.delete(recordId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('搜索索引删除失败'));
    });
  }

  /**
   * 全文搜索 (使用 IndexedDB cursor，不加载全部记录到内存)
   * 支持中文子串匹配 (n-gram substring)
   * @param {string} query - 搜索关键词
   * @returns {Promise<Array>} 匹配的记录 ID 列表
   */
  async search(query) {
    if (!this._db) await this.init();
    if (!query || !query.trim()) return [];

    const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._indexStoreName, 'readonly');
      const store = tx.objectStore(this._indexStoreName);
      const matchedIds = [];

      // 使用 cursor 遍历搜索索引
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          // 遍历完成，按 ID 从 records store 获取完整记录
          this._getRecordsByIds(matchedIds).then(resolve).catch(reject);
          return;
        }

        const { id, text } = cursor.value;
        // 所有搜索词都匹配才算匹配 (AND 逻辑)
        const allMatch = searchTerms.every(term => text.includes(term));
        if (allMatch) {
          matchedIds.push(id);
        }

        cursor.continue();
      };

      request.onerror = () => reject(new Error('搜索失败'));
    });
  }

  /**
   * 批量构建搜索索引 (用于首次初始化)
   * @param {Array} records
   * @returns {Promise<void>}
   */
  async bulkSearchIndex(records) {
    if (!this._db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._indexStoreName, 'readwrite');
      const store = tx.objectStore(this._indexStoreName);

      for (const record of records) {
        const plainNotes = record.notes
          ? record.notes.replace(/<[^>]*>/g, ' ').replace(/&\w+;/g, ' ')
          : '';
        const tagsText = Array.isArray(record.tags) ? record.tags.join(' ') : '';
        const searchText = `${record.name || ''} ${plainNotes} ${tagsText}`.toLowerCase().trim();

        store.put({
          id: record.id,
          text: searchText,
          updatedAt: record.updatedAt || Date.now()
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('批量索引失败'));
    });
  }

  /**
   * 重建搜索索引 (从 records store 读取全部记录，重建 searchIndex)
   * 用于索引损坏恢复或 schema 升级后重建
   * @returns {Promise<{ok: boolean, rebuilt: number}>}
   */
  async rebuildSearchIndex() {
    if (!this._db) await this.init();

    return new Promise((resolve, reject) => {
      // 先读取所有记录
      const readTx = this._db.transaction(this._storeName, 'readonly');
      const readStore = readTx.objectStore(this._storeName);
      const allRecords = [];

      const readReq = readStore.openCursor();
      readReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          // 读取完成，开始重建
          this._rebuildIndex(allRecords).then(resolve).catch(reject);
          return;
        }
        allRecords.push(cursor.value);
        cursor.continue();
      };
      readReq.onerror = () => reject(new Error('读取记录失败'));
    });
  }

  /**
   * 内部方法：清空并重建搜索索引
   * @private
   */
  async _rebuildIndex(records) {
    if (!this._db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._indexStoreName, 'readwrite');
      const store = tx.objectStore(this._indexStoreName);

      // 先清空
      store.clear();

      // 重新索引
      for (const record of records) {
        const plainNotes = record.notes
          ? record.notes.replace(/<[^>]*>/g, ' ').replace(/&\w+;/g, ' ')
          : '';
        const tagsText = Array.isArray(record.tags) ? record.tags.join(' ') : '';
        const searchText = `${record.name || ''} ${plainNotes} ${tagsText}`.toLowerCase().trim();

        store.put({
          id: record.id,
          text: searchText,
          updatedAt: record.updatedAt || Date.now()
        });
      }

      tx.oncomplete = () => resolve({ ok: true, rebuilt: records.length });
      tx.onerror = () => reject(new Error('重建索引失败'));
    });
  }

  /**
   * 根据 ID 列表从 records store 获取完整记录
   * @private
   */
  async _getRecordsByIds(ids) {
    if (ids.length === 0) return [];

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._storeName, 'readonly');
      const store = tx.objectStore(this._storeName);
      const results = [];

      let pending = ids.length;
      if (pending === 0) {
        resolve([]);
        return;
      }

      for (const id of ids) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) results.push(req.result);
          pending--;
          if (pending === 0) resolve(results);
        };
        req.onerror = () => {
          pending--;
          if (pending === 0) resolve(results);
        };
      }
    });
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
   * 兼容旧版 StorageBackend.save() API
   * @param {Array} records
   * @returns {Promise<void>}
   */
  async save(records) {
    if (Array.isArray(records)) {
      return this.bulkPut(records);
    }
    // 单条记录也支持
    return this.put(records);
  }

  /**
   * 兼容旧版 StorageBackend.migrateFromLocalStorage() API
   * 空实现，因为迁移应由一次性脚本完成
   * @returns {Promise<number>}
   */
  async migrateFromLocalStorage() {
    console.warn('[StorageService] migrateFromLocalStorage 已废弃，请使用一次性迁移脚本');
    return 0;
  }

  /**
   * 按日期范围查询记录
   * @param {number} from - 起始时间戳
   * @param {number} to - 结束时间戳
   * @returns {Promise<Array>}
   */
  async getByDateRange(from, to) {
    if (!this._db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(this._storeName, 'readonly');
      const store = tx.objectStore(this._storeName);
      const index = store.index('updatedAt');
      const results = [];

      // 使用游标遍历 updatedAt 索引
      const range = IDBKeyRange.bound(from, to);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          // 按 createdAt 降序排序
          results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          resolve(results);
        }
      };
      request.onerror = () => reject(new Error('日期范围查询失败'));
    });
  }

  /**
   * 按月份和日期查询记录（那年今日）
   * @param {number} month - 月份 (1-12)
   * @param {number} day - 日期 (1-31)
   * @returns {Promise<Array>} - 返回 month/day 匹配但年份不同的记录
   */
  async getByMonthDay(month, day) {
    const all = await this.getAll();
    const today = new Date();
    const currentYear = today.getFullYear();

    return all.filter(record => {
      const date = new Date(record.createdAt);
      if (isNaN(date.getTime())) return false;
      // 匹配月日，排除今年
      return date.getMonth() + 1 === month && date.getDate() === day && date.getFullYear() !== currentYear;
    }).sort((a, b) => {
      // 按年份降序（最近的年份在前）
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /**
   * P2-2: 获取与指定记录有关联的所有记录
   * 包括: 该记录链接到的记录 (outgoing) + 链接到该记录的其他记录 (incoming)
   * @param {string} id - 记录 ID
   * @param {Array} [allRecords] - 可选的所有记录列表 (用于反向链接查询)
   * @returns {Promise<{outgoing: Array, incoming: Array, outgoingLinks: Array, incomingLinks: Array}>}
   */
  async getLinkedRecords(id, allRecords) {
    if (!this._db) await this.init();

    const result = {
      outgoing: [],      // 该记录链接到的记录
      incoming: [],      // 链接到该记录的其他记录
      outgoingLinks: [], // 链接详情
      incomingLinks: []  // 反向链接详情
    };

    // 1. 获取当前记录 (outgoing links)
    const currentRecord = await this.get(id);
    if (currentRecord && currentRecord.links && currentRecord.links.length > 0) {
      for (const link of currentRecord.links) {
        const target = await this.get(link.targetId);
        if (target) {
          result.outgoing.push(target);
          result.outgoingLinks.push(link);
        }
      }
    }

    // 2. 反向链接: 查找其他记录中 links 包含当前记录 ID 的
    // 优先使用传入的 allRecords (内存查询)，否则使用 IndexedDB 游标
    if (allRecords && allRecords.length > 0) {
      for (const record of allRecords) {
        if (record.id === id) continue;
        if (record.links && record.links.some(l => l.targetId === id)) {
          result.incoming.push(record);
          // 找出具体链接信息
          const matchingLinks = record.links.filter(l => l.targetId === id);
          result.incomingLinks.push(...matchingLinks.map(l => ({
            ...l,
            sourceName: record.name || '未命名'
          })));
        }
      }
    } else {
      // 使用 IndexedDB cursor 遍历
      const tx = this._db.transaction(this._storeName, 'readonly');
      const store = tx.objectStore(this._storeName);
      const request = store.openCursor();

      await new Promise((resolve) => {
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) {
            resolve();
            return;
          }
          const record = cursor.value;
          if (record.id !== id && record.links && record.links.some(l => l.targetId === id)) {
            result.incoming.push(record);
            const matchingLinks = record.links.filter(l => l.targetId === id);
            result.incomingLinks.push(...matchingLinks.map(l => ({
              ...l,
              sourceName: record.name || '未命名'
            })));
          }
          cursor.continue();
        };
      });
    }

    return result;
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

  // ========== Markdown 导入/导出 ==========

  /**
   * HTML 转 Markdown
   * @param {string} html
   * @returns {string}
   */
  _htmlToMarkdown(html) {
    if (!html) return '';
    let md = html;
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
    md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');
    md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n');
    md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n');
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    md = md.replace(/<br\s*\/?>/gi, '\n');
    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n');
    md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```\n');
    md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, c) => c.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n'));
    md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, c) => {
      let idx = 0;
      return c.replace(/<li[^>]*>(.*?)<\/li>/gi, () => { idx++; return idx + '. $1\n'; });
    });
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
    md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
    md = md.replace(/<[^>]*>/g, '');
    md = md.replace(/&nbsp;/g, ' ');
    md = md.replace(/&amp;/g, '&');
    md = md.replace(/&lt;/g, '<');
    md = md.replace(/&gt;/g, '>');
    md = md.replace(/&quot;/g, '"');
    md = md.replace(/&#39;/g, "'");
    md = md.replace(/\n{3,}/g, '\n\n');
    return md.trim();
  }

  /**
   * Markdown 转 HTML
   * @param {string} md
   * @returns {string}
   */
  _markdownToHtml(md) {
    if (!md) return '';
    let html = md;
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => '<pre>' + code.trim() + '</pre>');
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, '<ul>$1</ul>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');
    return html.trim();
  }

  /**
   * 解析单条 Markdown 记录 (frontmatter + body)
   * @param {string} content
   * @returns {{frontmatter: Object, body: string} | null}
   */
  _parseMarkdownRecord(content) {
    const trimmed = content.trim();
    if (!trimmed.startsWith('---')) return null;
    const secondDash = trimmed.indexOf('---', 3);
    if (secondDash === -1) return null;

    const fmBlock = trimmed.substring(3, secondDash).trim();
    const body = trimmed.substring(secondDash + 3).trim();
    const fm = {};

    for (const line of fmBlock.split('\n')) {
      const ci = line.indexOf(':');
      if (ci === -1) continue;
      let key = line.substring(0, ci).trim();
      let value = line.substring(ci + 1).trim();
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      fm[key] = value;
    }

    return { frontmatter: fm, body };
  }

  /**
   * 导出所有记录为 Markdown 字符串
   * @returns {Promise<string>}
   */
  async exportMarkdown() {
    const records = await this.getAll();
    const parts = [];
    for (const r of records) {
      parts.push(this._buildMarkdownRecord(r));
    }
    return parts.join('\n\n---\n\n');
  }

  /**
   * 构建单条记录的 Markdown
   * @param {Object} record
   * @returns {string}
   */
  _buildMarkdownRecord(record) {
    const lines = ['---'];
    lines.push('name: "' + (record.name || '').replace(/"/g, '\\"') + '"');
    lines.push('date: ' + (record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString()));
    lines.push('updatedAt: ' + (record.updatedAt ? new Date(record.updatedAt).toISOString() : ''));
    lines.push('favorite: ' + (record.favorite || false));
    if (record.status) lines.push('status: "' + record.status + '"');
    if (record.tags && record.tags.length > 0) {
      const ts = record.tags.map(t => '"' + t.replace(/"/g, '\\"') + '"').join(', ');
      lines.push('tags: [' + ts + ']');
    }
    if (record.location) lines.push('location: "' + record.location + '"');
    lines.push('---');
    lines.push('');
    const notesMd = this._htmlToMarkdown(record.notes || '');
    if (notesMd) lines.push(notesMd);
    if (record.photos && record.photos.length > 0) {
      lines.push('');
      lines.push('### 照片');
      lines.push('');
      for (const photo of record.photos) {
        const src = typeof photo === 'string' ? photo : (photo.dataUrl || photo.src || '');
        const cap = typeof photo === 'object' ? (photo.caption || '') : '';
        lines.push('![' + cap + '](' + src + ')');
      }
    }
    return lines.join('\n');
  }

  /**
   * 从 Markdown 内容导入记录
   * @param {string} content
   * @returns {Promise<{total: number, success: number, failed: number, records: Array, conflicts: Array}>}
   */
  async importMarkdown(content) {
    const sections = this._splitMarkdownRecords(content);
    const result = { total: 0, success: 0, failed: 0, records: [], conflicts: [] };
    const existing = await this.getAll();

    for (const section of sections) {
      result.total++;
      try {
        const parsed = this._parseMarkdownRecord(section);
        if (!parsed) { result.failed++; continue; }

        const { frontmatter: fm, body } = parsed;
        const html = this._markdownToHtml(body);
        const recordDate = fm.date ? new Date(fm.date).toISOString().split('T')[0] : '';
        const recordName = fm.name || '';

        const conflict = existing.find(r => {
          const eDate = r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '';
          return r.name === recordName && eDate === recordDate && recordName !== '';
        });

        if (conflict) {
          result.conflicts.push({
            name: recordName, date: recordDate,
            incoming: {
              name: recordName, notes: html,
              tags: Array.isArray(fm.tags) ? fm.tags : [],
              favorite: fm.favorite === true || fm.favorite === 'true',
              createdAt: fm.date ? new Date(fm.date).getTime() : Date.now(),
              updatedAt: fm.updatedAt ? new Date(fm.updatedAt).getTime() : Date.now(),
              status: fm.status || 'in-use', photos: [],
              location: fm.location || ''
            },
            existing: {
              id: conflict.id, name: conflict.name,
              date: conflict.createdAt ? new Date(conflict.createdAt).toISOString().split('T')[0] : ''
            }
          });
          continue;
        }

        const record = {
          id: 'md_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
          name: recordName,
          tags: Array.isArray(fm.tags) ? fm.tags : [],
          notes: html,
          photos: [],
          location: fm.location || '',
          favorite: fm.favorite === true || fm.favorite === 'true',
          status: fm.status || 'in-use',
          createdAt: fm.date ? new Date(fm.date).getTime() : Date.now(),
          updatedAt: fm.updatedAt ? new Date(fm.updatedAt).getTime() : Date.now()
        };

        await this.put(record);
        result.success++;
        result.records.push(record);
      } catch (e) {
        result.failed++;
        console.warn('[StorageService] Markdown import record failed:', e);
      }
    }

    return result;
  }

  /**
   * 分割 Markdown 内容为多条记录
   * @param {string} content
   * @returns {Array<string>}
   */
  _splitMarkdownRecords(content) {
    const sections = [];
    let current = '';
    let inFm = false;
    let foundFirst = false;
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim() === '---') {
        if (!foundFirst) {
          foundFirst = true;
          inFm = true;
          current = line + '\n';
        } else if (inFm) {
          inFm = false;
          current += line + '\n';
        } else {
          if (current.trim()) sections.push(current.trim());
          current = '---\n';
          inFm = true;
        }
      } else {
        current += line + '\n';
      }
    }
    if (current.trim()) sections.push(current.trim());
    return sections;
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

// 兼容旧版 StorageBackend 别名 (Phase 1 过渡期)
// StorageService 是实例，StorageBackend 需要指向同一个实例
// 但 app.js 中 StorageBackend 是一个 class，需要等 StorageService 实例化后覆盖
Object.defineProperty(window, 'StorageBackend', {
  get: function() { return window.StorageService; },
  set: function(val) { /* 忽略，防止覆盖 */ },
  configurable: true
});

console.log('[StorageService] 存储服务已定义');
