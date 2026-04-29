/**
 * HeaderBar - 顶部导航组件
 * 标题 + 搜索按钮
 * @version 6.0.0
 */

class HeaderBar {
  /**
   * 渲染顶部导航
   * @param {Object} config
   * @param {string} [config.title] - 标题
   * @param {boolean} [config.showSearch=true] - 显示搜索按钮
   * @param {Function} [config.onSearch] - 搜索回调
   * @param {Function} [config.onCreate] - 创建回调
   * @returns {HTMLElement}
   */
  static render(config = {}) {
    const {
      title = '万物手札',
      showSearch = true,
      onSearch,
      onCreate
    } = config;

    const header = document.createElement('header');
    header.className = 'header-bar';

    header.innerHTML = `
      <h1 class="header-bar-title">${this._escape(title)}</h1>
      <div class="header-bar-actions">
        ${showSearch ? `
          <button class="header-bar-btn" data-action="search" aria-label="搜索">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        ` : ''}
        <button class="header-bar-btn header-bar-btn-primary" data-action="create" aria-label="创建">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    `;

    // 事件绑定
    if (onSearch) {
      header.querySelector('[data-action="search"]')?.addEventListener('click', onSearch);
    }
    if (onCreate) {
      header.querySelector('[data-action="create"]')?.addEventListener('click', onCreate);
    }

    return header;
  }

  /**
   * HTML 转义
   * @private
   */
  static _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

window.HeaderBar = HeaderBar;
console.log('[HeaderBar] 顶部导航组件已加载');
