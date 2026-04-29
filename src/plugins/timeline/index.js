/**
 * Timeline Plugin - 时间线/故事模式插件
 * 按时间轴展示记录，支持"那年今日"功能
 * @version 6.0.0
 */

// 幂等加载保护
if (!window.TimelinePlugin) {
const TimelinePlugin = {
  name: 'timeline',
  version: '1.0.0',
  dependencies: ['records'],
  
  _eventsBound: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[TimelinePlugin] Initializing...');
    
    this.routes = [
      {
        path: 'timeline',
        title: '故事',
        component: 'timeline-view'
      }
    ];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[TimelinePlugin] Starting...');
    this._bindEvents();
    this._render();
    
    // 订阅记录变化
    if (window.Store) {
      window.Store.subscribe((newState, prevState) => {
        if (newState.records !== prevState.records) {
          this._render();
        }
      });
    }
  },

  /**
   * 停止插件
   */
  stop() {
    console.log('[TimelinePlugin] Stopping...');
    this._eventsBound = false;
  },

  /**
   * 路由定义
   */
  routes: [],

  /**
   * Actions
   */
  actions: {},

  /**
   * 渲染时间线
   * @private
   */
  _render() {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    const records = window.Store ? window.Store.getState('records.list') : [];

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>还没有记录，去添加一条吧！</p>
        </div>
      `;
      return;
    }

    // 按日期排序 (新的在前)
    const sortedItems = [...records].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateB - dateA;
    });

    // 分组：年 -> 月
    const groups = {};
    sortedItems.forEach(item => {
      const date = new Date(item.date || item.createdAt || 0);
      if (isNaN(date.getTime())) return;
      
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!groups[year]) groups[year] = {};
      if (!groups[year][month]) groups[year][month] = [];
      groups[year][month].push(item);
    });

    // 构建 HTML
    let html = '';

    // 那年今日
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    
    const onThisDayItems = sortedItems.filter(item => {
      const d = new Date(item.date || item.createdAt || 0);
      if (isNaN(d.getTime())) return false;
      return d.getMonth() === todayMonth && 
             d.getDate() === todayDay && 
             d.getFullYear() !== today.getFullYear();
    });

    if (onThisDayItems.length > 0) {
      html += `<div class="timeline-section on-this-day">
        <h3>🕰️ 那年今日</h3>
        <div class="timeline-items">`;
      
      onThisDayItems.forEach(item => {
        html += this._renderItemCard(item, true);
      });

      html += `</div></div>`;
    }

    // 全部时间线
    html += `<div class="timeline-section all-stories">
      <h3>📅 全部故事</h3>`;

    // 遍历年份 (倒序)
    const years = Object.keys(groups).sort((a, b) => b - a);

    years.forEach(year => {
      const months = Object.keys(groups[year]).sort((a, b) => b - a);
      
      html += `<div class="timeline-year">
        <h4>${year}年</h4>`;
      
      months.forEach(month => {
        const monthName = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'][parseInt(month)];
        
        html += `<div class="timeline-month">
          <h5>${monthName}</h5>
          <div class="timeline-items">`;
        
        groups[year][month].forEach(item => {
          html += this._renderItemCard(item);
        });
        
        html += `</div></div>`;
      });
      
      html += `</div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
  },

  /**
   * 渲染记录卡片
   * @param {Object} item - 记录对象
   * @param {boolean} isOnThisDay - 是否那年今日
   * @returns {string} HTML
   * @private
   */
  _renderItemCard(item, isOnThisDay = false) {
    const date = new Date(item.date || item.createdAt || 0);
    const dateStr = isNaN(date.getTime()) ? '未知日期' : `${date.getMonth() + 1}月${date.getDate()}日`;
    const yearStr = isNaN(date.getTime()) ? '' : `${date.getFullYear()}年`;

    return `
      <div class="timeline-card" data-id="${item.id}">
        ${item.photos && item.photos.length > 0 ? `
          <div class="timeline-card-photo">
            <img src="${item.photos[0]}" alt="${this._escapeHtml(item.name)}" />
          </div>
        ` : ''}
        <div class="timeline-card-content">
          <h4 class="timeline-card-title">${this._escapeHtml(item.name || '未命名')}</h4>
          ${item.tags && item.tags.length > 0 ? `
            <div class="timeline-card-tags">
              ${item.tags.slice(0, 3).map(tag => `<span class="tag-small">#${this._escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
          <p class="timeline-card-notes">${this._stripHtml(item.notes) || '暂无备注'}</p>
          <div class="timeline-card-meta">
            <span class="timeline-card-date">${yearStr}${dateStr}</span>
            ${item.favorite ? '<span class="timeline-card-favorite">⭐</span>' : ''}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;
    
    const container = document.getElementById('timeline-container');
    if (!container) return;

    // 事件委托：卡片点击
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.timeline-card');
      if (card && card.dataset.id && window.App) {
        App.showDetail(card.dataset.id);
      }
    });
  },

  /**
   * HTML 转义
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * 去除 HTML 标签
   * @param {string} html
   * @returns {string}
   * @private
   */
  _stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
};

// 全局暴露
window.TimelinePlugin = TimelinePlugin;

console.log('[TimelinePlugin] 时间线插件已定义');
} else {
  console.log('[TimelinePlugin] 已存在，跳过加载');
}
