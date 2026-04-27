/**
 * 万物手札 - UI 管理模块
 * 负责页面切换、渲染、交互处理
 * 版本：v2.2.1
 */

const UI = {
  // 当前页面状态
  currentPage: 'home',
  previousPage: 'home',
  editingItemId: null,
  
  // 搜索防抖计时器
  searchDebounceTimer: null,
  
  // 防抖函数
  debounce(fn, delay) {
    return function(...args) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => fn.apply(this, args), delay);
    }.bind(this);
  },
  
  // 主题配置
  themes: [
    { id: 'light', name: '明亮', color: '#ffffff', textColor: '#1a1a1a' },
    { id: 'dark', name: '暗黑', color: '#1a1a1a', textColor: '#ffffff' },
    { id: 'warm', name: '暖光', color: '#FFF8F0', textColor: '#3A2E2E' },
    { id: 'ink', name: '墨影', color: '#F0F0F0', textColor: '#1A1A1A' }
  ],
  
  // 初始化
  init() {
    console.log('UI module initialized');
    // 创建防抖版本的渲染函数
    this.debouncedRenderItems = this.debounce((keyword) => this.renderItems(keyword), 300);
    this.debouncedRenderFavorites = this.debounce((keyword) => this.renderFavorites(keyword), 300);
    this.bindEvents();
    this.loadTheme();
    this.switchPage('home');
    this.renderItems();
  },
  
  // 绑定事件
  bindEvents() {
    // 标签栏切换
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const page = e.currentTarget.dataset.page;
        this.switchPage(page);
      });
    });
    
    // FAB 按钮
    const fabBtn = document.getElementById('fab-add');
    if (fabBtn) {
      fabBtn.addEventListener('click', () => {
        this.openForm();
      });
    }
    
    // 表单返回按钮
    const formBackBtn = document.getElementById('form-back-btn');
    if (formBackBtn) {
      formBackBtn.addEventListener('click', () => {
        this.switchPage(this.previousPage || 'home');
        this.resetForm();
      });
    }
    
    // 表单保存按钮
    const formSaveBtn = document.getElementById('form-save-btn');
    if (formSaveBtn) {
      formSaveBtn.addEventListener('click', () => {
        this.submitForm();
      });
    }
    
    // 详情页返回按钮
    const detailBackBtn = document.getElementById('detail-back-btn');
    if (detailBackBtn) {
      detailBackBtn.addEventListener('click', () => {
        this.switchPage(this.previousPage || 'home');
      });
    }
    
    // 详情页编辑按钮
    const detailEditBtn = document.getElementById('detail-edit-btn');
    if (detailEditBtn) {
      detailEditBtn.addEventListener('click', () => {
        if (this.currentItemId) {
          this.editItem(this.currentItemId);
        }
      });
    }
    
    // 主题切换
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleThemePanel();
      });
    }
    
    // 点击空白关闭主题面板
    document.addEventListener('click', (e) => {
      const themePanel = document.getElementById('theme-panel');
      const themeSelector = document.querySelector('.theme-selector');
      if (themePanel && themeSelector && !themeSelector.contains(e.target)) {
        themePanel.classList.remove('active');
      }
    });
    
    // 搜索输入（300ms 防抖）
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.debouncedRenderItems(e.target.value);
      });
    }
    
    // 收藏页搜索（300ms 防抖）
    const searchInputFavorites = document.getElementById('search-input-favorites');
    if (searchInputFavorites) {
      searchInputFavorites.addEventListener('input', (e) => {
        this.debouncedRenderFavorites(e.target.value);
      });
    }
    
    // 导出按钮
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        Storage.exportData();
        this.showToast('数据已导出');
      });
    }
    
    // 导入按钮
    const importBtn = document.getElementById('import-data-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        document.getElementById('import-file-input').click();
      });
    }
    
    // 导入文件选择
    const importFileInput = document.getElementById('import-file-input');
    if (importFileInput) {
      importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            await Storage.importData(file);
            this.showToast('数据导入成功');
            this.renderItems();
            this.renderFavorites();
          } catch (err) {
            this.showToast('导入失败：' + err.message);
          }
        }
      });
    }
  },
  
  // 切换页面
  switchPage(pageName) {
    // 保存上一页（用于返回）
    if (this.currentPage !== pageName) {
      this.previousPage = this.currentPage;
    }
    
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
      targetPage.classList.add('active');
    }
    
    // 更新当前页面状态
    this.currentPage = pageName;
    
    // 更新标签栏状态
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.page === pageName) {
        tab.classList.add('active');
      }
    });
    
    // 控制 FAB 显示/隐藏
    const fab = document.getElementById('fab-add');
    if (fab) {
      fab.style.display = (pageName === 'home') ? 'flex' : 'none';
    }
    
    // 根据页面渲染内容
    if (pageName === 'home') {
      this.renderItems();
    } else if (pageName === 'favorites') {
      this.renderFavorites();
    }
  },
  
  // 渲染记录列表
  renderItems(searchQuery = '') {
    const container = document.getElementById('items-container');
    const emptyState = document.getElementById('empty-state');
    
    if (!container || !emptyState) return;
    
    let items = Storage.getAll();
    
    // 搜索过滤
    if (searchQuery) {
      items = Storage.searchItems(searchQuery);
    }
    
    if (items.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = items.map(item => this.createItemCard(item)).join('');
    
    // 绑定卡片点击事件
    container.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showDetail(card.dataset.id);
      });
    });
  },
  
  // 渲染收藏列表
  renderFavorites(searchQuery = '') {
    const container = document.getElementById('favorites-container');
    const emptyState = document.getElementById('empty-favorites');
    
    if (!container || !emptyState) return;
    
    let items = Storage.getFavorites();
    
    // 搜索过滤
    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.notes.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (items.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }
    
    emptyState.style.display = 'none';
    container.innerHTML = items.map(item => this.createItemCard(item, true)).join('');
    
    // 绑定卡片点击事件
    container.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showDetail(card.dataset.id);
      });
    });
  },
  
  // 创建记录卡片 HTML
  createItemCard(item, showFavoriteBadge = false) {
    const categoryNames = {
      general: '通用',
      tech: '科技',
      life: '生活',
      work: '工作',
      study: '学习',
      other: '其他'
    };
    
    return `
      <div class="item-card" data-id="${item.id}">
        <div class="item-card-header">
          <h3 class="item-card-title">${this.escapeHtml(item.name)}</h3>
          <span class="item-card-category">${categoryNames[item.category] || item.category}</span>
        </div>
        <div class="item-card-date">${item.date || ''}</div>
        <p class="item-card-notes">${this.escapeHtml(item.notes || '暂无备注')}</p>
      </div>
    `;
  },
  
  // 显示详情
  showDetail(id) {
    const item = Storage.getItem(id);
    if (!item) return;
    
    this.currentItemId = id;
    
    const container = document.getElementById('detail-content');
    if (!container) return;
    
    const categoryNames = {
      general: '通用',
      tech: '科技',
      life: '生活',
      work: '工作',
      study: '学习',
      other: '其他'
    };
    
    container.innerHTML = `
      <div class="detail-field">
        <div class="detail-label">名称</div>
        <div class="detail-value">${this.escapeHtml(item.name)}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">分类</div>
        <div class="detail-value">${categoryNames[item.category] || item.category}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">日期</div>
        <div class="detail-value">${item.date || '未设置'}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">备注</div>
        <div class="detail-value">${this.escapeHtml(item.notes || '暂无备注')}</div>
      </div>
      <div class="detail-actions">
        <button class="detail-action-btn" onclick="UI.toggleFavorite('${item.id}')">
          <svg viewBox="0 0 24 24" fill="${item.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          ${item.favorite ? '取消收藏' : '收藏'}
        </button>
        <button class="detail-action-btn" onclick="UI.deleteItem('${item.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          删除
        </button>
      </div>
    `;
    
    this.switchPage('detail');
  },
  
  // 打开表单（新建）
  openForm() {
    this.editingItemId = null;
    document.getElementById('form-title').textContent = '新建记录';
    this.resetForm();
    this.switchPage('form');
  },
  
  // 编辑项目
  editItem(id) {
    const item = Storage.getItem(id);
    if (!item) return;
    
    this.editingItemId = id;
    document.getElementById('form-title').textContent = '编辑记录';
    
    // 填充表单
    document.getElementById('create-name').value = item.name;
    document.getElementById('create-category').value = item.category;
    document.getElementById('create-date').value = item.date || '';
    document.getElementById('create-notes').value = item.notes || '';
    
    this.switchPage('form');
  },
  
  // 提交表单
  submitForm() {
    const name = document.getElementById('create-name').value.trim();
    const category = document.getElementById('create-category').value;
    const date = document.getElementById('create-date').value;
    const notes = document.getElementById('create-notes').value.trim();
    
    if (!name) {
      this.showToast('请输入名称');
      return;
    }
    
    const itemData = {
      name,
      category,
      date,
      notes
    };
    
    let result;
    if (this.editingItemId) {
      // 更新现有记录
      result = Storage.updateItem(this.editingItemId, itemData);
      this.showToast('更新成功');
    } else {
      // 新建记录
      result = Storage.addItem(itemData);
      this.showToast('创建成功');
    }
    
    if (result) {
      this.resetForm();
      this.switchPage('home');
      this.renderItems();
      this.renderFavorites();
    }
  },
  
  // 重置表单
  resetForm() {
    document.getElementById('create-name').value = '';
    document.getElementById('create-category').value = 'general';
    document.getElementById('create-date').value = '';
    document.getElementById('create-notes').value = '';
    document.getElementById('form-title').textContent = '新建记录';
    this.editingItemId = null;
  },
  
  // 切换收藏状态
  toggleFavorite(id) {
    const item = Storage.toggleFavorite(id);
    if (item) {
      this.showToast(item.favorite ? '已收藏' : '已取消收藏');
      this.showDetail(id); // 刷新详情页
      this.renderItems();
      this.renderFavorites();
    }
  },
  
  // 删除项目
  deleteItem(id) {
    if (confirm('确定要删除这条记录吗？')) {
      Storage.deleteItem(id);
      this.showToast('已删除');
      this.switchPage('home');
      this.renderItems();
      this.renderFavorites();
    }
  },
  
  // 主题管理
  loadTheme() {
    const settings = Storage.getSettings();
    const theme = settings.theme || 'light';
    this.applyTheme(theme);
    this.renderThemeOptions();
  },
  
  applyTheme(themeId) {
    document.documentElement.setAttribute('data-theme', themeId);
    
    const settings = Storage.getSettings();
    settings.theme = themeId;
    Storage.saveSettings(settings);
    
    this.renderThemeOptions();
  },
  
  toggleThemePanel() {
    const panel = document.getElementById('theme-panel');
    if (panel) {
      panel.classList.toggle('active');
    }
  },
  
  renderThemeOptions() {
    const container = document.getElementById('theme-options');
    if (!container) return;
    
    const settings = Storage.getSettings();
    const currentTheme = settings.theme || 'light';
    
    container.innerHTML = this.themes.map(theme => `
      <div class="theme-option ${theme.id === currentTheme ? 'active' : ''}" data-theme="${theme.id}">
        <div class="theme-color" style="background: ${theme.color}; border-color: ${theme.textColor}"></div>
        <span>${theme.name}</span>
      </div>
    `).join('');
    
    // 绑定主题选择事件
    container.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        this.applyTheme(option.dataset.theme);
        document.getElementById('theme-panel').classList.remove('active');
      });
    });
  },
  
  // 显示提示消息
  showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  },
  
  // HTML 转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  UI.init();
});
