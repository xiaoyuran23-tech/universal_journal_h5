/**
 * UI Components - 布局组件
 * 提供 TabBar, FAB 等布局组件
 * @version 6.1.0
 */

// ===================================
// TabBar Component - 底部导航栏
// ===================================
class TabBar {
  /**
   * 渲染 TabBar
   * @param {Array} tabs - Tab 配置数组 [{id, icon, label, badge}]
   * @param {string} activeTab - 当前激活的 Tab ID
   * @param {Function} onTabChange - Tab 切换回调
   * @returns {HTMLElement}
   */
  static render(tabs, activeTab, onTabChange) {
    const tabBar = document.createElement('nav');
    tabBar.className = 'tab-bar';

    tabs.forEach(tab => {
      const tabItem = document.createElement('button');
      tabItem.className = `tab-item ${tab.id === activeTab ? 'active' : ''}`;
      tabItem.dataset.page = tab.id;

      // 图标
      const iconDiv = document.createElement('div');
      iconDiv.className = 'tab-icon';
      iconDiv.innerHTML = tab.icon;
      tabItem.appendChild(iconDiv);

      // 标签
      const labelSpan = document.createElement('span');
      labelSpan.className = 'tab-label';
      labelSpan.textContent = tab.label;
      tabItem.appendChild(labelSpan);

      // 角标
      if (tab.badge && tab.badge > 0) {
        const badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = tab.badge > 99 ? '99+' : tab.badge;
        tabItem.appendChild(badge);
      }

      // 点击事件
      tabItem.addEventListener('click', () => {
        if (onTabChange) {
          onTabChange(tab.id);
        }
      });

      tabBar.appendChild(tabItem);
    });

    return tabBar;
  }

  /**
   * 更新 TabBar 激活状态
   * @param {HTMLElement} tabBar
   * @param {string} activeTab
   */
  static setActive(tabBar, activeTab) {
    tabBar.querySelectorAll('.tab-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === activeTab);
    });
  }

  /**
   * 更新角标
   * @param {HTMLElement} tabBar
   * @param {string} tabId
   * @param {number} badge
   */
  static setBadge(tabBar, tabId, badge) {
    const tabItem = tabBar.querySelector(`[data-page="${tabId}"]`);
    if (!tabItem) return;

    let badgeEl = tabItem.querySelector('.tab-badge');
    
    if (badge && badge > 0) {
      if (!badgeEl) {
        badgeEl = document.createElement('span');
        badgeEl.className = 'tab-badge';
        tabItem.appendChild(badgeEl);
      }
      badgeEl.textContent = badge > 99 ? '99+' : badge;
      badgeEl.style.display = '';
    } else if (badgeEl) {
      badgeEl.style.display = 'none';
    }
  }
}

// ===================================
// FAB Component - 悬浮操作按钮
// ===================================
class FAB {
  /**
   * 渲染 FAB
   * @param {Object} config
   * @param {string} [config.icon] - SVG 图标 HTML
   * @param {string} [config.position] - 位置：bottom-right, bottom-left, top-right, top-left
   * @param {Function} [config.onClick] - 点击回调
   * @returns {HTMLElement}
   */
  static render(config = {}) {
    const {
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>`,
      position = 'bottom-right',
      onClick
    } = config;

    const fab = document.createElement('button');
    fab.className = `fab fab-${position}`;
    fab.setAttribute('aria-label', '新建');
    fab.innerHTML = icon;

    if (onClick) {
      fab.addEventListener('click', onClick);
    }

    return fab;
  }

  /**
   * 显示 FAB
   */
  static show(fab) {
    if (fab) {
      fab.style.display = '';
      fab.style.opacity = '1';
      fab.style.transform = 'scale(1)';
    }
  }

  /**
   * 隐藏 FAB
   */
  static hide(fab) {
    if (fab) {
      fab.style.opacity = '0';
      fab.style.transform = 'scale(0)';
      setTimeout(() => {
        fab.style.display = 'none';
      }, 300);
    }
  }
}

// ===================================
// EmptyState Component - 空状态
// ===================================
class EmptyState {
  /**
   * 渲染空状态
   * @param {Object} config
   * @param {string} [config.icon] - 图标名称或 SVG
   * @param {string} [config.title] - 标题
   * @param {string} [config.description] - 描述
   * @param {Array} [config.actions] - 操作按钮 [{text, primary, onClick}]
   * @returns {HTMLElement}
   */
  static render(config = {}) {
    const {
      icon = 'record',
      title = '暂无内容',
      description = '',
      actions = []
    } = config;

    const container = document.createElement('div');
    container.className = 'empty-state';

    // 图标
    const iconDiv = document.createElement('div');
    iconDiv.className = 'empty-state-icon';
    iconDiv.innerHTML = EmptyState._getIconSvg(icon);
    container.appendChild(iconDiv);

    // 标题
    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.className = 'empty-state-title';
      titleEl.textContent = title;
      container.appendChild(titleEl);
    }

    // 描述
    if (description) {
      const descEl = document.createElement('p');
      descEl.className = 'empty-state-description';
      descEl.textContent = description;
      container.appendChild(descEl);
    }

    // 操作按钮
    if (actions.length > 0) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'empty-state-actions';
      
      actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = `empty-state-btn ${action.primary ? 'primary' : ''}`;
        btn.textContent = action.text;
        if (action.onClick) {
          btn.addEventListener('click', action.onClick);
        }
        actionsDiv.appendChild(btn);
      });
      
      container.appendChild(actionsDiv);
    }

    return container;
  }

  /**
   * 获取图标 SVG
   * @private
   */
  static _getIconSvg(name) {
    const icons = {
      record: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="30" y="25" width="60" height="70" rx="8" stroke="currentColor" stroke-width="4"/>
        <line x1="45" y1="45" x2="75" y2="45" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <line x1="45" y1="60" x2="75" y2="60" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <line x1="45" y1="75" x2="65" y2="75" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>`,
      search: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="55" cy="55" r="25" stroke="currentColor" stroke-width="4"/>
        <line x1="75" y1="75" x2="95" y2="95" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      </svg>`,
      calendar: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="35" width="70" height="60" rx="8" stroke="currentColor" stroke-width="4"/>
        <line x1="25" y1="55" x2="95" y2="55" stroke="currentColor" stroke-width="4"/>
      </svg>`
    };
    return icons[name] || icons.record;
  }
}

// 全局暴露
window.LayoutComponents = {
  TabBar,
  FAB,
  EmptyState
};

console.log('[LayoutComponents] 布局组件库已加载');
