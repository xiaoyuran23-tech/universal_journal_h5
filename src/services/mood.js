/**
 * MoodService - 心情追踪与趋势分析
 * @version 7.0.0
 */

if (!window.MoodService) {
const MoodService = {
  STORAGE_KEY: 'journal_mood_data',

  // 心情定义
  MOODS: [
    { key: 'great', emoji: '😄', label: '很棒', color: '#16a34a' },
    { key: 'good', emoji: '😊', label: '不错', color: '#059669' },
    { key: 'neutral', emoji: '😐', label: '一般', color: '#d97706' },
    { key: 'bad', emoji: '😟', label: '糟糕', color: '#dc2626' },
    { key: 'awful', emoji: '😫', label: '极差', color: '#7c3aed' }
  ],

  /**
   * 记录今天的心情
   */
  recordMood(mood, note = '') {
    const today = new Date().toISOString().split('T')[0];
    const data = this.getHistory();
    data[today] = { mood, note, at: new Date().toISOString() };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  /**
   * 获取今天的心情
   */
  getTodayMood() {
    const today = new Date().toISOString().split('T')[0];
    const data = this.getHistory();
    return data[today] || null;
  },

  /**
   * 获取心情历史
   */
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
    } catch { return {}; }
  },

  /**
   * 获取最近 N 天的心情趋势
   */
  getTrend(days = 30) {
    const history = this.getHistory();
    const result = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const entry = history[key];
      if (entry) {
        result.push({ date: key, ...entry });
      }
    }

    return result;
  },

  /**
   * 获取心情分布统计
   */
  getStats(days = 30) {
    const trend = this.getTrend(days);
    const stats = {};
    this.MOODS.forEach(m => { stats[m.key] = 0; });
    trend.forEach(t => { if (stats[t.mood] !== undefined) stats[t.mood]++; });
    return { total: trend.length, stats, trend };
  },

  /**
   * 获取心情对象配置
   */
  getMoodByKey(key) {
    return this.MOODS.find(m => m.key === key) || { key, emoji: '❓', label: '未知', color: '#999' };
  },

  /**
   * 渲染心情选择器 HTML
   */
  renderPicker(selectedKey = '') {
    return `<div class="mood-picker" data-mood-picker>
      ${this.MOODS.map(m => `
        <div class="mood-option ${m.key === selectedKey ? 'selected' : ''}"
             data-mood="${m.key}" title="${m.label}">
          ${m.emoji}
        </div>
      `).join('')}
    </div>`;
  },

  /**
   * 渲染心情标签
   */
  renderBadge(moodKey) {
    const mood = this.getMoodByKey(moodKey);
    return `<span class="mood-badge ${mood.key}">${mood.emoji} ${mood.label}</span>`;
  }
};

window.MoodService = MoodService;
console.log('[MoodService] 心情追踪服务已加载');
}
