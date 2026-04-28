/**
 * 万物手札 - UI 管理模块
 * 负责页面切换、渲染、交互处?
 * 版本：v2.5.0
 */

const UI = {
  // 当前页面状?
  currentPage: 'home',
  previousPage: 'home',
  editingItemId: null,
  
  // 搜索防抖计时?
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
  
  // 初始?
  init() {
    console.log('UI module initialized');
    // 创建防抖版本的渲染函?
    this.debouncedRenderItems = this.debounce((keyword) => this.renderItems(keyword), 300);
    this.debouncedRenderFavorites = this.debounce((keyword) => this.renderFavorites(keyword), 300);
    this.bindEvents();
    this.loadTheme();
    this.renderCategorySelect(); // 初始化分类下拉框
    this.switchPage('home');
    this.renderItems();
  },
  
  // 绑定事件
  bindEvents() {
    // 初始化照片上?
    this.initPhotoUpload();
    
    // 标签栏切?
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
    
    // 分类下拉框变化监听（处理"新增分类"选项?
    const categorySelect = document.getElementById('create-category');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        if (e.target.value === '__add_new__') {
          this.showAddCategoryModal();
          // 不立即重置下拉框，等用户保存后自动选中新分类
        }
      });
    }
    
    // 新增分类弹窗 - 保存按钮
    const saveCategoryBtn = document.getElementById('save-category-btn');
    if (saveCategoryBtn) {
      saveCategoryBtn.addEventListener('click', () => {
        this.saveNewCategory();
      });
    }
    
    // 新增分类弹窗 - 关闭按钮
    const closeCategoryBtn = document.getElementById('close-category-modal');
    if (closeCategoryBtn) {
      closeCategoryBtn.addEventListener('click', () => {
        this.closeAddCategoryModal();
      });
    }
    
    // 分类管理弹窗 - 关闭按钮
    const closeCategoryManagerBtn = document.getElementById('close-category-manager');
    if (closeCategoryManagerBtn) {
      closeCategoryManagerBtn.addEventListener('click', () => {
        this.closeCategoryManager();
      });
    }
    
    // 分类管理弹窗 - 管理分类按钮（个人页面）
    const manageCategoriesBtn = document.getElementById('manage-categories-btn');
    if (manageCategoriesBtn) {
      manageCategoriesBtn.addEventListener('click', () => {
        this.openCategoryManager();
      });
    }
    
    // 详情页返回按?
    const detailBackBtn = document.getElementById('detail-back-btn');
    if (detailBackBtn) {
      detailBackBtn.addEventListener('click', () => {
        this.switchPage(this.previousPage || 'home');
      });
    }
    
    // 详情页编辑按?
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
    
    // 搜索输入?00ms 防抖?
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.debouncedRenderItems(e.target.value);
      });
    }
    
    // 收藏页搜索（300ms 防抖?
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
        this.showToast('数据已导?);
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
            this.showToast('导入失败? + err.message);
          }
        }
      });
    }
    
    // 同步设置按钮
    const syncBtn = document.getElementById('cloud-sync-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.openSyncModal();
      });
    }
    
    // 同步弹窗关闭
    const syncModalClose = document.getElementById('sync-modal-close');
    if (syncModalClose) {
      syncModalClose.addEventListener('click', () => {
        this.closeSyncModal();
      });
    }
    
    // 点击遮罩关闭同步弹窗
    const syncModal = document.getElementById('sync-modal');
    if (syncModal) {
      syncModal.addEventListener('click', (e) => {
        if (e.target === syncModal) {
          this.closeSyncModal();
        }
      });
    }
    
    // 保存同步配置
    const syncSaveBtn = document.getElementById('sync-save-config');
    if (syncSaveBtn) {
      syncSaveBtn.addEventListener('click', () => {
        this.saveSyncConfig();
      });
    }
    
    // 同步上传
    const syncUploadBtn = document.getElementById('sync-upload');
    if (syncUploadBtn) {
      syncUploadBtn.addEventListener('click', () => {
        this.uploadSync();
      });
    }
    
    // 同步下载
    const syncDownloadBtn = document.getElementById('sync-download');
    if (syncDownloadBtn) {
      syncDownloadBtn.addEventListener('click', () => {
        this.downloadSync();
      });
    }
  },
  
  // 切换页面
  switchPage(pageName) {
    // 保存上一页（用于返回?
    if (this.currentPage !== pageName) {
      this.previousPage = this.currentPage;
    }
    
    // 隐藏所有页?
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
      targetPage.classList.add('active');
    }
    
    // 更新当前页面状?
    this.currentPage = pageName;
    
    // 更新标签栏状?
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
    const categoryName = Storage.getCategoryName(item.category);
    
    return `
      <div class="item-card" data-id="${item.id}">
        <div class="item-card-header">
          <h3 class="item-card-title">${this.escapeHtml(item.name)}</h3>
          <span class="item-card-category">${this.escapeHtml(categoryName)}</span>
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
    
    const categoryName = Storage.getCategoryName(item.category);
    
    // 渲染照片
    const photosHtml = this.renderDetailPhotos(item.photos);
    
    container.innerHTML = `
      <div class="detail-field">
        <div class="detail-label">名称</div>
        <div class="detail-value">${this.escapeHtml(item.name)}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">分类</div>
        <div class="detail-value">${this.escapeHtml(categoryName)}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">日期</div>
        <div class="detail-value">${item.date || '未设?}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">备注</div>
        <div class="detail-value">${this.escapeHtml(item.notes || '暂无备注')}</div>
      </div>
      ${photosHtml}
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
    
    // 绑定照片点击事件
    if (item.photos && item.photos.length > 0) {
      container.querySelectorAll('.detail-photo-item').forEach(el => {
        el.addEventListener('click', () => {
          const index = parseInt(el.dataset.index);
          this.showPhotoViewer(item.photos[index]);
        });
      });
    }
    
    this.switchPage('detail');
  },
  
  // 打开表单（新建）
  openForm() {
    this.editingItemId = null;
    document.getElementById('form-title').textContent = '新建记录';
    this.resetForm();
    this.renderCategorySelect(); // 渲染分类下拉?
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
    document.getElementById('create-date').value = item.date || '';
    document.getElementById('create-notes').value = item.notes || '';
    
    // 渲染分类下拉框并选中当前分类
    this.renderCategorySelect(item.category);
    
    // 加载已有照片
    this.currentPhotos = item.photos || [];
    this.renderPhotoPreview();
    
    this.switchPage('form');
  },
  
  // 提交表单
  submitForm() {
    const name = document.getElementById('create-name').value.trim();
    const category = document.getElementById('create-category').value;
    const date = document.getElementById('create-date').value;
    const notes = document.getElementById('create-notes').value.trim();
    
    if (!name) {
      this.showToast('请输入名?);
      return;
    }
    
    const itemData = {
      name,
      category,
      date,
      notes,
      photos: [...this.currentPhotos] // 复制照片数组
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
    this.renderCategorySelect(); // 动态渲染分类下拉框
    document.getElementById('create-date').value = '';
    document.getElementById('create-notes').value = '';
    document.getElementById('form-title').textContent = '新建记录';
    this.editingItemId = null;
    this.clearPhotos();
  },
  
  // 渲染分类下拉框（预设 + 自定义）
  renderCategorySelect(selectedValue = 'general') {
    const select = document.getElementById('create-category');
    if (!select) return;
    
    const categories = Storage.getCategories();
    
    let html = '';
    categories.forEach(cat => {
      const isSelected = cat.id === selectedValue ? 'selected' : '';
      html += `<option value="${cat.id}" ${isSelected}>${this.escapeHtml(cat.name)}</option>`;
    });
    
    // 添加"新增分类"选项
    html += '<option value="__add_new__">?新增分类</option>';
    
    select.innerHTML = html;
  },
  
  // 显示新增分类弹窗
  showAddCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (modal) {
      modal.classList.add('active');
      const input = document.getElementById('category-name-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  },
  
  // 关闭新增分类弹窗
  closeAddCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },
  
  // 保存新分?
  async saveNewCategory() {
    const input = document.getElementById('category-name-input');
    if (!input) return;
    
    const name = input.value.trim();
    if (!name) {
      this.showToast('请输入分类名?);
      return;
    }
    
    const success = Storage.addCategory(name);
    if (success) {
      this.showToast('分类已添?);
      this.closeAddCategoryModal();
      this.renderCategorySelect('custom_' + Storage.slugify(name)); // 自动选中新分?
    } else {
      this.showToast('分类已存?);
    }
  },
  
  // 打开分类管理弹窗
  openCategoryManager() {
    const modal = document.getElementById('category-manager-modal');
    if (!modal) return;
    
    this.renderCategoryList();
    modal.classList.add('active');
  },
  
  // 关闭分类管理弹窗
  closeCategoryManager() {
    const modal = document.getElementById('category-manager-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },
  
  // 渲染分类列表（管理用?
  renderCategoryList() {
    const container = document.getElementById('category-list');
    if (!container) return;
    
    const categories = Storage.getCategories();
    const presetIds = ['general', 'tech', 'life', 'work', 'study', 'other'];
    
    let html = '<ul class="category-list">';
    categories.forEach(cat => {
      const isPreset = presetIds.includes(cat.id);
      html += `
        <li class="category-item ${isPreset ? 'preset' : 'custom'}">
          <span class="category-name">${this.escapeHtml(cat.name)}</span>
          ${isPreset ? '<span class="category-badge">预设</span>' : `
            <button class="category-delete-btn" data-id="${cat.id}" title="删除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          `}
        </li>
      `;
    });
    html += '</ul>';
    
    container.innerHTML = html;
    
    // 绑定删除按钮事件
    container.querySelectorAll('.category-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.deleteCategory(id);
      });
    });
  },
  
  // 删除分类
  deleteCategory(categoryId) {
    if (confirm('删除此分类后，使用该分类的记录将保留但分类显示为原始值。确定要删除吗？')) {
      const success = Storage.deleteCategory(categoryId);
      if (success) {
        this.showToast('分类已删?);
        this.renderCategoryList(); // 刷新列表
        this.renderCategorySelect(); // 刷新表单下拉?
      } else {
        this.showToast('删除失败');
      }
    }
  },
  
  // 切换收藏状?
  toggleFavorite(id) {
    const item = Storage.toggleFavorite(id);
    if (item) {
      this.showToast(item.favorite ? '已收? : '已取消收?);
      this.showDetail(id); // 刷新详情?
      this.renderItems();
      this.renderFavorites();
    }
  },
  
  // 删除项目
  deleteItem(id) {
    if (confirm('确定要删除这条记录吗?)) {
      Storage.deleteItem(id);
      this.showToast('已删?);
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
  },
  
  // ========== 照片功能 ==========
  
  // 初始化照片上?
  initPhotoUpload() {
    const photoBtn = document.getElementById('create-photo-btn');
    const photoInput = document.getElementById('create-photo-input');
    
    if (photoBtn && photoInput) {
      photoBtn.addEventListener('click', () => {
        photoInput.click();
      });
      
      photoInput.addEventListener('change', (e) => {
        this.handlePhotoUpload(e);
      });
    }
  },
  
  // 处理照片上传
  handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        this.currentPhotos.push(event.target.result);
        this.renderPhotoPreview();
      };
      reader.readAsDataURL(file);
    });
    
    // 清空 input，允许重复选择同一文件
    e.target.value = '';
  },
  
  // 渲染照片预览
  renderPhotoPreview() {
    const preview = document.getElementById('photo-preview');
    if (!preview) return;
    
    if (this.currentPhotos.length === 0) {
      preview.innerHTML = '';
      return;
    }
    
    let html = '<div class="photo-grid">';
    this.currentPhotos.forEach((photo, index) => {
      html += `
        <div class="photo-item">
          <img src="${photo}" alt="Photo ${index}" class="photo-thumb" />
          <button type="button" class="photo-remove" data-index="${index}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
    });
    html += '</div>';
    
    preview.innerHTML = html;
    
    // 绑定删除按钮事件
    preview.querySelectorAll('.photo-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.currentPhotos.splice(index, 1);
        this.renderPhotoPreview();
      });
    });
  },
  
  // 清空照片
  clearPhotos() {
    this.currentPhotos = [];
    this.renderPhotoPreview();
  },
  
  // 渲染详情页照?
  renderDetailPhotos(photos) {
    if (!photos || photos.length === 0) return '';
    
    let html = '<div class="detail-photos">';
    photos.forEach((photo, index) => {
      html += `
        <div class="detail-photo-item" data-index="${index}">
          <img src="${photo}" alt="Photo ${index}" />
        </div>
      `;
    });
    html += '</div>';
    return html;
  },
  
  // 显示照片全屏查看
  showPhotoViewer(photoSrc) {
    const viewer = document.createElement('div');
    viewer.className = 'photo-viewer';
    viewer.innerHTML = `
      <div class="photo-viewer-overlay"></div>
      <div class="photo-viewer-content">
        <img src="${photoSrc}" alt="Full size photo" />
        <button class="photo-viewer-close" aria-label="关闭">×</button>
      </div>
    `;
    document.body.appendChild(viewer);
    
    const close = () => {
      viewer.classList.add('fade-out');
      setTimeout(() => viewer.remove(), 300);
    };
    
    viewer.querySelector('.photo-viewer-close').addEventListener('click', close);
    viewer.querySelector('.photo-viewer-overlay').addEventListener('click', close);
  },
  
  // ========== 同步功能 ==========
  
  openSyncModal() {
    const modal = document.getElementById('sync-modal');
    if (modal) {
      modal.classList.add('active');
      this.updateSyncStatus();
    }
  },
  
  closeSyncModal() {
    const modal = document.getElementById('sync-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },
  
  updateSyncStatus() {
    const statusEl = document.getElementById('sync-status');
    const configForm = document.querySelector('.sync-config-form');
    const actionsEl = document.getElementById('sync-actions');
    
    if (!statusEl || !configForm || !actionsEl) return;
    
    if (typeof Sync === 'undefined' || !Sync.isConfigured()) {
      statusEl.className = 'sync-status not-configured';
      statusEl.textContent = '未配置同步，请先设置 Gist 信息';
      configForm.style.display = 'block';
      actionsEl.style.display = 'none';
    } else {
      statusEl.className = 'sync-status configured';
      const lastSync = Sync.config.lastSyncTime ? 
        new Date(Sync.config.lastSyncTime).toLocaleString() : '从未同步';
      statusEl.innerHTML = `已配?· 最后同步：${lastSync}`;
      configForm.style.display = 'none';
      actionsEl.style.display = 'flex';
    }
  },
  
  saveSyncConfig() {
    if (typeof Sync === 'undefined') {
      this.showToast('同步模块未加?);
      return;
    }
    
    const gistId = document.getElementById('sync-gist-id').value.trim();
    const token = document.getElementById('sync-token').value.trim();
    const key = document.getElementById('sync-key').value.trim();
    
    if (!gistId || !token || !key) {
      this.showToast('请填写所有字?);
      return;
    }
    
    Sync.setConfig(gistId, token, key);
    this.updateSyncStatus();
    this.showToast('同步配置已保?);
    this.addSyncLog('配置保存成功', 'success');
  },
  
  async uploadSync() {
    if (typeof Sync === 'undefined') {
      this.showToast('同步模块未加?);
      return;
    }
    
    this.addSyncLog('开始上?..', '');
    
    try {
      await Sync.upload();
      this.addSyncLog('上传成功', 'success');
      this.showToast('同步上传成功');
      this.updateSyncStatus();
    } catch (e) {
      this.addSyncLog('上传失败? + e.message, 'error');
      this.showToast('上传失败? + e.message);
    }
  },
  
  async downloadSync() {
    if (typeof Sync === 'undefined') {
      this.showToast('同步模块未加?);
      return;
    }
    
    this.addSyncLog('开始下?..', '');
    
    try {
      await Sync.download();
      this.addSyncLog('下载成功', 'success');
      this.showToast('同步下载成功');
      this.updateSyncStatus();
    } catch (e) {
      this.addSyncLog('下载失败? + e.message, 'error');
      this.showToast('下载失败? + e.message);
    }
  },
  
  addSyncLog(message, type) {
    const logEl = document.getElementById('sync-log');
    if (!logEl) return;
    
    const time = new Date().toLocaleTimeString();
    const item = document.createElement('div');
    item.className = 'sync-log-item ' + (type || '');
    item.textContent = `[${time}] ${message}`;
    logEl.appendChild(item);
    logEl.scrollTop = logEl.scrollHeight;
  }
};

// 页面加载时初始化 (已禁用，由 app.js 统一管理)
// document.addEventListener('DOMContentLoaded', () => {
//   UI.init();
// });

// 禁用 UI 模块的事件绑定，避免与 app.js 冲突
// UI.bindEvents = function() {};
