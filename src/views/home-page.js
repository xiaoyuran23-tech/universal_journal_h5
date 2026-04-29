/**
 * HomePage - 首页视图组件
 * 整合 HeaderBar + CategoryTabs + FeaturedCard + RecordList + BottomTabBar
 * 等效 React 的 HomePage.tsx
 * @version 6.0.0
 */

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
    const header = HeaderBar.render({
      title: '万物手札',
      showSearch: true,
      onSearch: () => this._handleSearch(),
      onCreate: () => this._handleCreate()
    });

    // CategoryTabs 容器
    const tabsContainer = document.createElement('div');
    tabsContainer.id = 'category-tabs-container';

    // 内容容器
    const contentContainer = document.createElement('div');
    contentContainer.id = 'home-content';
    contentContainer.className = 'home-content';

    main.appendChild(header);
    main.appendChild(tabsContainer);
    main.appendChild(contentContainer);

    // 底部导航（如果存在）
    if (window.BottomTabBar) {
      const tabBar = BottomTabBar.render({
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
    const tabs = CategoryTabs.render(categories, activeKey, (key) => {
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

    item.innerHTML = `
      <div class="record-list-item-cover">
        ${cover ? `<img src="${cover}" alt="${this._escape(title)}" loading="lazy" />` : ''}
      </div>
      <div class="record-list-item-content">
        <h4 class="record-list-item-title">${this._escape(title)}</h4>
        <div class="record-list-item-meta">
          <span>${city}</span>
          <span>♥ ${likes}</span>
        </div>
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
    // 可集成 Router 导航到搜索页
    if (window.Router) {
      window.Router.navigate('/search');
    }
  }

  _handleCreate() {
    console.log('[HomePage] Create clicked');
    if (window.Router) {
      window.Router.navigate('/create');
    }
  }

  _handleTabChange(tab) {
    console.log('[HomePage] Tab changed:', tab);
    if (window.Router) {
      window.Router.navigate(`/${tab}`);
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
          ${record.tags && record.tags.length > 0 ? `<span>${record.tags.join(' ')}</span>` : ''}
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
