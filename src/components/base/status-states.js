/**
 * Status States - 状态组件
 * EmptyState / LoadingState / ErrorState
 * @version 6.0.0
 */

// ===================================
// EmptyState Component
// ===================================
class EmptyState {
  /**
   * 渲染空状态
   * @param {Object} config
   * @param {string} [config.icon] - 图标 emoji
   * @param {string} [config.title] - 标题
   * @param {string} [config.description] - 描述
   * @param {Array} [config.actions] - 操作按钮 [{text, primary, onClick}]
   * @returns {HTMLElement}
   */
  static render(config = {}) {
    const {
      icon = '📝',
      title = '暂无内容',
      description = '',
      actions = []
    } = config;

    const container = document.createElement('div');
    container.className = 'empty-state';

    container.innerHTML = `
      <div class="empty-state-icon">${icon}</div>
      <h3 class="empty-state-title">${title}</h3>
      ${description ? `<p class="empty-state-desc">${description}</p>` : ''}
      <div class="empty-state-actions">
        ${actions.map(a => `
          <button class="btn ${a.primary ? 'btn-primary' : 'btn-outline'}" data-action="${a.text}">
            ${a.text}
          </button>
        `).join('')}
      </div>
    `;

    // 绑定事件
    if (actions.length > 0) {
      container.querySelectorAll('.btn').forEach((btn, i) => {
        if (actions[i]?.onClick) {
          btn.addEventListener('click', actions[i].onClick);
        }
      });
    }

    return container;
  }
}

// ===================================
// LoadingState Component
// ===================================
class LoadingState {
  /**
   * 渲染加载状态
   * @param {Object} config
   * @param {string} [config.text] - 加载文案
   * @param {string} [config.type] - 类型: skeleton | spinner
   * @returns {HTMLElement}
   */
  static render(config = {}) {
    const {
      text = '加载中...',
      type = 'spinner'
    } = config;

    if (type === 'skeleton') {
      return LoadingState._renderSkeleton();
    }

    const container = document.createElement('div');
    container.className = 'loading-state';
    container.innerHTML = `
      <div class="loading-spinner"></div>
      <p class="loading-text">${text}</p>
    `;
    return container;
  }

  /**
   * 骨架屏
   * @private
   */
  static _renderSkeleton() {
    const container = document.createElement('div');
    container.className = 'skeleton-state';
    
    container.innerHTML = `
      <div class="skeleton-card">
        <div class="skeleton-cover"></div>
        <div class="skeleton-content">
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text short"></div>
        </div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton-cover"></div>
        <div class="skeleton-content">
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text short"></div>
        </div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton-cover"></div>
        <div class="skeleton-content">
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text short"></div>
        </div>
      </div>
    `;
    
    return container;
  }
}

// ===================================
// ErrorState Component
// ===================================
class ErrorState {
  /**
   * 渲染错误状态
   * @param {Object} config
   * @param {string} [config.title] - 错误标题
   * @param {string} [config.message] - 错误信息
   * @param {Function} [config.onRetry] - 重试回调
   * @returns {HTMLElement}
   */
  static render(config = {}) {
    const {
      title = '加载失败',
      message = '请检查网络连接后重试',
      onRetry
    } = config;

    const container = document.createElement('div');
    container.className = 'error-state';

    container.innerHTML = `
      <div class="error-state-icon">⚠️</div>
      <h3 class="error-state-title">${title}</h3>
      <p class="error-state-message">${message}</p>
      <button class="btn btn-primary error-retry-btn">重新加载</button>
    `;

    if (onRetry) {
      container.querySelector('.error-retry-btn').addEventListener('click', onRetry);
    }

    return container;
  }
}

// 全局暴露
window.StatusStates = {
  EmptyState,
  LoadingState,
  ErrorState
};

console.log('[StatusStates] 状态组件已加载');
