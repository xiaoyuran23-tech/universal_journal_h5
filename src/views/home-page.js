/**
 * HomePage - 首页视图组件
 * 整合 HeaderBar + CategoryTabs + FeaturedCard + RecordList + BottomTabBar
 * 等效 React 的 HomePage.tsx
 * @version 6.1.0
 */

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

class HomePage {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    this.hook = new RecordsHook(options);
    this._cleanup = null;
    this._rendered = false;
    
    // 确保 StatusStates 可用（兼容处理）
    this._ensureStatusStates();
  }

  /**
   * 确保 StatusStates 可用
   * @private
   */
  _ensureStatusStates() {
    if (!window.StatusStates) {
      console.warn('[HomePage] StatusStates not loaded, using fallback');
      window.StatusStates = {
        EmptyState: this._createFallbackEmptyState(),
        LoadingState: this._createFallbackLoadingState(),
        ErrorState: this._createFallbackErrorState()
      };
    }
  }

  /**
   * 创建空状态 fallback
   * @private
   */
  _createFallbackEmptyState() {
    return {
      render: (config = {}) => {
        const container = document.createElement('div');
        container.className = 'empty-state';
        container.innerHTML = `
          <div class="empty-state-icon">${config.icon || '📝'}</div>
          <h3 class="empty-state-title">${config.title || '暂无内容'}</h3>
          ${config.description ? `<p class="empty-state-desc">${config.description}</p>` : ''}
        `;
        return container;
      }
    };
  }

  /**
   * 创建加载状态 fallback
   * @private
   */
  _createFallbackLoadingState() {
    return {
      render: (config = {}) => {
        const container = document.createElement('div');
        container.className = 'loading-state';
        container.innerHTML = `
          <div class="loading-spinner"></div>
          <p class="loading-text">${config.text || '加载中...'}</p>
        `;
        return container;
      }
    };
  }

  /**
   * 创建错误状态 fallback
   * @private
   */
  _createFallbackErrorState() {
    return {
      render: (config = {}) => {
        const container = document.createElement('div');
        container.className = 'error-state';
        container.innerHTML = `
          <div class="error-state-icon">⚠️</div>
          <h3 class="error-state-title">${config.title || '加载失败'}</h3>
          <p class="error-state-message">${config.message || ''}</p>
        `;
        return container;
      }
    };
  }

  /**
   * 渲染首页
   */
  render() {
    if (!this.container) {
      console.error('[HomePage] Container not found');
      return;
    }

    // 清空容器
    this.container.innerHTML = '';

    // 创建主内容区
    const main = document.createElement('main');
    main.className = 'home-page';

    // HeaderBar
    const header = window.HeaderBar.render({
      title: '万物手札',
      showSearch: true,
      onSearch: () => this._handleSearch(),
      onCreate: () => this._handleCreate()
    });

    // 搜索输入框 (由 SearchPlugin 绑定)
    const searchBar = document.createElement('div');
    searchBar.className = 'search-bar';
    searchBar.innerHTML = `<input type="text" class="search-input" id="search-input" placeholder="搜索记录...">`;

    // CategoryTabs 容器
    const tabsContainer = document.createElement('div');
    tabsContainer.id = 'category-tabs-container';

    // 内容容器
    const contentContainer = document.createElement('div');
    contentContainer.id = 'home-content';
    contentContainer.className = 'home-content';

    main.appendChild(header);
    main.appendChild(searchBar);
    main.appendChild(tabsContainer);
    main.appendChild(contentContainer);

    // v7.0: 快捷输入框 (首页底部)
    const quickInputBar = this._renderQuickInput();
    if (quickInputBar) main.appendChild(quickInputBar);

    // 底部导航（如果存在）
    if (window.BottomTabBar) {
      const tabBar = window.BottomTabBar.render({
        active: 'home',
        onChange: (tab) => this._handleTabChange(tab)
      });
      main.appendChild(tabBar);
    }

    this.container.appendChild(main);

    // 订阅数据变化
    this._cleanup = this.hook.subscribe((state) => {
      this._renderTabs(state.categories, state.activeKey);
      this._renderContent(state);
    });

    // v7.0: 绑定快捷输入
    this.bindQuickInput();

    this._rendered = true;
  }

  /**
   * 销毁
   */
  destroy() {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }
    this._rendered = false;
  }

  /**
   * 刷新数据
   */
  async refresh() {
    await this.hook.refresh();
  }

  /**
   * 渲染分类标签
   * @private
   */
  _renderTabs(categories, activeKey) {
    const tabsContainer = document.getElementById('category-tabs-container');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    const tabs = window.CategoryTabs.render(categories, activeKey, (key) => {
      this.hook.activeKey = key;
    });
    tabsContainer.appendChild(tabs);
  }

  /**
   * 渲染内容区
   * @private
   */
  _renderContent(state) {
    const contentContainer = document.getElementById('home-content');
    if (!contentContainer) return;

    contentContainer.innerHTML = '';

    // 加载状态
    if (state.loading) {
      const loading = window.StatusStates.LoadingState.render({ text: '加载中...' });
      contentContainer.appendChild(loading);
      return;
    }

    // 错误状态
    if (state.error) {
      const error = window.StatusStates.ErrorState.render({
        message: state.error,
        onRetry: () => this.hook.refresh()
      });
      contentContainer.appendChild(error);
      return;
    }

    // 渲染回顾区域 (那年今日 → 每周回顾 → 月度总结)
    const reviewContainer = document.createElement('div');
    reviewContainer.id = 'home-review-section';
    reviewContainer.className = 'home-review-section';
    contentContainer.appendChild(reviewContainer);
    this._renderReviewSections(reviewContainer);

    // 空状态
    if (!state.records.length) {
      const empty = window.StatusStates.EmptyState.render({
        icon: '',
        title: '暂无记录',
        description: '开始记录你的第一个瞬间吧',
        actions: [
          { text: '创建记录', primary: true, onClick: () => this._handleCreate() }
        ]
      });
      contentContainer.appendChild(empty);
      return;
    }

    // FeaturedCard（如果有精选记录）
    if (state.featured) {
      const featuredCard = FeaturedCard.render(state.featured, (id) => {
        this._handleRecordClick(id);
      });
      contentContainer.appendChild(featuredCard);
    }

    // RecordList
    const list = document.createElement('div');
    list.className = 'record-list';

    state.records.forEach(record => {
      const item = this._renderRecordItem(record);
      list.appendChild(item);
    });

    contentContainer.appendChild(list);
  }

  /**
   * 渲染回顾区域
   * @private
   */
  async _renderReviewSections(container) {
    if (!window.ReviewPlugin) return;

    try {
      // 那年今日 (有记录时才显示)
      const onThisDayContainer = document.createElement('div');
      onThisDayContainer.id = 'review-container-on-this-day';
      container.appendChild(onThisDayContainer);
      window.ReviewPlugin.renderOnThisDay(onThisDayContainer);

      // 每周回顾
      const weeklyContainer = document.createElement('div');
      weeklyContainer.id = 'review-container-weekly';
      container.appendChild(weeklyContainer);
      window.ReviewPlugin.renderWeeklyReview(weeklyContainer);

      // 月度总结 (始终显示)
      const monthlyContainer = document.createElement('div');
      monthlyContainer.id = 'review-container-monthly';
      container.appendChild(monthlyContainer);
      window.ReviewPlugin.renderMonthlySummary(monthlyContainer);
    } catch (e) {
      console.error('[HomePage] Failed to render review sections:', e);
    }
  }

  /**
   * 渲染单条记录
   * @private
   */
  _renderRecordItem(record) {
    const item = document.createElement('div');
    item.className = 'record-list-item';
    item.dataset.id = record.id;

    const cover = record.cover || record.photos?.[0] || '';
    const title = record.title || record.name || '未命名';
    const city = record.city || '';
    const likes = record.likes || 0;
    const date = record.date || this._formatDate(record.createdAt);
    const metadata = record.metadata || null;

    item.innerHTML = `
      <div class="record-list-item-cover">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="${this._escape(title)}" loading="lazy" />` : ''}
      </div>
      <div class="record-list-item-content">
        <h4 class="record-list-item-title">${this._escape(title)}</h4>
        <div class="record-list-item-meta">
          <span>${escapeHtml(city)}</span>
          <span>${likes > 0 ? '♥ ' + likes : ''}</span>
        </div>
        ${this._renderMetadataBadges(metadata)}
      </div>
    `;

    item.addEventListener('click', () => this._handleRecordClick(record.id));

    return item;
  }

  /**
   * 事件处理
   * @private
   */
  _handleSearch() {
    console.log('[HomePage] Search clicked');
    // 搜索功能在首页内部实现，不导航到其他页面
  }

  _handleCreate() {
    console.log('[HomePage] Create clicked');
    if (window.Router) {
      window.Router.navigate('editor');
    }
  }

  _handleTabChange(tab) {
    console.log('[HomePage] Tab changed:', tab);
    if (window.Router) {
      window.Router.navigate(tab);
    }
  }

  _handleRecordClick(id) {
    console.log('[HomePage] Record clicked:', id);
    const detailPage = document.getElementById('page-detail');
    if (!detailPage) return;

    // 切换页面显示
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    detailPage.classList.add('active');

    // 加载记录数据
    const store = window.Store;
    if (!store) return;
    const records = store.getState('records.list') || [];
    const record = records.find(r => r.id === id);
    if (!record) return;

    const body = document.getElementById('detail-body');
    if (body) {
      body.innerHTML = `
        <h3 class="detail-item-title">${this._escape(record.name)}</h3>
        ${record.notes ? `<p class="detail-item-notes">${this._escape(record.notes)}</p>` : ''}
        <div class="detail-item-meta">
          <span>${this._formatDate(record.createdAt)}</span>
          ${record.tags && record.tags.length > 0 ? `<span>${record.tags.map(t => this._escape(t)).join(' ')}</span>` : ''}
        </div>
      `;
    }

    // 绑定详情页第按钮事件
    this._bindDetailButtons(id);
  }

  /**
   * 绑定详情页按钮
   * @private
   */
  _bindDetailButtons(recordId) {
    const backBtn = document.getElementById('detail-back-btn');
    if (backBtn) {
      backBtn.onclick = () => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-home')?.classList.add('active');
      };
    }

    const favBtn = document.getElementById('detail-favorite-btn');
    if (favBtn) {
      favBtn.onclick = async () => {
        const store = window.Store;
        if (store) {
          const records = store.getState('records.list') || [];
          const record = records.find(r => r.id === recordId);
          if (record) {
            store.dispatch({ type: 'records/update', payload: { id: recordId, updates: { favorite: !record.favorite } } });
          }
        }
      };
    }

    const editBtn = document.getElementById('detail-edit-btn');
    if (editBtn) {
      editBtn.onclick = () => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-form')?.classList.add('active');
      };
    }

    const deleteBtn = document.getElementById('detail-delete-btn');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (confirm('确定要删除这条记录吗？')) {
          const store = window.Store;
          if (store) {
            store.dispatch({ type: 'records/delete', payload: recordId });
          }
          document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
          document.getElementById('page-home')?.classList.add('active');
        }
      };
    }
  }

  /**
   * 渲染元数据徽章
   * @private
   */
  _renderMetadataBadges(metadata) {
    if (!metadata) return '';

    const badges = [];

    // 字数 + 阅读时间徽章
    if (metadata.wordCount > 0 || metadata.readingTime > 0) {
      const wc = metadata.wordCount || 0;
      const rt = metadata.readingTime || 0;
      badges.push(`<span class="metadata-badge">${wc}字 ${rt}分钟</span>`);
    }

    // 照片/位置图标
    const iconBadges = [];
    if (metadata.hasPhotos) iconBadges.push('photos');
    if (metadata.hasLocation) iconBadges.push('location');
    if (iconBadges.length > 0) {
      badges.push(`<span class="metadata-badge metadata-icon-badges">${iconBadges.map(t => {
        if (t === 'photos') return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
        if (t === 'location') return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
        return '';
      }).join('')}</span>`);
    }

    // 情绪标签 chips
    if (metadata.emotionTags && metadata.emotionTags.length > 0) {
      const chips = metadata.emotionTags.map(tag => {
        const colorClass = `emotion-${tag}`;
        return `<span class="emotion-chip ${colorClass}">${tag}</span>`;
      }).join('');
      badges.push(`<span class="emotion-chips">${chips}</span>`);
    }

    if (badges.length === 0) return '';
    return `<div class="metadata-badges">${badges.join('')}</div>`;
  }

  /**
   * v7.0: 渲染快捷输入框
   * @private
   */
  _renderQuickInput() {
    const bar = document.createElement('div');
    bar.className = 'quick-input-bar';
    bar.id = 'quick-input-bar';
    bar.innerHTML = `
      <input type="text" class="quick-input-field" id="quick-input" placeholder="快速记录..." autocomplete="off">
      <button class="quick-send-btn" id="quick-send-btn" disabled>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    `;
    return bar;
  }

  /**
   * v7.0: 绑定快捷输入事件 (在 render 后调用)
   */
  bindQuickInput() {
    const input = document.getElementById('quick-input');
    const btn = document.getElementById('quick-send-btn');
    if (!input) return;

    input.addEventListener('input', () => { btn.disabled = !input.value.trim(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        this._handleQuickSave(input.value.trim());
        input.value = '';
        btn.disabled = true;
      }
    });
    btn.addEventListener('click', () => {
      if (input.value.trim()) {
        this._handleQuickSave(input.value.trim());
        input.value = '';
        btn.disabled = true;
      }
    });
  }

  /**
   * v7.0: 处理快捷保存
   * @private
   */
  async _handleQuickSave(text) {
    const record = {
      name: text, notes: '', tags: [], photos: [],
      status: 'in-use'
    };

    try {
      if (window.RecordsPlugin) {
        await window.RecordsPlugin.createRecord(record);
        console.log('[HomePage] Quick saved via RecordsPlugin:', text);
      } else if (window.Store) {
        // Fallback: direct Store dispatch
        const now = Date.now();
        const fallback = {
          ...record,
          id: `rec_${now}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: now, updatedAt: now, favorite: false
        };
        const list = [...(window.Store.getState('records.list') || [])];
        list.unshift(fallback);
        window.Store.dispatch({ type: 'records/add', payload: fallback });
      } else {
        console.warn('[HomePage] Store not available for quick save');
      }
      window.StreakService?.recordToday();
      const toast = document.getElementById('toast');
      if (toast) { toast.textContent = '已记录'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1500); }
    } catch (e) { console.error('[HomePage] Quick save failed:', e); }
  }

  /**
   * 工具方法
   * @private
   */
  _escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  _formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
}

window.HomePage = HomePage;
console.log('[HomePage] 首页视图组件已加载');
