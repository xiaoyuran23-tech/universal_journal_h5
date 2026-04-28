/**
 * 万物手札 H5 - 数据可视化模块
 * 功能：热力图、趋势图
 * 版本：v3.2.0
 */

const VisualsManager = {
  containerId: 'visuals-container',
  
  /**
   * 初始化
   */
  init() {
    // 可以在这里做一些初始化工作
  },

  /**
   * 渲染所有可视化图表
   * @param {Array} items - 记录列表
   */
  render(items) {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    if (!items || items.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>暂无数据，快去记录生活吧！</p></div>';
      return;
    }

    // 统计信息
    const totalItems = items.length;
    const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
    
    let html = `
      <div class="visuals-header">
        <h3>📊 数据统计</h3>
      </div>
      <div class="visuals-summary">
        <div>共 <strong>${totalItems}</strong> 条记录</div>
        <div>涵盖 <strong>${categories.length}</strong> 个分类</div>
      </div>
      
      <div class="visuals-section">
        <h4> 活动热力图 (近一年)</h4>
        <div id="heatmap-container"></div>
      </div>
      
      <div class="visuals-section">
        <h4>📈 月度记录趋势</h4>
        <div id="trend-container"></div>
      </div>
      
      <div class="visuals-section">
        <h4>🏷️ 分类占比</h4>
        <div id="category-container"></div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // 渲染子图表
    const heatmapContainer = document.getElementById('heatmap-container');
    const trendContainer = document.getElementById('trend-container');
    const categoryContainer = document.getElementById('category-container');
    
    this.renderHeatmap(items, heatmapContainer);
    this.renderTrends(items, trendContainer);
    this.renderCategoryDistribution(items, categoryContainer);
  },

  /**
   * 渲染分类占比进度条
   * @param {Array} items
   * @param {HTMLElement} container
   */
  renderCategoryDistribution(items, container) {
    if (!container || !items) return;

    const counts = {};
    let total = 0;
    items.forEach(item => {
      const cat = item.category || '未分类';
      counts[cat] = (counts[cat] || 0) + 1;
      total++;
    });

    if (total === 0) {
      container.innerHTML = '<div class="empty-state"><p>暂无分类数据</p></div>';
      return;
    }

    // 按数量排序
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    let html = '<div class="category-list">';
    sorted.forEach(([cat, count]) => {
      const percent = ((count / total) * 100).toFixed(1);
      html += `
        <div class="category-item">
          <div class="category-info">
            <span class="category-name">${cat}</span>
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

  /**
   * 渲染热力图
   * @param {Array} items - 记录列表
   * @param {HTMLElement} container - 容器
   */
  renderHeatmap(items, container) {
    if (!container || !items) return;

    // 统计每天的数量
    const counts = {};
    let maxCount = 0;
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    // 初始化最近一年的日期
    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      counts[key] = 0;
    }

    // 填充数据
    items.forEach(item => {
      const d = new Date(item.date);
      if (d >= oneYearAgo && d <= today) {
        const key = d.toISOString().split('T')[0];
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] > maxCount) maxCount = counts[key];
      }
    });

    // 生成网格
    let html = '<div class="heatmap-grid">';
    // 这里简单按周渲染，7行 x 53列
    // 为了简化，我们直接按天渲染，CSS控制换行
    // 更简单的做法：按周分组
    
    const weeks = [];
    let currentWeek = [];
    
    // 调整起始日期为周日 (假设周日是一周的开始)
    const startDate = new Date(oneYearAgo);
    const dayOfWeek = startDate.getDay(); // 0 is Sunday
    // 补全第一周前面的空白
    for (let i = 0; i < dayOfWeek; i++) {
      currentWeek.push(null);
    }

    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      currentWeek.push({ date: key, count: counts[key] || 0 });
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    // 补全最后一周
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    // 渲染
    weeks.forEach(week => {
      week.forEach(day => {
        if (!day) {
          html += `<div class="heatmap-cell empty"></div>`;
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
    html += `<div class="heatmap-legend">少 <span class="legend-cell level-0"></span><span class="legend-cell level-1"></span><span class="legend-cell level-2"></span><span class="legend-cell level-3"></span> 多</div>`;

    container.innerHTML = html;
  },

  /**
   * 渲染趋势图 (简易柱状图)
   * @param {Array} items
   * @param {HTMLElement} container
   */
  renderTrends(items, container) {
    if (!container || !items) return;

    // 按月统计
    const monthCounts = {};
    const monthLabels = [];
    const today = new Date();
    
    // 最近 12 个月
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.getMonth() + 1}月`;
      monthCounts[key] = 0;
      monthLabels.push({ key, label });
    }

    items.forEach(item => {
      const d = new Date(item.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthCounts.hasOwnProperty(key)) {
        monthCounts[key]++;
      }
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
  }
};

window.VisualsManager = VisualsManager;
