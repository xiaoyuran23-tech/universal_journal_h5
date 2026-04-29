/**
 * 万物手札 H5 - 时间线/故事模式模块
 * 功能：按时间轴展示记录，支持“那年今日”
 * 版本：v3.2.0
 */

const TimelineManager = {
  _eventsBound: false,

  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * 初始化
   */
  init() {
    if (this._eventsBound) return;
    this._eventsBound = true;
    
    // 绑定卡片点击事件（事件委托）
    const container = document.getElementById('timeline-container');
    if (container) {
      container.addEventListener('click', (e) => {
        const card = e.target.closest('.timeline-card');
        if (card && card.dataset.id) {
          if (window.App) {
            App.showDetail(card.dataset.id);
          }
        }
      });
    }
  },

  /**
   * 渲染时间线
   * @param {Array} items - 记录列表
   */
  render(items) {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>还没有记录，去添加一条吧！</p></div>';
      return;
    }

    // 1. 按日期排序 (新的在前)，增加容错处理
    const sortedItems = [...items].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      // 处理无效日期
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateB - dateA;
    });

    // 2. 分组：年 -> 月
    const groups = {};
    sortedItems.forEach(item => {
      const date = new Date(item.date || item.createdAt || 0);
      // 跳过无效日期
      if (isNaN(date.getTime())) return;
      
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11

      if (!groups[year]) groups[year] = {};
      if (!groups[year][month]) groups[year][month] = [];
      groups[year][month].push(item);
    });

    // 3. 构建 HTML
    let html = '';

    // 3.1 那年今日 (如果有)
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    
    // 查找往年同月同日的记录
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

    // 3.2 全部时间线
    html += `<div class="timeline-section all-stories">
      <h3>📅 全部故事</h3>`;

    // 遍历年份 (倒序)
    const years = Object.keys(groups).sort((a, b) => b - a);

    years.forEach(year => {
      html += `<div class="timeline-year">
        <div class="year-header">${year}年</div>
        <div class="timeline-items">`;

      // 遍历月份 (倒序)
      const months = Object.keys(groups[year]).sort((a, b) => b - a);
      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

      months.forEach(month => {
        const mIndex = parseInt(month);
        html += `<div class="month-group">
          <div class="month-header">${monthNames[mIndex]}</div>
          <div class="timeline-items">`;

        groups[year][month].forEach(item => {
          html += this._renderItemCard(item);
        });

        html += `</div></div>`; // .timeline-items
      });

      html += `</div></div>`; // .timeline-items, .timeline-year
    });

    html += `</div>`; // .all-stories

    container.innerHTML = html;
  },

  /**
   * 渲染单条记录卡片
   */
  _renderItemCard(item, isOnThisDay = false) {
    const date = new Date(item.date || item.createdAt || 0);
    let dateStr = '未知日期';
    if (!isNaN(date.getTime())) {
      dateStr = isOnThisDay
        ? `${date.getFullYear()}年 ${date.getMonth() + 1}月${date.getDate()}日`
        : `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    const tags = (item.tags || []).map(t => `<span class="tag-pill">${this._escape(t)}</span>`).join('');
    const photoCount = item.photos ? item.photos.length : 0;

    // 提取纯文本内容作为摘要
    let summary = item.content || '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = summary;
    const textSummary = tempDiv.textContent || tempDiv.innerText || '';
    const displaySummary = textSummary.length > 100 ? textSummary.substring(0, 100) + '...' : textSummary;

    return `
      <div class="timeline-card" data-id="${item.id}">
        <div class="card-header">
          <span class="card-date">${isOnThisDay ? date.getFullYear() + '年 ' : ''}${this._escape(dateStr)}</span>
        </div>
        <h4 class="card-title">${this._escape(item.name)}</h4>
        <p class="card-summary">${this._escape(displaySummary || '无内容')}</p>
        <div class="card-footer">
          ${tags}
          ${photoCount > 0 ? `<span class="photo-indicator"> ${photoCount}</span>` : ''}
        </div>
      </div>
    `;
  }
};

// 挂载到全局
window.TimelineManager = TimelineManager;
