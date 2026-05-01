/**
 * ReviewPlugin - 回顾机制插件
 * 提供：那年今日、每周回顾、月度总结
 * @version 6.3.0
 */

// 幂等加载保护
if (!window.ReviewPlugin) {
const ReviewPlugin = {
  name: 'review',
  version: '1.0.0',
  dependencies: ['records'],

  _eventsBound: false,
  _sections: {},

  /**
   * 初始化插件
   */
  async init() {
    console.log('[ReviewPlugin] Initializing...');
    this.routes = [
      {
        path: 'review/on-this-day',
        title: '那年今日',
        component: 'on-this-day-view'
      },
      {
        path: 'review/weekly',
        title: '每周回顾',
        component: 'weekly-view'
      }
    ];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[ReviewPlugin] Starting...');
    this._bindEvents();
  },

  /**
   * 停止插件
   */
  stop() {
    console.log('[ReviewPlugin] Stopping...');
    this._eventsBound = false;
  },

  /**
   * 路由定义
   */
  routes: [],

  // ========== 那年今日 ==========

  /**
   * 查询那年今日的记录
   * @returns {Promise<Array>}
   */
  async getOnThisDayRecords() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const currentYear = today.getFullYear();
    const records = window.Store?.getState('records.list') || [];
    return records.filter(record => {
      const date = new Date(record.createdAt);
      if (isNaN(date.getTime())) return false;
      return date.getMonth() + 1 === month && date.getDate() === day && date.getFullYear() !== currentYear;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * 渲染那年今日横向滚动
   * @param {HTMLElement} container
   */
  async renderOnThisDay(container) {
    if (!container) return;

    try {
      const records = await this.getOnThisDayRecords();
      if (!records.length) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'block';
      const today = new Date();

      let html = `
        <div class="review-section" id="review-on-this-day">
          <div class="review-section-header" data-toggle="on-this-day">
            <span class="review-section-icon">📅</span>
            <span class="review-section-title">那年今日</span>
            <span class="review-section-badge">${records.length} 条回忆</span>
            <svg class="review-section-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="review-section-body" id="review-body-on-this-day">
            <div class="on-this-day-carousel">
      `;

      records.forEach(record => {
        const date = new Date(record.createdAt);
        const yearsAgo = today.getFullYear() - date.getFullYear();
        const yearLabel = yearsAgo > 0 ? `${yearsAgo}年前` : '今年';
        const plainText = record.notes ? record.notes.replace(/<[^>]*>/g, '') : '';
        const summary = plainText.substring(0, 50) + (plainText.length > 50 ? '...' : '');
        const cover = record.photos && record.photos.length > 0 ? record.photos[0] : '';

        html += `
          <div class="on-this-day-card" data-id="${record.id}">
            ${cover ? `<div class="on-this-day-card-cover"><img src="${cover}" alt="" loading="lazy" /></div>` : ''}
            <div class="on-this-day-card-content">
              <h4 class="on-this-day-card-title">${this._escapeHtml(record.name || '未命名')}</h4>
              <p class="on-this-day-card-date">${yearLabel}的今天 · ${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日</p>
              ${summary ? `<p class="on-this-day-card-summary">${this._escapeHtml(summary)}</p>` : ''}
            </div>
          </div>
        `;
      });

      html += `
            </div>
            <div class="on-this-day-footer">
              <button class="review-view-more-btn" data-route="review/on-this-day">查看全部回忆</button>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // 绑定卡片点击
      container.querySelectorAll('.on-this-day-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.id;
          if (window.Router) {
            window.Router.navigate('editor', { id });
          }
        });
      });

      // 绑定查看更多
      const moreBtn = container.querySelector('.review-view-more-btn');
      if (moreBtn) {
        moreBtn.addEventListener('click', () => {
          if (window.Router) {
            window.Router.navigate(moreBtn.dataset.route);
          }
        });
      }

    } catch (e) {
      console.error('[ReviewPlugin] Failed to render On This Day:', e);
      container.style.display = 'none';
    }
  },

  // ========== 每周回顾 ==========

  /**
   * 获取最近7天的记录
   * @returns {Promise<Array>}
   */
  async getWeeklyRecords() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const records = window.Store?.getState('records.list') || [];
    return records.filter(r => (r.createdAt || 0) >= sevenDaysAgo.getTime())
                   .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  /**
   * 计算每周统计
   * @param {Array} records
   * @returns {Object}
   */
  _computeWeeklyStats(records) {
    let totalWords = 0;
    let favCount = 0;

    records.forEach(r => {
      const plainText = r.notes ? r.notes.replace(/<[^>]*>/g, '') : '';
      totalWords += plainText.length;
      if (r.favorite) favCount++;
    });

    return {
      totalRecords: records.length,
      totalWords,
      favCount
    };
  },

  /**
   * 按天分组记录
   * @param {Array} records
   * @returns {Array} [{ date, label, records: [] }]
   */
  _groupByDay(records) {
    const groups = {};
    const today = new Date();
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    records.forEach(record => {
      const date = new Date(record.createdAt);
      const key = date.toISOString().slice(0, 10);
      if (!groups[key]) {
        const diff = Math.floor((today - date) / 86400000);
        let label;
        if (diff === 0) label = '今天';
        else if (diff === 1) label = '昨天';
        else label = dayNames[date.getDay()];

        groups[key] = {
          date: key,
          label,
          records: []
        };
      }
      groups[key].records.push(record);
    });

    // 按日期降序
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  },

  /**
   * 渲染每周回顾
   * @param {HTMLElement} container
   */
  async renderWeeklyReview(container) {
    if (!container) return;

    try {
      const records = await this.getWeeklyRecords();
      if (!records.length) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'block';
      const stats = this._computeWeeklyStats(records);
      const groups = this._groupByDay(records);

      let html = `
        <div class="review-section" id="review-weekly">
          <div class="review-section-header" data-toggle="weekly">
            <span class="review-section-icon">📊</span>
            <span class="review-section-title">每周回顾</span>
            <span class="review-section-badge">本周 ${stats.totalRecords} 条</span>
            <svg class="review-section-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="review-section-body" id="review-body-weekly">
            <div class="weekly-stats-bar">
              <div class="weekly-stat-item">
                <span class="weekly-stat-value">${stats.totalRecords}</span>
                <span class="weekly-stat-label">条记录</span>
              </div>
              <div class="weekly-stat-item">
                <span class="weekly-stat-value">${stats.totalWords}</span>
                <span class="weekly-stat-label">个字</span>
              </div>
              <div class="weekly-stat-item">
                <span class="weekly-stat-value">${stats.favCount}</span>
                <span class="weekly-stat-label">收藏</span>
              </div>
            </div>
            <div class="weekly-timeline">
      `;

      groups.forEach(group => {
        html += `
          <div class="weekly-day-group">
            <div class="weekly-day-header">
              <span class="weekly-day-label">${group.label}</span>
              <span class="weekly-day-date">${group.date}</span>
            </div>
            <div class="weekly-day-items">
        `;

        group.records.forEach(record => {
          const time = new Date(record.createdAt);
          const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
          const plainText = record.notes ? record.notes.replace(/<[^>]*>/g, '') : '';
          const summary = plainText.substring(0, 80) + (plainText.length > 80 ? '...' : '');

          html += `
            <div class="weekly-item" data-id="${record.id}">
              <div class="weekly-item-time">${timeStr}</div>
              <div class="weekly-item-content">
                <h5 class="weekly-item-title">${this._escapeHtml(record.name || '未命名')}</h5>
                ${summary ? `<p class="weekly-item-summary">${this._escapeHtml(summary)}</p>` : ''}
                ${record.tags && record.tags.length > 0 ? `
                  <div class="weekly-item-tags">
                    ${record.tags.slice(0, 3).map(t => `<span class="tag-small">#${this._escapeHtml(t)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      html += `
            </div>
            <div class="weekly-actions">
              <button class="review-action-btn" id="btn-weekly-summary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                写本周总结
              </button>
              <button class="review-view-more-btn" data-route="review/weekly">完整回顾</button>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // 绑定点击事件
      container.querySelectorAll('.weekly-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          if (window.Router) {
            window.Router.navigate('editor', { id });
          }
        });
      });

      // 写本周总结
      const summaryBtn = container.querySelector('#btn-weekly-summary');
      if (summaryBtn) {
        summaryBtn.addEventListener('click', () => {
          this._openWeeklySummaryEditor(stats);
        });
      }

      // 完整回顾
      const moreBtn = container.querySelector('.review-view-more-btn');
      if (moreBtn) {
        moreBtn.addEventListener('click', () => {
          if (window.Router) {
            window.Router.navigate(moreBtn.dataset.route);
          }
        });
      }

    } catch (e) {
      console.error('[ReviewPlugin] Failed to render Weekly Review:', e);
      container.style.display = 'none';
    }
  },

  /**
   * 打开每周总结编辑器
   */
  _openWeeklySummaryEditor(stats) {
    const now = new Date();
    const weekStart = new Date(now.getTime() - now.getDay() * 86400000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);

    const template = `<h3>本周回顾 (${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()})</h3>
<p>本周共记录了 ${stats.totalRecords} 条内容，写了 ${stats.totalWords} 个字。</p>
<h4>本周亮点</h4>
<ul>
<li></li>
</ul>
<h4>感悟与反思</h4>
<p></p>
<h4>下周计划</h4>
<ul>
<li></li>
</ul>`;

    if (window.Router) {
      window.Router.navigate('editor', { mode: 'create', template });
    }
  },

  // ========== 月度总结 ==========

  /**
   * 获取当月记录
   * @returns {Promise<Array>}
   */
  async getMonthlyRecords() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
    const records = window.Store?.getState('records.list') || [];
    return records.filter(r => {
      const t = r.createdAt || 0;
      return t >= monthStart && t <= monthEnd;
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  /**
   * 计算月度统计
   * @param {Array} records
   * @returns {Object}
   */
  _computeMonthlyStats(records) {
    const tagCounts = {};
    let totalWords = 0;
    let favCount = 0;

    records.forEach(r => {
      const plainText = r.notes ? r.notes.replace(/<[^>]*>/g, '') : '';
      totalWords += plainText.length;
      if (r.favorite) favCount++;

      if (r.tags) {
        r.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    // Top 5 tags
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalRecords: records.length,
      totalWords,
      favCount,
      topTags
    };
  },

  /**
   * 渲染月度总结
   * @param {HTMLElement} container
   */
  async renderMonthlySummary(container) {
    if (!container) return;

    try {
      const records = await this.getMonthlyRecords();
      container.style.display = 'block';

      const now = new Date();
      const stats = this._computeMonthlyStats(records);

      let html = `
        <div class="review-section" id="review-monthly">
          <div class="review-section-header" data-toggle="monthly">
            <span class="review-section-icon">📈</span>
            <span class="review-section-title">月度总结</span>
            <span class="review-section-badge">${now.getMonth() + 1}月</span>
            <svg class="review-section-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="review-section-body" id="review-body-monthly">
            <div class="monthly-stats-grid">
              <div class="monthly-stat-card">
                <span class="monthly-stat-value">${stats.totalRecords}</span>
                <span class="monthly-stat-label">本月记录</span>
              </div>
              <div class="monthly-stat-card">
                <span class="monthly-stat-value">${stats.totalWords}</span>
                <span class="monthly-stat-label">总字数</span>
              </div>
              <div class="monthly-stat-card">
                <span class="monthly-stat-value">${stats.favCount}</span>
                <span class="monthly-stat-label">收藏</span>
              </div>
            </div>
      `;

      if (stats.topTags.length > 0) {
        html += `
          <div class="monthly-top-tags">
            <h4 class="monthly-section-label">热门标签</h4>
            <div class="monthly-tags-list">
        `;
        stats.topTags.forEach(([tag, count]) => {
          html += `<span class="monthly-tag-chip">#${this._escapeHtml(tag)} <span class="monthly-tag-count">${count}</span></span>`;
        });
        html += `</div></div>`;
      }

      html += `
            <div class="monthly-actions">
              <button class="review-action-btn" id="btn-monthly-reflection">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                写月度反思
              </button>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // 写月度反思
      const reflectionBtn = container.querySelector('#btn-monthly-reflection');
      if (reflectionBtn) {
        reflectionBtn.addEventListener('click', () => {
          this._openMonthlyReflectionEditor(stats, now);
        });
      }

    } catch (e) {
      console.error('[ReviewPlugin] Failed to render Monthly Summary:', e);
      container.style.display = 'none';
    }
  },

  /**
   * 打开月度反思编辑器
   */
  _openMonthlyReflectionEditor(stats, now) {
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const monthName = monthNames[now.getMonth()];

    const template = `<h3>${monthName}月度反思</h3>
<p>本月共记录了 ${stats.totalRecords} 条内容，写了 ${stats.totalWords} 个字。</p>
${stats.topTags.length > 0 ? `<p>最常使用的标签：${stats.topTags.map(([t, c]) => `#${t}(${c})`).join('、')}</p>` : ''}
<h4>本月回顾</h4>
<p></p>
<h4>成长与收获</h4>
<p></p>
<h4>下月展望</h4>
<p></p>`;

    if (window.Router) {
      window.Router.navigate('editor', { mode: 'create', template });
    }
  },

  // ========== 那年今日全屏视图 ==========

  /**
   * 渲染那年今日全屏页面
   * @param {HTMLElement} container
   */
  async renderOnThisDayFull(container) {
    if (!container) return;

    try {
      const records = await this.getOnThisDayRecords();
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      if (!records.length) {
        container.innerHTML = `
          <div class="review-full-page">
            <div class="review-full-header">
              <button class="review-full-back-btn" id="review-back-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <path d="M19 12H5M12 19l-7-7 7-7"></path>
                </svg>
                返回
              </button>
              <h2 class="review-full-title">那年今日</h2>
            </div>
            <div class="review-full-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <p class="review-full-empty-title">暂无回忆</p>
              <p class="review-full-empty-desc">${month}月${day}日还没有往年记录</p>
              <p class="review-full-empty-hint">多记录生活，来年就能在这里看到回忆了</p>
            </div>
          </div>
        `;
        return;
      }

      let html = `
        <div class="review-full-page">
          <div class="review-full-header">
            <button class="review-full-back-btn" id="review-back-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M19 12H5M12 19l-7-7 7-7"></path>
              </svg>
              返回
            </button>
            <h2 class="review-full-title">${month}月${day}日 · 那年今日</h2>
          </div>
          <div class="review-full-list">
      `;

      records.forEach(record => {
        const date = new Date(record.createdAt);
        const yearsAgo = today.getFullYear() - date.getFullYear();
        const yearLabel = yearsAgo > 0 ? `${yearsAgo}年前` : '今年';
        const plainText = record.notes ? record.notes.replace(/<[^>]*>/g, '') : '';
        const summary = plainText.substring(0, 120) + (plainText.length > 120 ? '...' : '');
        const cover = record.photos && record.photos.length > 0 ? record.photos[0] : '';

        html += `
          <div class="review-full-card" data-id="${record.id}">
            ${cover ? `<div class="review-full-card-cover"><img src="${cover}" alt="" loading="lazy" /></div>` : ''}
            <div class="review-full-card-content">
              <div class="review-full-card-header">
                <h4 class="review-full-card-title">${this._escapeHtml(record.name || '未命名')}</h4>
                <span class="review-full-card-badge">${yearLabel}</span>
              </div>
              <p class="review-full-card-date">${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日</p>
              ${summary ? `<p class="review-full-card-summary">${this._escapeHtml(summary)}</p>` : ''}
              ${record.tags && record.tags.length > 0 ? `
                <div class="review-full-card-tags">
                  ${record.tags.slice(0, 5).map(t => `<span class="tag-small">#${this._escapeHtml(t)}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;

      container.innerHTML = html;

      // 绑定返回按钮
      const backBtn = container.querySelector('#review-back-btn');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (window.Router) {
            window.Router.navigate('home');
          }
        });
      }

      // 绑定卡片点击
      container.querySelectorAll('.review-full-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.id;
          if (window.Router) {
            window.Router.navigate('editor', { id });
          }
        });
      });

    } catch (e) {
      console.error('[ReviewPlugin] Failed to render On This Day full:', e);
      container.innerHTML = '<div class="review-full-page"><p class="review-full-empty-title">加载失败</p></div>';
    }
  },

  // ========== 每周回顾全屏视图 ==========

  /**
   * 渲染每周回顾全屏页面
   * @param {HTMLElement} container
   */
  async renderWeeklyFull(container) {
    if (!container) return;

    try {
      const records = await this.getWeeklyRecords();
      const stats = this._computeWeeklyStats(records);
      const groups = this._groupByDay(records);

      if (!records.length) {
        container.innerHTML = `
          <div class="review-full-page">
            <div class="review-full-header">
              <button class="review-full-back-btn" id="review-back-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <path d="M19 12H5M12 19l-7-7 7-7"></path>
                </svg>
                返回
              </button>
              <h2 class="review-full-title">每周回顾</h2>
            </div>
            <div class="review-full-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <p class="review-full-empty-title">本周暂无记录</p>
              <p class="review-full-empty-desc">过去 7 天没有新记录</p>
              <button class="review-full-empty-btn" id="btn-weekly-create">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                创建第一条记录
              </button>
            </div>
          </div>
        `;
      } else {
        let html = `
          <div class="review-full-page">
            <div class="review-full-header">
              <button class="review-full-back-btn" id="review-back-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <path d="M19 12H5M12 19l-7-7 7-7"></path>
                </svg>
                返回
              </button>
              <h2 class="review-full-title">每周回顾</h2>
            </div>
            <div class="weekly-stats-bar weekly-stats-bar-full">
              <div class="weekly-stat-item">
                <span class="weekly-stat-value">${stats.totalRecords}</span>
                <span class="weekly-stat-label">条记录</span>
              </div>
              <div class="weekly-stat-item">
                <span class="weekly-stat-value">${stats.totalWords}</span>
                <span class="weekly-stat-label">个字</span>
              </div>
              <div class="weekly-stat-item">
                <span class="weekly-stat-value">${stats.favCount}</span>
                <span class="weekly-stat-label">收藏</span>
              </div>
            </div>
            <div class="review-full-list">
        `;

        groups.forEach(group => {
          html += `
            <div class="weekly-day-group">
              <div class="weekly-day-header">
                <span class="weekly-day-label">${group.label}</span>
                <span class="weekly-day-date">${group.date}</span>
                <span class="weekly-day-count">${group.records.length} 条</span>
              </div>
              <div class="weekly-day-items">
          `;

          group.records.forEach(record => {
            const time = new Date(record.createdAt);
            const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
            const plainText = record.notes ? record.notes.replace(/<[^>]*>/g, '') : '';
            const summary = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');
            const cover = record.photos && record.photos.length > 0 ? record.photos[0] : '';

            html += `
              <div class="weekly-item" data-id="${record.id}">
                <div class="weekly-item-time">${timeStr}</div>
                <div class="weekly-item-content">
                  <h5 class="weekly-item-title">${this._escapeHtml(record.name || '未命名')}</h5>
                  ${cover ? `<div class="weekly-item-cover"><img src="${cover}" alt="" loading="lazy" /></div>` : ''}
                  ${summary ? `<p class="weekly-item-summary">${this._escapeHtml(summary)}</p>` : ''}
                  ${record.tags && record.tags.length > 0 ? `
                    <div class="weekly-item-tags">
                      ${record.tags.slice(0, 3).map(t => `<span class="tag-small">#${this._escapeHtml(t)}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          });

          html += `</div></div>`;
        });

        html += `
              <div class="weekly-actions">
                <button class="review-action-btn" id="btn-weekly-summary-full">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  写本周总结
                </button>
              </div>
            </div>
          </div>
        `;

        container.innerHTML = html;

        // 绑定写本周总结
        const summaryBtn = container.querySelector('#btn-weekly-summary-full');
        if (summaryBtn) {
          summaryBtn.addEventListener('click', () => {
            this._openWeeklySummaryEditor(stats);
          });
        }

        // 绑定卡片点击
        container.querySelectorAll('.weekly-item').forEach(item => {
          item.addEventListener('click', () => {
            const id = item.dataset.id;
            if (window.Router) {
              window.Router.navigate('editor', { id });
            }
          });
        });
      }

      // 绑定返回
      const backBtn = container.querySelector('#review-back-btn');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (window.Router) {
            window.Router.navigate('home');
          }
        });
      }

      // 绑定创建
      const createBtn = container.querySelector('#btn-weekly-create');
      if (createBtn) {
        createBtn.addEventListener('click', () => {
          if (window.Router) {
            window.Router.navigate('editor');
          }
        });
      }

    } catch (e) {
      console.error('[ReviewPlugin] Failed to render Weekly full:', e);
      container.innerHTML = '<div class="review-full-page"><p class="review-full-empty-title">加载失败</p></div>';
    }
  },

  // ========== 事件绑定 ==========

  /**
   * 绑定全局事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // 折叠/展开 section
    document.addEventListener('click', (e) => {
      const header = e.target.closest('.review-section-header');
      if (header) {
        const key = header.dataset.toggle;
        if (!key) return;
        const body = header.nextElementSibling;
        const arrow = header.querySelector('.review-section-arrow');
        if (body) {
          const isCollapsed = body.style.display === 'none';
          body.style.display = isCollapsed ? 'block' : 'none';
          if (arrow) {
            arrow.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
          }
        }
      }
    });
  },

  // ========== 工具方法 ==========

  /**
   * HTML 转义
   * @private
   */
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// 全局暴露
window.ReviewPlugin = ReviewPlugin;

console.log('[ReviewPlugin] 回顾插件已定义');
} else {
  console.log('[ReviewPlugin] 已存在，跳过加载');
}
