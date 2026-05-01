/**
 * LinkParser - 双向链接解析服务
 * 从 HTML 内容中解析 [[record-name]] 或 [[record-id]] 格式的双向链接
 * @version 6.3.0
 */

class LinkParser {
  // 匹配 [[...]] 格式
  static LINK_REGEX = /\[\[([^\]]+)\]\]/g;

  /**
   * 从 HTML 内容中解析链接
   * @param {string} html - HTML 内容
   * @param {Array} allRecords - 所有记录列表 (用于匹配 name/id)
   * @param {string} sourceId - 当前记录的 ID
   * @returns {Array<{sourceId: string, targetId: string, sourceName: string, targetName: string, linkText: string}>}
   */
  static parseLinks(html, allRecords, sourceId) {
    if (!html || !allRecords || !sourceId) return [];

    const links = [];
    const seen = new Set();
    let match;

    // 重置正则
    const regex = new RegExp(this.LINK_REGEX.source, 'g');

    while ((match = regex.exec(html)) !== null) {
      const linkText = match[1].trim();
      if (!linkText || seen.has(linkText)) continue;
      seen.add(linkText);

      // 尝试匹配目标记录: 先按 name 精确匹配，再按 id 匹配，最后模糊匹配
      const target = this._findRecord(linkText, allRecords);
      if (target && target.id !== sourceId) {
        links.push({
          sourceId,
          targetId: target.id,
          sourceName: '', // 调用方填充
          targetName: target.name || '未命名',
          linkText
        });
      }
    }

    return links;
  }

  /**
   * 查找目标记录
   * @private
   */
  static _findRecord(query, allRecords) {
    // 1. 精确按 name 匹配
    let found = allRecords.find(r => r.name === query);
    if (found) return found;

    // 2. 按 id 匹配
    found = allRecords.find(r => r.id === query);
    if (found) return found;

    // 3. 模糊匹配 name (不区分大小写)
    const lowerQuery = query.toLowerCase();
    found = allRecords.find(r => r.name && r.name.toLowerCase() === lowerQuery);
    if (found) return found;

    // 4. 子串匹配
    found = allRecords.find(r => r.name && r.name.toLowerCase().includes(lowerQuery));
    return found || null;
  }

  /**
   * 查找所有链接到指定记录的其他记录 (反向链接)
   * @param {string} targetId - 目标记录 ID
   * @param {Array} allRecords - 所有记录列表
   * @returns {Array<{sourceId: string, sourceName: string, linkText: string}>}
   */
  static findBacklinks(targetId, allRecords) {
    if (!targetId || !allRecords) return [];

    const backlinks = [];

    for (const record of allRecords) {
      if (record.id === targetId) continue;
      if (!record.notes) continue;

      const regex = new RegExp(this.LINK_REGEX.source, 'g');
      let match;

      while ((match = regex.exec(record.notes)) !== null) {
        const linkText = match[1].trim();
        const target = this._findRecord(linkText, allRecords);
        if (target && target.id === targetId) {
          backlinks.push({
            sourceId: record.id,
            sourceName: record.name || '未命名',
            linkText
          });
          break; // 每条记录只需要一个链接
        }
      }
    }

    return backlinks;
  }

  /**
   * 在 HTML 中渲染链接 (将 [[name]] 替换为可点击的链接)
   * @param {string} html - HTML 内容
   * @param {Array} allRecords - 所有记录列表
   * @returns {string} - 渲染后的 HTML
   */
  static renderLinksWithTargets(html, allRecords) {
    if (!html || !allRecords) return html || '';

    return html.replace(this.LINK_REGEX, (fullMatch, linkText) => {
      const target = this._findRecord(linkText.trim(), allRecords);
      if (target) {
        return `<a href="#" class="wiki-link" data-target-id="${target.id}" data-target-name="${this._escape(target.name)}">${this._escape(linkText.trim())}</a>`;
      }
      // 未找到目标，保留原始文本但标记为 broken
      return `<span class="wiki-link-broken" title="未找到: ${this._escape(linkText.trim())}">${this._escape(linkText.trim())}</span>`;
    });
  }

  /**
   * 提取所有链接文本 (不解析目标)
   * @param {string} html
   * @returns {Array<string>}
   */
  static extractLinkTexts(html) {
    if (!html) return [];
    const texts = [];
    const regex = new RegExp(this.LINK_REGEX.source, 'g');
    let match;
    while ((match = regex.exec(html)) !== null) {
      const text = match[1].trim();
      if (text) texts.push(text);
    }
    return texts;
  }

  static _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.LinkParser = LinkParser;
console.log('[LinkParser] 双向链接解析器已定义');
