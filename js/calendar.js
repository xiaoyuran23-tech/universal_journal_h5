/**
 * 万物手札 H5 - 日历视图模块
 * 纯手写轻量级月历，零依赖
 * 版本：v3.2.0
 */

const CalendarView = {
  currentDate: new Date(),
  selectedDate: null,
  items: [],
  viewMode: 'month', // 'month' | 'week'

  /**
   * 初始化日历
   */
  init(items) {
    this.items = items;
    this.render();
    this.bindEvents();
  },

  /**
   * 更新数据
   */
  update(items) {
    this.items = items;
    this.render();
  },

  /**
   * 渲染日历
   */
  render() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    if (this.viewMode === 'month') {
      container.innerHTML = this._renderMonthView();
    } else {
      container.innerHTML = this._renderWeekView();
    }
  },

  /**
   * 渲染月视图
   */
  _renderMonthView() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const today = new Date();

    // 计算月份信息
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=周日
    const daysInMonth = lastDay.getDate();

    // 构建日历网格（包含上月补白和下月补白）
    const days = [];
    
    // 上月补白
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // 本月日期
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const isToday = this._isSameDay(date, today);
      const hasItems = this._hasItemsOnDate(date);
      const isSelected = this.selectedDate && this._isSameDay(date, this.selectedDate);
      
      days.push({
        date,
        isCurrentMonth: true,
        isToday,
        hasItems,
        isSelected,
        count: hasItems ? this._getItemsCountOnDate(date) : 0
      });
    }

    // 下月补白
    const remainingCells = 42 - days.length; // 6行 x 7列
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    return `
      <div class="calendar-header">
        <button class="cal-nav-btn" data-action="prev-month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M15 18l-6-6 6-6"></path>
          </svg>
        </button>
        <div class="cal-title">
          <span class="cal-year">${year}年</span>
          <span class="cal-month">${monthNames[month]}</span>
        </div>
        <button class="cal-nav-btn" data-action="next-month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
        </button>
      </div>

      <div class="cal-views-toggle">
        <button class="cal-view-btn ${this.viewMode === 'month' ? 'active' : ''}" data-view="month">月</button>
        <button class="cal-view-btn ${this.viewMode === 'week' ? 'active' : ''}" data-view="week">周</button>
      </div>

      <div class="cal-weekdays">
        ${weekDays.map(d => `<div class="cal-weekday">${d}</div>`).join('')}
      </div>

      <div class="cal-grid">
        ${days.map(day => `
          <div class="cal-day 
            ${day.isCurrentMonth ? 'current-month' : 'other-month'}
            ${day.isToday ? 'today' : ''}
            ${day.isSelected ? 'selected' : ''}
          " data-date="${this._formatDateISO(day.date)}">
            <span class="cal-day-number">${day.date.getDate()}</span>
            ${day.hasItems ? `<div class="cal-dots"><span class="cal-dot" data-count="${day.count}"></span></div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * 渲染周视图
   */
  _renderWeekView() {
    const today = this.currentDate;
    const startOfWeek = new Date(today);
    const dayOfWeek = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    let daysHtml = '';
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      const isToday = this._isSameDay(date, new Date());
      const hasItems = this._hasItemsOnDate(date);
      const isSelected = this.selectedDate && this._isSameDay(date, this.selectedDate);

      daysHtml += `
        <div class="cal-week-item 
          ${isToday ? 'today' : ''} 
          ${isSelected ? 'selected' : ''}" 
          data-date="${this._formatDateISO(date)}">
          <div class="cal-week-day-name">${weekNames[i]}</div>
          <div class="cal-week-day-num">${date.getDate()}</div>
          ${hasItems ? `<div class="cal-week-count">${this._getItemsCountOnDate(date)} 条</div>` : ''}
        </div>
      `;
    }

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    return `
      <div class="calendar-header">
        <button class="cal-nav-btn" data-action="prev-week">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M15 18l-6-6 6-6"></path>
          </svg>
        </button>
        <div class="cal-title">
          <span class="cal-week-label">${monthNames[today.getMonth()]} 第${this._getWeekNumber(today)}周</span>
        </div>
        <button class="cal-nav-btn" data-action="next-week">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
        </button>
      </div>

      <div class="cal-views-toggle">
        <button class="cal-view-btn ${this.viewMode === 'month' ? 'active' : ''}" data-view="month">月</button>
        <button class="cal-view-btn ${this.viewMode === 'week' ? 'active' : ''}" data-view="week">周</button>
      </div>

      <div class="cal-week-grid">
        ${daysHtml}
      </div>
    `;
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const dayCell = e.target.closest('.cal-day, .cal-week-item');
      const navBtn = e.target.closest('.cal-nav-btn');
      const viewBtn = e.target.closest('.cal-view-btn');

      if (dayCell) {
        const dateStr = dayCell.dataset.date;
        if (dateStr) this._onDateSelect(dateStr);
      }

      if (navBtn) {
        const action = navBtn.dataset.action;
        if (action) this._onNav(action);
      }

      if (viewBtn) {
        const view = viewBtn.dataset.view;
        if (view && view !== this.viewMode) {
          this.viewMode = view;
          this.render();
        }
      }
    });
  },

  /**
   * 日期选择
   */
  _onDateSelect(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    this.selectedDate = date;
    this.currentDate = new Date(date);
    this.render();

    // 触发事件通知 App
    if (window.App) {
      App.filterByDate(date);
    }
  },

  /**
   * 导航操作
   */
  _onNav(action) {
    switch (action) {
      case 'prev-month':
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        break;
      case 'next-month':
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        break;
      case 'prev-week':
        this.currentDate.setDate(this.currentDate.getDate() - 7);
        break;
      case 'next-week':
        this.currentDate.setDate(this.currentDate.getDate() + 7);
        break;
    }
    this.selectedDate = null;
    this.render();
  },

  /**
   * 检查某天是否有记录
   */
  _hasItemsOnDate(date) {
    const dateStr = this._formatDateISO(date);
    return this.items.some(item => item.createdAt && item.createdAt.startsWith(dateStr));
  },

  /**
   * 获取某天的记录数
   */
  _getItemsCountOnDate(date) {
    const dateStr = this._formatDateISO(date);
    return this.items.filter(item => item.createdAt && item.createdAt.startsWith(dateStr)).length;
  },

  /**
   * 是否为同一天
   */
  _isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  },

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  _formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  /**
   * 格式化日期为本地格式 (如 2026/04/28)
   */
  _formatDateLocal(date) {
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  },

  /**
   * 格式化日期为 ISO 日期部分 (如 2026-04-28)
   */
  _formatDateISO(date) {
    return date.toISOString().split('T')[0];
  },

  /**
   * 获取周数
   */
  _getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
};

// 全局导出
window.CalendarView = CalendarView;
