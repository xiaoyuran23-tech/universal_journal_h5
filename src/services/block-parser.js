/**
 * BlockParser - HTML 笔记解析为块级数据模型
 * 将 HTML 内容解析为结构化 blocks 数组，支持反向渲染
 * @version 6.3.0
 */

class BlockParser {
  /**
   * 将 HTML 内容解析为 blocks 数组
   * @param {string} html - HTML 内容
   * @returns {Array<{type: string, content: string}>}
   */
  static parseBlocks(html) {
    if (!html || !html.trim()) return [];

    const blocks = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    // 遍历顶层子节点
    this._processNodes(body.childNodes, blocks);

    return blocks;
  }

  /**
   * 递归处理 DOM 节点
   * @private
   */
  static _processNodes(nodeList, blocks) {
    for (const node of nodeList) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          blocks.push({ type: 'paragraph', content: text });
        }
        continue;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = node.tagName.toLowerCase();

      // 标题
      if (tag === 'h1') {
        blocks.push({ type: 'heading', content: node.innerHTML, level: 1 });
      } else if (tag === 'h2') {
        blocks.push({ type: 'heading', content: node.innerHTML, level: 2 });
      } else if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        const level = parseInt(tag.charAt(1));
        blocks.push({ type: 'heading', content: node.innerHTML, level });
      }
      // 段落
      else if (tag === 'p') {
        const text = node.textContent.trim();
        if (text) {
          blocks.push({ type: 'paragraph', content: node.innerHTML });
        }
      }
      // 无序列表
      else if (tag === 'ul') {
        const items = Array.from(node.querySelectorAll('li')).map(li => li.innerHTML);
        blocks.push({ type: 'list', content: items.join('\n'), listType: 'ul' });
      }
      // 有序列表
      else if (tag === 'ol') {
        const items = Array.from(node.querySelectorAll('li')).map(li => li.innerHTML);
        blocks.push({ type: 'list', content: items.join('\n'), listType: 'ol' });
      }
      // 引用
      else if (tag === 'blockquote') {
        blocks.push({ type: 'quote', content: node.innerHTML });
      }
      // 图片
      else if (tag === 'img') {
        blocks.push({ type: 'image', content: node.outerHTML, src: node.getAttribute('src') || '' });
      }
      // 分割线
      else if (tag === 'hr') {
        blocks.push({ type: 'divider', content: '' });
      }
      // div / 其他容器: 递归处理子节点
      else if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'span') {
        // 检查是否只有纯文本
        if (node.children.length === 0 && node.textContent.trim()) {
          blocks.push({ type: 'paragraph', content: node.textContent.trim() });
        } else {
          this._processNodes(node.childNodes, blocks);
        }
      }
      // br 转为段落分隔
      else if (tag === 'br') {
        // 忽略单独的 br，由段落处理
      }
      // strong/em/code 等行内元素，包裹为段落
      else if (tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i' || tag === 'code' || tag === 'a') {
        blocks.push({ type: 'paragraph', content: node.outerHTML });
      }
      // 其他未知元素，递归处理
      else {
        this._processNodes(node.childNodes, blocks);
      }
    }
  }

  /**
   * 将 blocks 数组渲染回 HTML 字符串
   * @param {Array<{type: string, content: string}>} blocks
   * @returns {string}
   */
  static renderBlocks(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return '';

    return blocks.map(block => {
      switch (block.type) {
        case 'paragraph':
          return `<p>${block.content}</p>`;
        case 'heading':
          const level = block.level || 3;
          return `<h${level}>${block.content}</h${level}>`;
        case 'list':
          const listTag = block.listType === 'ol' ? 'ol' : 'ul';
          const items = block.content.split('\n').map(item => `<li>${item}</li>`).join('');
          return `<${listTag}>${items}</${listTag}>`;
        case 'quote':
          return `<blockquote>${block.content}</blockquote>`;
        case 'image':
          return block.content;
        case 'divider':
          return '<hr>';
        default:
          return block.content;
      }
    }).join('');
  }

  /**
   * 计算块的数量
   * @param {Array} blocks
   * @returns {number}
   */
  static countBlocks(blocks) {
    return Array.isArray(blocks) ? blocks.length : 0;
  }

  /**
   * 获取纯文本内容 (从 blocks)
   * @param {Array} blocks
   * @returns {string}
   */
  static toPlainText(blocks) {
    if (!Array.isArray(blocks)) return '';
    return blocks
      .filter(b => b.type !== 'divider' && b.type !== 'image')
      .map(b => {
        if (b.type === 'list') {
          return b.content.split('\n').map(item => {
            // 去除内嵌 HTML 标签
            return item.replace(/<[^>]*>/g, '').trim();
          }).join(', ');
        }
        // 去除 HTML 标签
        return b.content.replace(/<[^>]*>/g, '').trim();
      })
      .filter(Boolean)
      .join('\n');
  }
}

window.BlockParser = BlockParser;
console.log('[BlockParser] 块解析器已定义');
