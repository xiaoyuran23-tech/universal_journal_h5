/**
 * Favorites Plugin - 收藏管理插件
 * 提供收藏列表和收藏筛选功能
 * @version 6.1.0
 */

// 幂等加载保护
if (!window.FavoritesPlugin) {
const FavoritesPlugin = {
  name: 'favorites',
  version: '1.0.0',
  dependencies: ['records'],
  
  _eventsBound: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[FavoritesPlugin] Initializing...');
    
    this.routes = [
      {
        path: 'favorites',
        title: '收藏',
        component: 'favorites-view'
      }
    ];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[FavoritesPlugin] Starting...');
    this._bindEvents();
    this._render();
    
    // 订阅记录变化
    if (window.Store) {
      window.Store.subscribe((newState, prevState) => {
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
    console.log('[FavoritesPlugin] Stopping...');
    this._eventsBound = false;
  },

  /**
   * 路由定义
   */
  routes: [],

  /**
   * Actions
   */
  actions: {
    'favorites/toggle': (state, id) => {
      const list = state.records.list.map(item => {
        if (item.id === id) {
          return { ...item, favorite: !item.favorite };
        }
        return item;
      });
      
      const filtered = list.filter(item => item.favorite);
      
      return {
        ...state,
        records: {
          ...state.records,
          list,
          filtered: state.records.filtered === state.records.list ? filtered : state.records.filtered
        }
      };
    }
  },

  /**
   * 渲染收藏列表
   * @private
   */
  _render() {
    const container = document.getElementById('favorites-container');
    if (!container) return;

    const records = window.Store ? window.Store.getState('records.list') : [];
    const favorites = records.filter(item => item.favorite);

    if (favorites.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>还没有收藏的记录</p>
          <p class="empty-hint">在记录详情页点击星标即可收藏</p>
        </div>
      `;
      return;
    }

    // 按收藏时间排序 (假设 updatedAt 是最近操作时间)
    const sorted = [...favorites].sort((a, b) => {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

    let html = `<div class="favorites-list">`;
    
    sorted.forEach(item => {
      html += this._renderItemCard(item);
    });
    
    html += `</div>`;
    container.innerHTML = html;
  },

  /**
   * 渲染收藏卡片
   * @param {Object} item
   * @returns {string}
   * @private
   */
  _renderItemCard(item) {
    const date = new Date(item.createdAt || item.date || 0);
    const dateStr = isNaN(date.getTime()) ? '未知日期' : date.toLocaleDateString('zh-CN');

    return `
      <div class="favorite-card" data-id="${item.id}">
        ${item.photos && item.photos.length > 0 ? `
          <div class="favorite-card-photo">
            <img src="${item.photos[0]}" alt="${this._escapeHtml(item.name)}" loading="lazy" />
          </div>
        ` : ''}
        <div class="favorite-card-content">
          <div class="favorite-card-header">
            <h4 class="favorite-card-title">${this._escapeHtml(item.name || '未命名')}</h4>
            <button class="favorite-card-unstar" data-action="unstar" data-id="${item.id}">⭐</button>
          </div>
          ${item.tags && item.tags.length > 0 ? `
            <div class="favorite-card-tags">
              ${item.tags.slice(0, 3).map(tag => `<span class="tag-small">#${this._escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
          <p class="favorite-card-notes">${this._stripHtml(item.notes) || '暂无备注'}</p>
          <div class="favorite-card-meta">
            <span class="favorite-card-date">${dateStr}</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 切换收藏状态
   * @param {string} id
   * @private
   */
  async _toggleFavorite(id) {
    if (window.RecordsPlugin) {
      const records = window.Store.getState('records.list');
      const item = records.find(r => r.id === id);
      if (item) {
        await RecordsPlugin.updateRecord(id, { favorite: !item.favorite });
        this._showToast(item.favorite ? '已取消收藏' : '已收藏');
      }
    }
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const container = document.getElementById('favorites-container');
    if (!container) return;

    // 事件委托
    container.addEventListener('click', (e) => {
      // 取消收藏按钮
      const unstarBtn = e.target.closest('[data-action="unstar"]');
      if (unstarBtn && unstarBtn.dataset.id) {
        e.stopPropagation();
        this._toggleFavorite(unstarBtn.dataset.id);
        return;
      }

      // 卡片点击
      const card = e.target.closest('.favorite-card');
      if (card && card.dataset.id && window.App) {
        App.showDetail(card.dataset.id);
      }
    });
  },

  /**
   * HTML 转义
   * @private
   */
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * 去除 HTML 标签
   * @private
   */
  _stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  },

  /**
   * 显示 Toast
   * @private
   */
  _showToast(message) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(message, { duration: 2000 });
    } else if (window.App) {
      App.showToast(message);
    }
  }
};

// 全局暴露
window.FavoritesPlugin = FavoritesPlugin;

console.log('[FavoritesPlugin] 收藏插件已定义');
} else {
  console.log('[FavoritesPlugin] 已存在，跳过加载');
}
