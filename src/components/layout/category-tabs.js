/**
 * CategoryTabs - 分类标签组件
 * 横向滚动的分类筛选器
 * @version 6.0.0
 */

class CategoryTabs {
  /**
   * 默认分类配置
   */
  static DEFAULT_TABS = [
    { key: 'all', label: '全部', icon: '📋' },
    { key: 'plant', label: '植物', icon: '' },
    { key: 'food', label: '美食', icon: '🍞' },
    { key: 'city', label: '足迹', icon: '🏙️' },
    { key: 'daily', label: '日常', icon: '☕' }
  ];

  /**
   * 渲染分类标签
   * @param {Array} tabs - 分类配置
   * @param {string} activeKey - 当前激活的分类
   * @param {Function} onChange - 切换回调
   * @returns {HTMLElement}
   */
  static render(tabs = this.DEFAULT_TABS, activeKey = 'all', onChange) {
    const container = document.createElement('div');
    container.className = 'category-tabs';

    tabs.forEach(tab => {
      const tabBtn = document.createElement('button');
      tabBtn.className = `category-tab ${tab.key === activeKey ? 'active' : ''}`;
      tabBtn.dataset.key = tab.key;
      
      tabBtn.innerHTML = `
        <span class="category-tab-icon">${tab.icon}</span>
        <span class="category-tab-label">${tab.label}</span>
      `;

      tabBtn.addEventListener('click', () => {
        if (onChange) onChange(tab.key);
      });

      container.appendChild(tabBtn);
    });

    return container;
  }

  /**
   * 更新激活状态
   * @param {HTMLElement} container
   * @param {string} activeKey
   */
  static setActive(container, activeKey) {
    container.querySelectorAll('.category-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.key === activeKey);
    });
  }
}

window.CategoryTabs = CategoryTabs;
console.log('[CategoryTabs] 分类标签组件已加载');
