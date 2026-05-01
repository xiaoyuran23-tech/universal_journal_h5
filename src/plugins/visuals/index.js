/**
 * Visuals Plugin - 数据可视化
 * 替代 js/visuals.js
 * @version 6.1.0
 */

if (!window.VisualsPlugin) {
const VisualsPlugin = {
  name: 'visuals',
  version: '1.0.0',
  dependencies: ['records'],

  _eventsBound: false,
  _unsubscribe: null,

  async init() {
    console.log('[VisualsPlugin] Initializing...');
  },

  async start() {
    console.log('[VisualsPlugin] Starting...');
    this._renderVisuals();

    // 订阅记录变化
    if (window.Store) {
      this._unsubscribe = window.Store.subscribe((newState, prevState) => {
        if (newState.records !== prevState.records) {
          this._renderVisuals();
        }
      });
    }
  },

  stop() {
    if (typeof this._unsubscribe === 'function') {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this._eventsBound = false;
  },

  _renderVisuals() {
    const records = window.Store ? window.Store.getState('records.list') : [];
    const container = document.getElementById('visuals-container');
    if (!container) return;

    if (!records || records.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>暂无数据，快去记录生活吧！</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="visuals-header"><h3>数据统计</h3></div>
      <div class="visuals-summary">
        <div>共 <strong>${records.length}</strong> 条记录</div>
      </div>
      <div class="visuals-section">
        <h4>活动热力图 (近一年)</h4>
        <div id="heatmap-container"></div>
      </div>
      <div class="visuals-section">
        <h4>月度记录趋势</h4>
        <div id="trend-container"></div>
      </div>
      <div class="visuals-section">
        <h4>标签占比</h4>
        <div id="category-container"></div>
      </div>
    `;

    this._renderHeatmap(records, document.getElementById('heatmap-container'));
    this._renderTrends(records, document.getElementById('trend-container'));
    this._renderTagDistribution(records, document.getElementById('category-container'));
  },

  _renderHeatmap(items, container) {
    if (!container || !items) return;

    const counts = {};
    let maxCount = 0;
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      counts[key] = 0;
    }

    items.forEach(item => {
      const d = new Date(item.date || item.createdAt);
      if (d >= oneYearAgo && d <= today) {
        const key = d.toISOString().split('T')[0];
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] > maxCount) maxCount = counts[key];
      }
    });

    const weeks = [];
    let currentWeek = [];
    const startDate = new Date(oneYearAgo);
    const dayOfWeek = startDate.getDay();
    for (let i = 0; i < dayOfWeek; i++) currentWeek.push(null);

    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      currentWeek.push({ date: key, count: counts[key] || 0 });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    let html = '<div class="heatmap-grid">';
    weeks.forEach(week => {
      week.forEach(day => {
        if (!day) {
          html += '<div class="heatmap-cell empty"></div>';
        } else {
          let level = 'level-0';
          if (day.count >= 1) level = 'level-1';
          if (day.count >= 3) level = 'level-2';
          if (day.count >= 5) level = 'level-3';
          html += `<div class="heatmap-cell ${level}" title="${day.date}: ${day.count}条"></div>`;
        }
      });
    });
    html += '</div>';
    html += '<div class="heatmap-legend">少 <span class="legend-cell level-0"></span><span class="legend-cell level-1"></span><span class="legend-cell level-2"></span><span class="legend-cell level-3"></span> 多</div>';
    container.innerHTML = html;
  },

  _renderTrends(items, container) {
    if (!container || !items) return;

    const monthCounts = {};
    const monthLabels = [];
    const today = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.getMonth() + 1}月`;
      monthCounts[key] = 0;
      monthLabels.push({ key, label });
    }

    items.forEach(item => {
      const d = new Date(item.date || item.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthCounts.hasOwnProperty(key)) monthCounts[key]++;
    });

    const max = Math.max(...Object.values(monthCounts), 1);

    let html = '<div class="trend-chart">';
    monthLabels.forEach(m => {
      const count = monthCounts[m.key];
      const heightPercent = (count / max) * 100;
      html += `
        <div class="trend-bar-wrapper">
          <div class="trend-bar" style="height: ${heightPercent}%;" title="${m.label}: ${count}条"></div>
          <div class="trend-label">${m.label}</div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  },

  _renderTagDistribution(items, container) {
    if (!container || !items) return;

    const counts = {};
    let total = 0;
    items.forEach(item => {
      const tag = (item.tags && item.tags.length > 0) ? item.tags[0] : '无标签';
      counts[tag] = (counts[tag] || 0) + 1;
      total++;
    });

    if (total === 0) {
      container.innerHTML = '<div class="empty-state"><p>暂无标签数据</p></div>';
      return;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    let html = '<div class="category-list">';
    sorted.forEach(([tag, count]) => {
      const percent = ((count / total) * 100).toFixed(1);
      html += `
        <div class="category-item">
          <div class="category-info">
            <span class="category-name">${this._escapeHtml(tag)}</span>
            <span class="category-count">${count}条 (${percent}%)</span>
          </div>
          <div class="category-bar-bg">
            <div class="category-bar-fill" style="width: ${percent}%;"></div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  },

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.VisualsPlugin = VisualsPlugin;
console.log('[VisualsPlugin] 数据可视化插件已定义');
}
