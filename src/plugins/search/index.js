/**
 * Search Plugin - 全文搜索插件
 * 基于 IndexedDB 搜索索引，支持中文子串匹配
 * @version 1.0.0
 */

if (!window.SearchPlugin) {
window.SearchPlugin = {
  name: 'search',
  version: '1.0.0',
  dependencies: ['records'],

  _debounceTimer: null,
  _currentQuery: '',
  _isSearching: false,
  _searchHistory: [],
  _initialized: false,
  _historyFocusHandler: null,
  _historyCloseHandler: null,

  // 配置
  _config: {
    debounceMs: 300,
    maxHistory: 5,
    historyKey: 'journal_search_history'
  },

  /**
   * 初始化插件
   */
  async init() {
    console.log('[SearchPlugin] Initializing...');
    this._loadHistory();
    this._initialized = true;
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[SearchPlugin] Starting...');
    // 延迟绑定，等待 DOM 就绪
    this._bindSearchInput();
    this._bindClearButton();
    this._renderHistory();
  },

  /**
   * 重新绑定搜索输入框（HomePage 渲染后调用）
   */
  rebind() {
    console.log('[SearchPlugin] Rebinding search input...');
    this._unbindSearchInput();
    this._bindSearchInput();
    this._bindClearButton();
  },

  /**
   * 停止插件
   */
  stop() {
    this._unbindSearchInput();
    this._debounceTimer = null;
  },

  /**
   * 执行搜索
   * @param {string} query - 搜索关键词
   * @returns {Promise<Array>} 匹配的记录列表
   */
  async executeSearch(query) {
    if (!query || !query.trim()) {
      this._clearSearch();
      return [];
    }

    this._currentQuery = query.trim();
    this._isSearching = true;
    this._showSearchIndicator(true);

    try {
      // 使用 StorageService 的 IndexedDB 搜索
      const results = await StorageService.search(this._currentQuery);

      if (results.length === 0) {
        this._showEmptyState();
      } else {
        // 更新 Store 的 filtered 列表
        if (window.Store) {
          window.Store.dispatch({
            type: 'SET_STATE',
            payload: {
              records: {
                ...window.Store.getState('records'),
                filtered: results
              }
            }
          });
        }
      }

      // 保存搜索历史
      this._addToHistory(this._currentQuery);

      return results;
    } catch (error) {
      console.error('[SearchPlugin] Search failed:', error);
      this._showErrorState(error.message);
      return [];
    } finally {
      this._isSearching = false;
      this._showSearchIndicator(false);
    }
  },

  /**
   * 清除搜索
   */
  clearSearch() {
    this._clearSearch();
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    this._hideSearchUI();
  },

  /**
   * 获取搜索历史
   * @returns {Array}
   */
  getHistory() {
    return [...this._searchHistory];
  },

  /**
   * 清除搜索历史
   */
  clearHistory() {
    this._searchHistory = [];
    this._saveHistory();
    this._renderHistory();
  },

  /**
   * 绑定搜索输入框
   * @private
   */
  _bindSearchInput() {
    // 首页搜索框
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      this._onSearchInput = this._onSearchInput.bind(this);
      this._onSearchKeydown = this._onSearchKeydown.bind(this);
      searchInput.addEventListener('input', this._onSearchInput);
      searchInput.addEventListener('keydown', this._onSearchKeydown);
    }

    // 收藏页搜索框
    const favSearchInput = document.getElementById('search-input-favorites');
    if (favSearchInput) {
      favSearchInput.addEventListener('input', (e) => {
        // 收藏页搜索暂时使用本地过滤
        this._filterFavorites(e.target.value);
      });
    }
  },

  /**
   * 解绑搜索输入框
   * @private
   */
  _unbindSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (searchInput && this._onSearchInput) {
      searchInput.removeEventListener('input', this._onSearchInput);
      searchInput.removeEventListener('keydown', this._onSearchKeydown);
    }
  },

  /**
   * 绑定清除按钮
   * @private
   */
  _bindClearButton() {
    // 动态创建清除按钮 (搜索框聚焦时显示)
    const searchBar = document.querySelector('.search-bar');
    if (searchBar && !document.getElementById('search-clear-btn')) {
      const clearBtn = document.createElement('button');
      clearBtn.id = 'search-clear-btn';
      clearBtn.className = 'search-clear-btn';
      clearBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>';
      clearBtn.style.display = 'none';
      clearBtn.addEventListener('click', () => this.clearSearch());
      searchBar.appendChild(clearBtn);
    }
  },

  /**
   * 搜索输入事件处理
   * @private
   */
  _onSearchInput(e) {
    const query = e.target.value.trim();
    const clearBtn = document.getElementById('search-clear-btn');

    // 显示/隐藏清除按钮
    if (clearBtn) {
      clearBtn.style.display = query ? 'flex' : 'none';
    }

    // 防抖搜索
    clearTimeout(this._debounceTimer);
    if (!query) {
      this._clearSearch();
      this._hideSearchUI();
      return;
    }

    this._debounceTimer = setTimeout(async () => {
      await this.executeSearch(query);
      // 搜索完成后渲染搜索历史下拉
      this._renderHistory();
    }, this._config.debounceMs);
  },

  /**
   * 搜索框键盘事件 (ESC 清除)
   * @private
   */
  _onSearchKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.clearSearch();
      e.target.blur();
    }
    if (e.key === 'Enter') {
      // 立即搜索，不等待防抖
      clearTimeout(this._debounceTimer);
      const query = e.target.value.trim();
      if (query) {
        this.executeSearch(query);
      }
    }
  },

  /**
   * 清除搜索状态
   * @private
   */
  _clearSearch() {
    this._currentQuery = '';
    this._debounceTimer = null;

    // 恢复 Store 的 filtered 列表
    if (window.Store) {
      const list = window.Store.getState('records.list') || [];
      window.Store.dispatch({
        type: 'SET_STATE',
        payload: {
          records: {
            ...window.Store.getState('records'),
            filtered: list
          }
        }
      });
    }

    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
  },

  /**
   * 显示搜索指示器
   * @private
   */
  _showSearchIndicator(show) {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.classList.toggle('searching', show);
    }
  },

  /**
   * 显示空结果状态
   * @private
   */
  _showEmptyState() {
    const container = document.getElementById('items-container');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state search-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
          <path d="M8 11h6"></path>
        </svg>
        <p class="empty-title">未找到相关记录</p>
        <p class="empty-desc">尝试其他关键词，或使用更短的词语搜索</p>
        <p class="search-query-hint" style="margin-top: 8px; font-size: 12px;">搜索: "${this._escapeHtml(this._currentQuery)}"</p>
      </div>
    `;
  },

  /**
   * 显示错误状态
   * @private
   */
  _showErrorState(message) {
    const container = document.getElementById('items-container');
    if (!container) return;

    container.innerHTML = `
      <div class="error-state">
        <div class="error-state-icon">&#9888;</div>
        <h3 class="error-state-title">搜索失败</h3>
        <p class="error-state-message">${this._escapeHtml(message)}</p>
      </div>
    `;
  },

  /**
   * 隐藏搜索 UI 状态
   * @private
   */
  _hideSearchUI() {
    const container = document.getElementById('items-container');
    if (container && container.querySelector('.search-empty-state, .error-state')) {
      // 恢复记录列表，由 Store 变化触发重新渲染
    }
  },

  /**
   * 添加搜索历史
   * @private
   */
  _addToHistory(query) {
    if (!query) return;

    // 移除重复项
    this._searchHistory = this._searchHistory.filter(q => q !== query);

    // 添加到头部
    this._searchHistory.unshift(query);

    // 限制数量
    if (this._searchHistory.length > this._config.maxHistory) {
      this._searchHistory = this._searchHistory.slice(0, this._config.maxHistory);
    }

    this._saveHistory();
    this._renderHistory();
  },

  /**
   * 加载搜索历史
   * @private
   */
  _loadHistory() {
    try {
      const saved = window.safeLocalStorage.getItem(this._config.historyKey);
      if (saved) {
        this._searchHistory = JSON.parse(saved);
      }
    } catch (e) {
      this._searchHistory = [];
    }
  },

  /**
   * 保存搜索历史
   * @private
   */
  _saveHistory() {
    try {
      window.safeLocalStorage.setItem(this._config.historyKey, JSON.stringify(this._searchHistory));
    } catch (e) {
      // 忽略存储失败
    }
  },

  /**
   * 渲染搜索历史
   * @private
   */
  _renderHistory() {
    const searchBar = document.querySelector('.search-bar');
    if (!searchBar) return;

    // 移除旧的下拉
    const oldDropdown = document.getElementById('search-history-dropdown');
    if (oldDropdown) oldDropdown.remove();

    if (this._searchHistory.length === 0) return;

    // 创建历史下拉
    const dropdown = document.createElement('div');
    dropdown.id = 'search-history-dropdown';
    dropdown.className = 'search-history-dropdown';

    dropdown.innerHTML = `
      <div class="search-history-header">
        <span>最近搜索</span>
        <button id="clear-search-history-btn" class="clear-history-btn">清除</button>
      </div>
      ${this._searchHistory.map(q => `
        <div class="search-history-item" data-query="${this._escapeHtml(q)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>${this._escapeHtml(q)}</span>
        </div>
      `).join('')}
    `;

    // 点击历史项执行搜索
    dropdown.querySelectorAll('.search-history-item').forEach(item => {
      item.addEventListener('click', () => {
        const query = item.dataset.query;
        const input = document.getElementById('search-input');
        if (input) {
          input.value = query;
          input.focus();
          this.executeSearch(query);
        }
        dropdown.style.display = 'none';
      });
    });

    // 清除历史按钮
    const clearBtn = dropdown.querySelector('#clear-search-history-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearHistory();
      });
    }

    // v7.0.3: 移除旧的监听器，防止累积
    if (searchInput && this._historyFocusHandler) {
      searchInput.removeEventListener('focus', this._historyFocusHandler);
    }
    if (this._historyCloseHandler) {
      document.removeEventListener('click', this._historyCloseHandler);
    }

    // 搜索框聚焦时显示历史
    this._historyFocusHandler = () => {
      if (!searchInput.value.trim()) {
        dropdown.style.display = 'block';
      }
    };
    if (searchInput) {
      searchInput.addEventListener('focus', this._historyFocusHandler);
    }

    // 点击外部关闭
    this._historyCloseHandler = (e) => {
      if (!searchBar.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    };
    document.addEventListener('click', this._historyCloseHandler);

    searchBar.style.position = 'relative';
    searchBar.appendChild(dropdown);
  },

  /**
   * 收藏页本地搜索过滤
   * @private
   */
  _filterFavorites(query) {
    if (!window.FavoritesPlugin) return;
    FavoritesPlugin._filterQuery = query;
    if (typeof FavoritesPlugin.renderFavorites === 'function') {
      FavoritesPlugin.renderFavorites();
    }
  },

  /**
   * HTML 转义 (XSS 防护)
   * @private
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

console.log('[SearchPlugin] 全文搜索插件已定义');
} else {
  console.log('[SearchPlugin] 已存在，跳过重复加载');
}
