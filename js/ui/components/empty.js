/**
 * EmptyState - 空状态组件 (js compat version)
 * 提供友好的空状态页面，包含引导性内容和操作按钮
 * @version 6.1.0
 */

// 幂等加载：防止与 src/components/base/status-states.js 重复声明
if (!window.EmptyState) {
class EmptyState {
  /**
   * 渲染空状态
   * @param {Object} config - 配置对象
   * @param {string} config.container - 容器选择器或元素
   * @param {string} config.icon - SVG 图标名称 (record, calendar, template, search, sync)
   * @param {string} config.title - 标题文本
   * @param {string} config.description - 描述文本
   * @param {Array} config.actions - 操作按钮数组 [{text, primary, onClick}]
   */
  static render(config) {
    const {
      container,
      icon = 'record',
      title = '暂无内容',
      description = '点击"+"按钮开始创建',
      actions = []
    } = config;

    const containerEl = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;

    if (!containerEl) {
      console.warn('[EmptyState] Container not found:', container);
      return;
    }

    const iconSvg = this._getIconSvg(icon);

    const actionsHtml = actions.map(action => `
      <button class="empty-state-btn ${action.primary ? 'primary' : ''}" 
              data-action="${action.text}">
        ${action.text}
      </button>
    `).join('');

    containerEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${iconSvg}</div>
        <h3 class="empty-state-title">${title}</h3>
        <p class="empty-state-description">${description}</p>
        ${actionsHtml ? `<div class="empty-state-actions">${actionsHtml}</div>` : ''}
      </div>
    `;

    // 绑定按钮事件
    if (actions.length > 0) {
      containerEl.querySelectorAll('.empty-state-btn').forEach((btn, index) => {
        btn.addEventListener('click', actions[index].onClick);
      });
    }
  }

  /**
   * 获取 SVG 图标
   * @private
   */
  static _getIconSvg(name) {
    const icons = {
      record: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="30" y="25" width="60" height="70" rx="8" stroke="currentColor" stroke-width="4"/>
        <line x1="45" y1="45" x2="75" y2="45" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <line x1="45" y1="60" x2="75" y2="60" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <line x1="45" y1="75" x2="65" y2="75" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
        <circle cx="85" cy="85" r="16" fill="var(--primary-color, #4A90D9)" stroke="white" stroke-width="3"/>
        <line x1="85" y1="79" x2="85" y2="91" stroke="white" stroke-width="3" stroke-linecap="round"/>
        <line x1="79" y1="85" x2="91" y2="85" stroke="white" stroke-width="3" stroke-linecap="round"/>
      </svg>`,
      calendar: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="35" width="70" height="60" rx="8" stroke="currentColor" stroke-width="4"/>
        <line x1="25" y1="55" x2="95" y2="55" stroke="currentColor" stroke-width="4"/>
        <line x1="40" y1="25" x2="40" y2="40" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <line x1="80" y1="25" x2="80" y2="40" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <circle cx="45" cy="70" r="4" fill="currentColor"/>
        <circle cx="60" cy="70" r="4" fill="currentColor"/>
        <circle cx="75" cy="70" r="4" fill="currentColor"/>
        <circle cx="45" cy="85" r="4" fill="currentColor"/>
        <circle cx="60" cy="85" r="4" fill="currentColor"/>
      </svg>`,
      template: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="25" width="70" height="70" rx="8" stroke="currentColor" stroke-width="4"/>
        <rect x="35" y="35" width="25" height="25" rx="4" stroke="currentColor" stroke-width="3"/>
        <rect x="65" y="35" width="20" height="25" rx="4" stroke="currentColor" stroke-width="3"/>
        <rect x="35" y="65" width="50" height="20" rx="4" stroke="currentColor" stroke-width="3"/>
      </svg>`,
      search: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="55" cy="55" r="25" stroke="currentColor" stroke-width="4"/>
        <line x1="75" y1="75" x2="95" y2="95" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <circle cx="45" cy="45" r="4" fill="currentColor"/>
        <circle cx="55" cy="45" r="4" fill="currentColor"/>
        <circle x1="65" y1="45" r="4" fill="currentColor"/>
      </svg>`,
      sync: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M40 35 C40 25, 80 25, 80 35" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <path d="M80 85 C80 95, 40 95, 40 85" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <polyline points="35,30 40,35 45,30" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="75,90 80,85 85,90" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    };

    return icons[name] || icons.record;
  }
}

// 全局暴露
window.EmptyState = EmptyState;

console.log('[EmptyState] 空状态组件已初始化');
} else {
  console.log('[EmptyState] 已存在，跳过重复加载');
}
