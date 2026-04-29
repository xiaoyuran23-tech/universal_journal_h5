/**
 * Calendar Plugin - 日历视图插件
 * 提供月视图/周视图，支持日期筛选和导航
 * @version 6.0.0
 */

// 幂等加载保护
if (!window.CalendarPlugin) {
const CalendarPlugin = {
  name: 'calendar',
  version: '1.0.0',
  dependencies: ['records'], // 依赖记录插件
  
  _currentDate: new Date(),
  _selectedDate: null,
  _viewMode: 'month', // 'month' | 'week'
  _eventsBound: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[CalendarPlugin] Initializing...');
    
    // 注册路由
    this.routes = [
      {
        path: 'calendar',
        title: '日历',
        component: 'calendar-view',
        guard: () => true
      }
    ];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[CalendarPlugin] Starting...');
    this._bindEvents();
    this._render();
    
    // 订阅记录变化，自动刷新日历
    if (window.Store) {
      Store.subscribe((newState, prevState) => {
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
    console.log('[CalendarPlugin] Stopping...');
    this._eventsBound = false;
  },

  /**
   * 路由定义
   */
  routes: [],

  /**
   * Actions (可选，如果需要独立状态)
   */
  actions: {},

  /**
   * 渲染日历
   * @private
   */
  _render() {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    // 从 Store 获取记录
    const records = window.Store ? Store.getState('records.list') : [];

    if (this._viewMode === 'month') {
      container.innerHTML = this._renderMonthView(records);
    } else {
      container.innerHTML = this._renderWeekView(records);
    }
  },

  /**
   * 渲染月视图
   * @param {Array} records - 记录列表
   * @private
   */
  _renderMonthView(records) {
    const year = this._currentDate.getFullYear();
    const month = this._currentDate.getMonth();
    const today = new Date();

    // 计算月份信息
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // 构建日历网格
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
      const dayRecords = this._getRecordsForDate(date, records);
      const isSelected = this._selectedDate && this._isSameDay(date, this._selectedDate);
      
      days.push({
        date,
        isCurrentMonth: true,
        isToday,
        isSelected,
        count: dayRecords.length,
        records: dayRecords
      });
    }

    // 下月补白
    const remainingCells = 42 - days.length;
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
        <button class="calendar-nav-btn" data-action="prev-month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="calendar-title">
          <h2>${year}年 ${monthNames[month]}</h2>
          <div class="calendar-view-toggle">
            <button class="${this._viewMode === 'month' ? 'active' : ''}" data-action="switch-month">月</button>
            <button class="${this._viewMode === 'week' ? 'active' : ''}" data-action="switch-week">周</button>
          </div>
        </div>
        <button class="calendar-nav-btn" data-action="next-month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      
      <div class="calendar-weekdays">
        ${weekDays.map(d => `<div class="weekday">${d}</div>`).join('')}
      </div>
      
      <div class="calendar-days">
        ${days.map(day => `
          <div class="calendar-day 
            ${!day.isCurrentMonth ? 'other-month' : ''} 
            ${day.isToday ? 'today' : ''} 
            ${day.isSelected ? 'selected' : ''}"
            data-date="${day.date.toISOString().split('T')[0]}">
            <span class="day-number">${day.date.getDate()}</span>
            ${day.count > 0 ? `<span class="day-indicator">${day.count}</span>` : ''}
          </div>
        `).join('')}
      </div>
      
      ${this._selectedDate ? this._renderDayDetail(this._selectedDate, records) : ''}
    `;
  },

  /**
   * 渲染周视图
   * @param {Array} records
   * @private
   */
  _renderWeekView(records) {
    const today = new Date();
    const currentDay = this._currentDate.getDay();
    const startOfWeek = new Date(this._currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - currentDay);

    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    let html = `
      <div class="calendar-header">
        <button class="calendar-nav-btn" data-action="prev-week">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="calendar-title">
          <h2>${startOfWeek.getMonth() + 1}月 ${startOfWeek.getDate()}日 - ${new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000).getDate()}日</h2>
          <div class="calendar-view-toggle">
            <button class="${this._viewMode === 'month' ? 'active' : ''}" data-action="switch-month">月</button>
            <button class="${this._viewMode === 'week' ? 'active' : ''}" data-action="switch-week">周</button>
          </div>
        </div>
        <button class="calendar-nav-btn" data-action="next-week">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      <div class="week-view">
    `;

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      const dayRecords = this._getRecordsForDate(date, records);
      const isToday = this._isSameDay(date, today);

      html += `
        <div class="week-day ${isToday ? 'today' : ''}" data-date="${date.toISOString().split('T')[0]}">
          <div class="week-day-header">
            <span class="week-day-name">${weekDays[i]}</span>
            <span class="week-day-date">${date.getDate()}</span>
          </div>
          <div class="week-day-items">
            ${dayRecords.length > 0 ? dayRecords.map(r => `
              <div class="week-item" data-id="${r.id}">
                <span class="week-item-name">${r.name || '未命名'}</span>
              </div>
            `).join('') : '<span class="week-empty">无记录</span>'}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  },

  /**
   * 渲染选中日期的详情
   * @param {Date} date
   * @param {Array} records
   * @private
   */
  _renderDayDetail(date, records) {
    const dayRecords = this._getRecordsForDate(date, records);
    
    if (dayRecords.length === 0) {
      return `
        <div class="day-detail">
          <h3>${date.getMonth() + 1}月${date.getDate()}日</h3>
          <p class="day-detail-empty">这天还没有记录</p>
          <button class="btn-primary" data-action="add-record-date">+ 添加记录</button>
        </div>
      `;
    }

    return `
      <div class="day-detail">
        <h3>${date.getMonth() + 1}月${date.getDate()}日 (${dayRecords.length}条记录)</h3>
        <div class="day-detail-list">
          ${dayRecords.map(record => `
            <div class="day-detail-item" data-id="${record.id}">
              <h4>${record.name || '未命名'}</h4>
              ${record.tags && record.tags.length > 0 ? `
                <div class="day-detail-tags">
                  ${record.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                </div>
              ` : ''}
              <p class="day-detail-notes">${(record.notes || '').substring(0, 50)}${(record.notes || '').length > 50 ? '...' : ''}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * 获取指定日期的记录
   * @param {Date} date
   * @param {Array} records
   * @returns {Array}
   * @private
   */
  _getRecordsForDate(date, records) {
    if (!records || records.length === 0) return [];
    
    const targetDate = date.toDateString();
    return records.filter(record => {
      const recordDate = new Date(record.createdAt || record.date || 0);
      return recordDate.toDateString() === targetDate;
    });
  },

  /**
   * 比较两个日期是否相同
   * @param {Date} d1
   * @param {Date} d2
   * @returns {boolean}
   * @private
   */
  _isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const container = document.getElementById('calendar-container');
    if (!container) return;

    // 事件委托
    container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (target) {
        const action = target.dataset.action;
        this._handleAction(action);
        return;
      }

      const dayEl = e.target.closest('.calendar-day');
      if (dayEl && dayEl.dataset.date) {
        this._selectDate(new Date(dayEl.dataset.date));
        return;
      }

      const weekDayEl = e.target.closest('.week-day');
      if (weekDayEl && weekDayEl.dataset.date) {
        this._selectDate(new Date(weekDayEl.dataset.date));
        return;
      }

      const weekItemEl = e.target.closest('.week-item');
      if (weekItemEl && weekItemEl.dataset.id && window.App) {
        App.showDetail(weekItemEl.dataset.id);
        return;
      }

      const dayDetailItemEl = e.target.closest('.day-detail-item');
      if (dayDetailItemEl && dayDetailItemEl.dataset.id && window.App) {
        App.showDetail(dayDetailItemEl.dataset.id);
        return;
      }
    });
  },

  /**
   * 处理操作
   * @param {string} action
   * @private
   */
  _handleAction(action) {
    switch (action) {
      case 'prev-month':
        this._currentDate.setMonth(this._currentDate.getMonth() - 1);
        this._render();
        break;
      case 'next-month':
        this._currentDate.setMonth(this._currentDate.getMonth() + 1);
        this._render();
        break;
      case 'prev-week':
        this._currentDate.setDate(this._currentDate.getDate() - 7);
        this._render();
        break;
      case 'next-week':
        this._currentDate.setDate(this._currentDate.getDate() + 7);
        this._render();
        break;
      case 'switch-month':
        this._viewMode = 'month';
        this._render();
        break;
      case 'switch-week':
        this._viewMode = 'week';
        this._render();
        break;
      case 'add-record-date':
        if (window.Router) {
          Router.navigate('editor', { mode: 'create', date: this._selectedDate.toISOString() });
        }
        break;
    }
  },

  /**
   * 选择日期
   * @param {Date} date
   * @private
   */
  _selectDate(date) {
    this._selectedDate = date;
    this._render();
    
    // 触发筛选事件
    if (window.Store && window.RecordsPlugin) {
      RecordsPlugin.filterRecords({ date: date.toISOString().split('T')[0] });
    }
  }
};

// 全局暴露
window.CalendarPlugin = CalendarPlugin;

console.log('[CalendarPlugin] 日历插件已定义');
} else {
  console.log('[CalendarPlugin] 已存在，跳过加载');
}
