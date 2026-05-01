/**
 * MetadataService - 自动从记录中提取元数据
 * 提取内容: 字数、阅读时间、情绪标签、摘要、是否有照片、是否有位置
 * 纯原生 JS 实现，无外部依赖
 * @version 6.3.0
 */

if (!window.MetadataService) {
class MetadataService {
  /**
   * 情绪关键词映射 (规则匹配)
   */
  static EMOTION_KEYWORDS = {
    '开心': '开心', '难过': '难过', '平静': '平静', '兴奋': '兴奋',
    '悲伤': '悲伤', '愤怒': '愤怒', '惊喜': '惊喜', '焦虑': '焦虑',
    '放松': '放松', '期待': '期待',
    'happy': '开心', 'sad': '悲伤', 'angry': '愤怒', 'excited': '兴奋',
    'calm': '平静', 'anxious': '焦虑', 'relaxed': '放松',
    'surprised': '惊喜', 'nervous': '焦虑', 'hopeful': '期待'
  };

  /**
   * 从记录中提取全部元数据
   * @param {Object} record - 记录对象 { notes, photos, location, ... }
   * @returns {Object} metadata: { wordCount, readingTime, emotionTags, summary, hasPhotos, hasLocation }
   */
  static extract(record) {
    if (!record) {
      return MetadataService._defaults();
    }

    const plainText = MetadataService._stripHTML(record.notes || '');
    const wordCount = MetadataService._countWords(plainText);
    const readingTime = MetadataService._calcReadingTime(plainText);
    const emotionTags = MetadataService._detectEmotions(plainText);
    const summary = MetadataService._extractSummary(plainText);
    const hasPhotos = Array.isArray(record.photos) && record.photos.length > 0;
    const hasLocation = !!(record.location);

    return {
      wordCount,
      readingTime,
      emotionTags,
      summary,
      hasPhotos,
      hasLocation
    };
  }

  /**
   * 去除 HTML 标签，转为纯文本
   * @param {string} html
   * @returns {string}
   */
  static _stripHTML(html) {
    if (!html) return '';
    // 将 <br>、<p>、<div> 等块级元素替换为换行，然后去除所有标签
    let text = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|li|tr|h[1-6]|blockquote)[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      // 解码常见 HTML entity
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&\w+;/g, ' ');
    // 合并多余空白
    return text.replace(/[ \t]+/g, ' ').trim();
  }

  /**
   * 统计字数: 中文字符 + 英文单词
   * @param {string} text
   * @returns {number}
   */
  static _countWords(text) {
    if (!text) return 0;
    // 中文字符 (含日文/韩文 CJK 范围)
    const chineseChars = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    // 英文单词 (连续的字母/数字)
    const englishWords = (text.match(/[a-zA-Z0-9]+/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 计算预估阅读时间 (分钟)
   * 中文 300 字/分钟, 英文 200 词/分钟
   * @param {string} text
   * @returns {number} 分钟数
   */
  static _calcReadingTime(text) {
    if (!text) return 0;
    const chineseChars = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const chineseMinutes = chineseChars / 300;
    const englishMinutes = englishWords / 200;
    const total = chineseMinutes + englishMinutes;
    // 不足 1 分钟按 1 分钟计
    return Math.max(1, Math.ceil(total));
  }

  /**
   * 检测情绪标签 (关键词匹配)
   * @param {string} text
   * @returns {Array<string>} 去重后的情绪标签列表
   */
  static _detectEmotions(text) {
    if (!text) return [];
    const lowerText = text.toLowerCase();
    const found = new Set();
    for (const [keyword, tag] of Object.entries(MetadataService.EMOTION_KEYWORDS)) {
      if (lowerText.includes(keyword.toLowerCase())) {
        found.add(tag);
      }
    }
    return Array.from(found);
  }

  /**
   * 提取摘要: 前 100 个字符的纯文本
   * @param {string} text
   * @returns {string}
   */
  static _extractSummary(text) {
    if (!text) return '';
    const maxLen = 100;
    if (text.length <= maxLen) return text;
    // 在前 100 字符处截断，避免截断在单词中间
    let summary = text.substring(0, maxLen);
    // 如果截断处后面还有非空格字符，加省略号
    if (text.length > maxLen && !/\s$/.test(summary)) {
      summary += '...';
    }
    return summary;
  }

  /**
   * 默认元数据
   * @returns {Object}
   */
  static _defaults() {
    return {
      wordCount: 0,
      readingTime: 0,
      emotionTags: [],
      summary: '',
      hasPhotos: false,
      hasLocation: false
    };
  }
}

window.MetadataService = MetadataService;
console.log('[MetadataService] 元数据提取服务已定义');
} else {
  console.log('[MetadataService] 已存在，跳过加载');
}
