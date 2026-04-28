/**
 * 万物手札 H5 - 主应用逻辑 v3.3.0
 * 重构：统一模块调度、修复 ECharts 依赖、清理冗余同步模块
 */

// ===================================
// 存储后端抽象层
// ===================================

const StorageBackend = {
  useIndexedDB: false,
  
  async init() {
    if (window.IDBModule) {
      try {
        await IDBModule.init();
        this.useIndexedDB = true;

      } catch (e) {
        console.warn('IndexedDB 初始化失败，降级到 localStorage:', e);
        this.useIndexedDB = false;
      }
    }
  },
  
  async getAll() {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      return await IDBModule.getAll();
    }
    try {
      const data = localStorage.getItem('universal_journal_items');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('localStorage 数据解析失败，已清空损坏数据:', e);
      localStorage.removeItem('universal_journal_items');
      return [];
    }
  },
  
  async save(items) {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.clear();
      await IDBModule.putMany(items);
      return;
    }
    try {
      localStorage.setItem('universal_journal_items', JSON.stringify(items));
    } catch (e) {
      console.error('localStorage 写入失败（可能超出配额）:', e);
      if (window.App && App.showToast) {
        App.showToast('⚠️ 存储空间不足，请清理旧记录');
      }
    }
  },
  
  async put(item) {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.put(item);
      return;
    }
    const items = await this.getAll();
    const index = items.findIndex(i => i.id === item.id);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.unshift(item);
    }
    await this.save(items);
  },
  
  async delete(id) {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.delete(id);
      return;
    }
    const items = await this.getAll();
    await this.save(items.filter(i => i.id !== id));
  },
  
  async deleteMany(ids) {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.deleteMany(ids);
      return;
    }
    const items = await this.getAll();
    await this.save(items.filter(i => !ids.includes(i.id)));
  },
  
  async clear() {
    if (this.useIndexedDB && window.IDBModule && IDBModule.db) {
      await IDBModule.clear();
      return;
    }
    localStorage.removeItem('universal_journal_items');
  },
  
  async migrateFromLocalStorage() {
    if (this.useIndexedDB && window.IDBModule) {
      return await IDBModule.migrateFromLocalStorage();
    }
    return { migrated: 0 };
  }
};

// ===================================
// 应用主逻辑
// ===================================

const App = {
  currentPage: 'home',
  currentTag: '',
  currentDateFilter: null,
  searchKey: '',
  items: [],
  filteredItems: [],
  editingId: null,
  currentDetailId: null,
  currentPhotos: [],
  
  async init() {
    await StorageBackend.init();
    
    const migration = await StorageBackend.migrateFromLocalStorage();
    if (migration.migrated > 0) {

    }
    
    // 初始化各模块
    ThemeManager.init();
    ThemeManager.renderOptions();
    
    if (window.TrashManager) TrashManager.init();
    if (window.DraftManager) DraftManager.init();
    if (window.BatchManager) BatchManager.init();
    if (window.TemplateManager) TemplateManager.init();
    if (window.TimelineManager) TimelineManager.init();
    if (window.VisualsManager) VisualsManager.init();
    
    this.bindEvents();
    this.bindPasswordEvents();
    this.bindSettingsEvents();
    
    if (window.CloudSync) {
      CloudSync.loadConfig();
      this.updateCloudStatus();
      
      if (CloudSync.isEnabled() && CloudSync.config.syncOnStart) {
        this.autoSync();
      }
    }
    
    if (Security.isLocked()) {
      PasswordUI.showLockScreen();
    } else {
      await this.loadItems();
        this.renderTagFilter();
      this.renderItems();
    }
    
    this.switchPage('home');
    

  },
  
  bindEvents() {
    // 全局事件委托：处理动态生成的按钮和元素
    document.addEventListener('click', (e) => {
      // 1. 空状态"新建记录"按钮
      const emptyAddBtn = e.target.closest('.empty-add-btn');
      if (emptyAddBtn) {
        this.editingId = null;
        this.resetForm();
        this.switchPage('form');
        return;
      }
      
      // 2. 收藏页空状态"去记录"按钮
      const favEmptyBtn = e.target.closest('.empty-fav-btn');
      if (favEmptyBtn) {
        this.switchPage('home');
        return;
      }
      
      // 3. 模板选择器中的"保存为模板"按钮
      const saveTemplateBtn = e.target.closest('.btn-save-template');
      if (saveTemplateBtn) {
        if (window.TemplateManager) {
          TemplateManager.showSaveTemplateModal();
        }
        return;
      }
      
      // 4. 模板管理中的删除按钮
      const deleteTemplateBtn = e.target.closest('.btn-delete-template');
      if (deleteTemplateBtn) {
        const id = deleteTemplateBtn.dataset.id;
        if (id && window.TemplateManager) {
          TemplateManager.deleteTemplate(id);
        }
        return;
      }
    });
    
    // 原有事件绑定
    const itemsContainer = document.getElementById('items-container');
    if (itemsContainer) {
      itemsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.item-card');
        if (card && card.dataset.id) {
          // 检查是否在批量模式下
          if (BatchManager.handleCardClick(card.dataset.id)) {
            return;
          }
          this.showDetail(card.dataset.id);
        }
      });
    }
    
    const favContainer = document.getElementById('favorites-container');
    if (favContainer) {
      favContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.item-card');
        if (card && card.dataset.id) {
          this.showDetail(card.dataset.id);
        }
      });
    }
    
    const toggle = document.getElementById('theme-toggle');
    const panel = document.getElementById('theme-panel');
    if (toggle) {
      toggle.addEventListener('click', () => {
        panel.classList.toggle('show');
      });
    }
    
    document.addEventListener('click', (e) => {
      if (panel && !panel.contains(e.target) && !toggle.contains(e.target)) {
        panel.classList.remove('show');
      }
    });
    
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const page = e.currentTarget.closest('.tab-item').dataset.page;
        this.switchPage(page);
      });
    });
    
    const fabBtn = document.getElementById('fab-add');
    if (fabBtn) {
      fabBtn.addEventListener('click', () => {
        this.editingId = null;
        this.resetForm();
        this.switchPage('form');
        
        // 检查是否有草稿
        if (window.DraftManager) {
          DraftManager.showRestorePrompt(() => {
            this.showToast('草稿已恢复');
          });
        }
      });
    }
    
    const emptyBtn = document.getElementById('empty-add-btn');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => {
        this.editingId = null;
        this.resetForm();
        this.switchPage('form');
      });
    }
    
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    
    let searchTimer = null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          this.searchKey = searchInput.value.trim();
          this.filterItems();
          this.renderItems();
        }, 300);
      });
    }
    
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        if (searchInput) {
          this.searchKey = searchInput.value.trim();
          this.filterItems();
          this.renderItems();
        }
      });
    }
    
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchKey = e.target.value.trim();
          this.filterItems();
          this.renderItems();
        }
      });
    }
    
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-item')) {
          document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.currentCategory = e.target.dataset.category;
          this.currentTag = '';
          this.filterItems();
          this.renderItems();
        }
      });
    }
    
    const tagFilter = document.getElementById('tag-filter');
    if (tagFilter) {
      tagFilter.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-item')) {
          document.querySelectorAll('.tag-item').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.currentTag = e.target.dataset.tag;
          this.currentCategory = '';
          this.filterItems();
          this.renderItems();
        }
      });
    }
    
    const detailBack = document.getElementById('detail-back-btn');
    if (detailBack) {
      detailBack.addEventListener('click', () => {
        this.switchPage('home');
      });
    }
    
    const createCancel = document.getElementById('create-back-btn');
    const createSave = document.getElementById('create-save-btn');
    
    if (createCancel) {
      createCancel.addEventListener('click', () => {
        this.switchPage('home');
      });
    }
    
    if (createSave) {
      createSave.addEventListener('click', () => {
        this.submitForm();
      });
    }
    
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const command = e.currentTarget.dataset.command;
        document.execCommand(command, false, null);
        const content = document.getElementById('create-rich-content');
        if (content) content.focus();
      });
    });
    
    const photoInput = document.getElementById('create-photo-input');
    const photoBtn = document.getElementById('create-photo-btn');
    
    if (photoBtn && photoInput) {
      photoBtn.addEventListener('click', () => {
        photoInput.click();
      });
      
      photoInput.addEventListener('change', async (e) => {
        await this.handlePhotoUpload(e);
      });
    }
    
    // 初始化标签 Chip 输入
    if (window.TagManager) {
      TagManager.initTagChipInput();
    }
    
    // 模板使用按钮
    const useTemplateBtn = document.getElementById('btn-use-template');
    if (useTemplateBtn) {
      useTemplateBtn.addEventListener('click', () => {
        if (window.TemplateManager) {
          TemplateManager.showTemplateSelector();
        }
      });
    }
    
    const detailFav = document.getElementById('detail-favorite-btn');
    if (detailFav) {
      detailFav.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (this.currentDetailId) {
          const item = await this.getItem(this.currentDetailId);
          if (item) {
            item.favorite = !item.favorite;
            await StorageBackend.put(item);
            this.updateFavoriteButton(item.favorite);
            this.showToast(item.favorite ? '已收藏' : '已取消收藏');
            await this.loadItems();
            this.renderItems();
          }
        }
      });
    }
    
    const detailShare = document.getElementById('detail-share-btn');
    if (detailShare) {
      detailShare.addEventListener('click', () => {
        if (this.currentDetailId) {
          this.shareItem(this.currentDetailId);
        }
      });
    }
    
    const detailEdit = document.getElementById('detail-edit-btn');
    if (detailEdit) {
      detailEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentDetailId) {
          this.editItem(this.currentDetailId);
        }
      });
    }
    
    const detailDelete = document.getElementById('detail-delete-btn');
    if (detailDelete) {
      detailDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (this.currentDetailId) {
          if (confirm('确定要删除这条记录吗？删除后可在回收站恢复')) {
            const item = await this.getItem(this.currentDetailId);
            if (item && window.TrashManager) {
              TrashManager.addToTrash(item);
            }
            await StorageBackend.delete(this.currentDetailId);
            this.showToast('已移至回收站');
            this.currentDetailId = null;
            await this.loadItems();
            this.renderItems();
            this.switchPage('home');
          }
        }
      });
    }
    
    // 日历返回按钮
    const calBackBtn = document.getElementById('cal-back-btn');
    if (calBackBtn) {
      calBackBtn.addEventListener('click', () => {
        this.clearDateFilter();
      });
    }
    
    // 模板选择器取消按钮
    const cancelTplBtn = document.getElementById('cancel-template-btn');
    if (cancelTplBtn) {
      cancelTplBtn.addEventListener('click', () => {
        if (window.TemplateManager) {
          TemplateManager.hideSelector();
        }
      });
    }
  },
  
  bindSettingsEvents() {
    // 修复 ID 匹配问题：HTML 中使用的是 export-data-btn / import-data-btn
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportData();
      });
    }
    
    const importBtn = document.getElementById('import-data-btn');
    const importInput = document.getElementById('import-file-input');
    
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.click();
      });
      
      importInput.addEventListener('change', async (e) => {
        await this.importData(e);
      });
    }
    
    const clearBtn = document.getElementById('clear-all-data-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('⚠️ 确定要删除所有数据吗？此操作不可恢复！')) {
          await StorageBackend.clear();
          localStorage.removeItem(Security.DATA_KEY);
          this.items = [];
          this.filteredItems = [];
          this.renderItems();
          this.renderFavorites();
          this.showToast('数据已清空');
          this.switchPage('home');
        }
      });
    }
    
    // 回收站入口
    const trashBtn = document.getElementById('settings-trash');
    if (trashBtn) {
      trashBtn.addEventListener('click', () => {
        this.switchPage('trash');
        if (window.TrashManager) {
          TrashManager.renderTrashList('trash-container');
        }
      });
    }
    
    const lockBtn = document.getElementById('settings-lock');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        this.togglePasswordLock();
      });
    }
    
    const themeBtn = document.getElementById('settings-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) toggle.click();
      });
    }
    
    const statsBtn = document.getElementById('settings-stats');
    if (statsBtn) {
      statsBtn.addEventListener('click', async () => {
        await this.loadStats();
        this.switchPage('stats');
      });
    }
    
    const aboutBtn = document.getElementById('settings-about');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => {
        this.showAbout();
      });
    }
    
    // 模板管理入口
    const templateBtn = document.getElementById('manage-templates-btn');
    if (templateBtn) {
      templateBtn.addEventListener('click', () => {
        this.switchPage('template-manager');
        if (window.TemplateManager) {
          TemplateManager.showTemplateManager();
          TemplateManager.bindTemplateManagerEvents();
        }
      });
    }
    
    // 模板管理返回按钮
    const tmBackBtn = document.getElementById('tm-back-btn');
    if (tmBackBtn) {
      tmBackBtn.addEventListener('click', () => {
        this.switchPage('profile');
      });
    }
    
    // ==================== 分类管理 ====================
    const manageCatBtn = document.getElementById('manage-categories-btn');
    if (manageCatBtn) {
      manageCatBtn.addEventListener('click', () => {
        this.openCategoryManager();
      });
    }
    
    const closeCatMgrBtn = document.getElementById('close-category-manager');
    if (closeCatMgrBtn) {
      closeCatMgrBtn.addEventListener('click', () => {
        this.closeModal('category-manager-modal');
      });
    }
    
    const saveCatBtn = document.getElementById('save-category-btn');
    if (saveCatBtn) {
      saveCatBtn.addEventListener('click', () => {
        this.saveCategory();
      });
    }
    
    const closeCatModalBtn = document.getElementById('close-category-modal');
    if (closeCatModalBtn) {
      closeCatModalBtn.addEventListener('click', () => {
        this.closeCategoryModal();
      });
    }
    
    // 分类管理器内部事件委托（处理动态生成的新增按钮等）
    const catMgrModal = document.getElementById('category-manager-modal');
    if (catMgrModal) {
      catMgrModal.addEventListener('click', (e) => {
        const addBtn = e.target.closest('#btn-add-category');
        if (addBtn) {
          this.openCategoryModal();
        }
      });
    }
    
    if (window.CloudSync) {
      this.bindCloudEvents();
    }
  },
  
  bindCloudEvents() {
    const configBtn = document.getElementById('settings-cloud-config');
    if (configBtn) {
      configBtn.addEventListener('click', () => {
        this.showCloudConfig();
      });
    }
    
    const uploadBtn = document.getElementById('sync-upload');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.cloudUpload();
      });
    }
    
    const downloadBtn = document.getElementById('sync-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.cloudDownload();
      });
    }
    
    // 保存配置按钮
    const saveBtn = document.getElementById('sync-save-config');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveCloudConfig();
      });
    }
    
    const closeBtn = document.getElementById('cloud-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const modal = document.getElementById('cloud-modal');
        if (modal) modal.classList.remove('active');
      });
    }
  },
  
  bindPasswordEvents() {
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const passwordInput = document.getElementById('modal-password');
    const unlockBtn = document.getElementById('lock-unlock-btn');
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const password = passwordInput ? passwordInput.value : '';
        if (!password) {
          PasswordUI.showError('请输入密码');
          return;
        }
        if (this.currentCallback) {
          this.currentCallback(password);
        }
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        PasswordUI.hideModal();
      });
    }
    
    if (passwordInput) {
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          confirmBtn.click();
        }
      });
    }
    
    if (unlockBtn) {
      unlockBtn.addEventListener('click', async () => {
        const password = document.getElementById('lock-password').value;
        if (!password) {
          const hint = document.getElementById('lock-hint');
          if (hint) {
            hint.textContent = '请输入密码';
            hint.className = 'lock-hint error';
          }
          return;
        }
        
        if (Security.verifyPassword(password)) {
          window.__isDecrypted = true;
          window.__cachedItems = Security.decryptData(password);
          PasswordUI.hideLockScreen();
          await this.loadItems();
                this.renderItems();
        } else {
          const hint = document.getElementById('lock-hint');
          if (hint) {
            hint.textContent = '密码错误';
            hint.className = 'lock-hint error';
          }
        }
      });
    }
  },
  
  switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    
    const pageEl = document.getElementById(`page-${page}`);
    const tabEl = document.querySelector(`.tab-item[data-page="${page}"]`);
    
    if (pageEl) pageEl.classList.add('active');
    if (tabEl) tabEl.classList.add('active');
    
    this.currentPage = page;
    
    const fab = document.getElementById('fab-add');
    if (fab) {
      fab.style.display = (page === 'home') ? 'flex' : 'none';
    }
    
    if (page === 'favorites') {
      this.renderFavorites();
    } else if (page === 'profile') {
      this.updateCloudStatus();
      if (window.VisualsManager) VisualsManager.render(this.items);
    } else if (page === 'trash' && window.TrashManager) {
      TrashManager.renderTrashList('trash-container');
    } else if (page === 'form') {
        if (window.TemplateManager) TemplateManager.hideTemplateSelector();
    } else if (page === 'calendar' && window.CalendarView) {
      CalendarView.update(this.items);
    } else if (page === 'timeline' && window.TimelineManager) {
      TimelineManager.render(this.items);
    } else if (page === 'template-manager' && window.TemplateManager) {
      TemplateManager.showTemplateManager();
      TemplateManager.bindTemplateManagerEvents();
    }
  },
  
  async loadItems() {
    this.items = await StorageBackend.getAll();
    this.filterItems();
  },
  
  async getItem(id) {
    if (window.IDBModule && IDBModule.db) {
      return await IDBModule.get(id);
    }
    return this.items.find(item => item.id === id);
  },
  
  filterItems() {
    const dateStr = this.currentDateFilter ? this.currentDateFilter.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : null;
    
    this.filteredItems = this.items.filter(item => {
        const matchTag = !this.currentTag || (item.tags && item.tags.includes(this.currentTag));
      const matchDate = !dateStr || (item.createdAt && item.createdAt.includes(dateStr));
      const matchSearch = !this.searchKey || 
        (item.name && item.name.toLowerCase().includes(this.searchKey.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(this.searchKey.toLowerCase())) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(this.searchKey.toLowerCase())));
      return matchCategory && matchTag && matchDate && matchSearch;
    });
  },
  
  /**
   * 按日期筛选（供日历模块调用）
   */
  filterByDate(date) {
    this.currentDateFilter = date;
    this.currentCategory = '';
    this.currentTag = '';
    this.searchKey = '';
    this.filterItems();
    
    const dateStr = date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const titleEl = document.getElementById('calendar-day-title');
    if (titleEl) titleEl.textContent = `${dateStr} 的记录 (${this.filteredItems.length})`;
    
    // 渲染列表到日历页
    this.renderCalendarDayItems();
  },
  
  /**
   * 渲染日历选中日期的记录
   */
  renderCalendarDayItems() {
    const container = document.getElementById('calendar-items-list');
    const backBtn = document.getElementById('cal-back-btn');
    
    if (!container) return;
    if (backBtn) backBtn.style.display = 'inline-flex';
    
    if (this.filteredItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <p>这天没有记录</p>
          <button class="btn btn-primary" onclick="App.editingId=null; App.resetForm(); App.switchPage('form');">新建记录</button>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.filteredItems.map(item => `
      <div class="item-card" data-id="${item.id}">
        ${item.photos && item.photos.length > 0 ? `
          <div class="item-photo">
            <img src="${item.photos[0]}" alt="${this.escapeHtml(item.name)}" />
          </div>
        ` : ''}
        <div class="item-content">
          <h3 class="item-name">${this.escapeHtml(item.name || '未命名')}</h3>
          <p class="item-category">${this.escapeHtml(item.category || '未分类')}</p>
          ${item.tags && item.tags.length > 0 ? `
            <div class="item-tags">
              ${item.tags.map(tag => `<span class="tag-small">#${this.escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
          <p class="item-notes">${this.stripHtml(item.notes) || ''}</p>
        </div>
      </div>
    `).join('');
    
    // 绑定点击事件
    container.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', (e) => {
        this.showDetail(card.dataset.id);
      });
    });
  },
  
  /**
   * 清除日期筛选，返回日历视图
   */
  clearDateFilter() {
    this.currentDateFilter = null;
    const backBtn = document.getElementById('cal-back-btn');
    if (backBtn) backBtn.style.display = 'none';
    const titleEl = document.getElementById('calendar-day-title');
    if (titleEl) titleEl.textContent = '选择日期查看记录';
    const container = document.getElementById('calendar-items-list');
    if (container) container.innerHTML = '';
    // 重新渲染日历
    if (window.CalendarView) CalendarView.render();
  },
  
  renderItems() {
    const container = document.getElementById('items-container');
    if (!container) return;
    
    if (this.filteredItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-image" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <p class="empty-title">暂无记录</p>
          <p class="empty-desc">添加你的第一条手札吧</p>
          <button class="btn btn-primary empty-add-btn">新建记录</button>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.filteredItems.map(item => `
      <div class="item-card" data-id="${item.id}">
        ${item.photos && item.photos.length > 0 ? `
          <div class="item-photo">
            <img src="${item.photos[0]}" alt="${this.escapeHtml(item.name)}" />
          </div>
        ` : ''}
        <div class="item-content">
          <h3 class="item-name">${this.escapeHtml(item.name || '未命名')}</h3>
          <p class="item-category">${this.escapeHtml(item.category || '未分类')}</p>
          ${item.tags && item.tags.length > 0 ? `
            <div class="item-tags">
              ${item.tags.map(tag => `<span class="tag-small">#${this.escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
          <p class="item-notes">${this.stripHtml(item.notes) || ''}</p>
          <div class="item-meta">
            <span class="item-date">${item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '未知日期'}</span>
            ${item.favorite ? '<span class="item-favorite">⭐</span>' : ''}
          </div>
        </div>
      </div>
    `).join('');
  },
  
  async showDetail(id) {
    const item = await this.getItem(id);
    if (!item) return;
    
    this.currentDetailId = id;
    const container = document.getElementById('detail-body');
    if (!container) return;
    
    const isFav = item.favorite ? 'filled' : 'none';
    
    container.innerHTML = `
      <div class="detail-content">
        ${item.photos && item.photos.length > 0 ? `
          <div class="detail-photos">
            ${item.photos.map(photo => `<img src="${photo}" alt="照片" class="detail-photo" />`).join('')}
          </div>
        ` : ''}
        
        <h1 class="detail-name">${this.escapeHtml(item.name || '未命名')}</h1>
        <div class="detail-meta">
          <span class="detail-category">${this.escapeHtml(item.category || '未分类')}</span>
          <span class="detail-status">${this.getStatusText(item.status)}</span>
          ${item.date ? `<span class="detail-date">📅 ${item.date}</span>` : ''}
          <span class="detail-date">创建：${item.createdAt}</span>
        </div>
        
        ${item.tags && item.tags.length > 0 ? `
          <div class="detail-section">
            <h3 class="detail-section-title">标签</h3>
            <div class="detail-tags">
              ${item.tags.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
        
        ${item.notes ? `
          <div class="detail-section">
            <h3 class="detail-section-title">备注</h3>
            <div class="detail-notes">${item.notes}</div>
          </div>
        ` : ''}
      </div>
    `;
    
    this.updateFavoriteButton(item.favorite);
    this.switchPage('detail');
  },
  
  updateFavoriteButton(isFav) {
    const btn = document.getElementById('detail-favorite-btn');
    if (!btn) return;
    
    const svg = btn.querySelector('svg');
    if (!svg) return;
    
    if (isFav) {
      svg.setAttribute('fill', 'currentColor');
    } else {
      svg.setAttribute('fill', 'none');
    }
  },
  
  getStatusText(status) {
    if (!status) return '';
    const map = {
      'in-use': '在役',
      'idle': '闲置',
      'consumed': '已消耗',
      'lost': '遗失'
    };
    return map[status] || '';
  },
  
  resetForm() {
    const nameEl = document.getElementById('create-name');
    if (nameEl) nameEl.value = '';
    
    const categoryEl = document.getElementById('create-category');    
    const notesEl = document.getElementById('create-notes');
    if (notesEl) notesEl.value = '';
    
    const richContent = document.getElementById('create-rich-content');
    if (richContent) richContent.innerHTML = '';
    
    // 重置标签 Chip 输入
    if (window.TagManager) {
      TagManager.currentTags = [];
      const wrapper = document.getElementById('tag-input-wrapper');
      const input = document.getElementById('create-tags');
      if (wrapper && input) {
        input.value = '';
        wrapper.querySelectorAll('.tag-chip').forEach(c => c.remove());
      }
    }
    
    const status = document.getElementById('create-status');
    if (status) status.value = 'in-use';
    
    const dateInput = document.getElementById('create-date');
    if (dateInput) dateInput.value = '';
    
    const preview = document.getElementById('photo-preview');
    if (preview) preview.innerHTML = '';
    
    // 隐藏进度条和摘要
    const progress = document.getElementById('photo-upload-progress');
    if (progress) progress.classList.remove('active');
    const summary = document.getElementById('photo-summary');
    if (summary) summary.style.display = 'none';
    
    this.currentPhotos = [];
    this.totalSavedBytes = 0;
    
    const titleEl = document.getElementById('create-title');
    if (titleEl) titleEl.textContent = '新建记录';
    
    // 清除草稿
    if (window.DraftManager) DraftManager.clearDraft();
  },
  
  async editItem(id) {
    const item = await this.getItem(id);
    if (!item) return;
    
    this.editingId = id;
    
    const nameInput = document.getElementById('create-name');
    const categoryInput = document.getElementById('create-category');
    const notesInput = document.getElementById('create-notes');
    const statusSelect = document.getElementById('create-status');
    const dateInput = document.getElementById('create-date');
    
    if (nameInput) nameInput.value = item.name || '';    if (notesInput) notesInput.value = item.notes || '';
    if (statusSelect) statusSelect.value = item.status || 'in-use';
    if (dateInput && item.date) dateInput.value = item.date;
    
    // 设置标签 Chips
    if (window.TagManager && item.tags) {
      TagManager.setTags(item.tags);
    }
    
    this.currentPhotos = item.photos || [];
    this.totalSavedBytes = 0;
    
    const preview = document.getElementById('photo-preview');
    if (preview && item.photos) {
      preview.innerHTML = item.photos.map((photo, idx) => `
        <div class="photo-preview-item">
          <img src="${photo}" alt="预览" />
          <button type="button" class="photo-remove" data-idx="${idx}">×</button>
        </div>
      `).join('');
      
      // 绑定删除按钮
      preview.querySelectorAll('.photo-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          this.currentPhotos.splice(idx, 1);
          btn.closest('.photo-preview-item').remove();
        });
      });
    }
    
    const titleEl = document.getElementById('create-title');
    if (titleEl) titleEl.textContent = '编辑记录';
    
    this.switchPage('form');
  },
  
  async submitForm() {
    const nameEl = document.getElementById('create-name');
    const categoryEl = document.getElementById('create-category');
    // 兼容 contenteditable div 和普通 input
    const notesEl = document.getElementById('create-rich-content') || document.getElementById('create-notes');
    const statusEl = document.getElementById('create-status');
    const dateEl = document.getElementById('create-date');
    
    const name = nameEl ? nameEl.value.trim() : '';
    const category = categoryEl ? categoryEl.value.trim() : '';
    // 处理 contenteditable 的内容
    const notes = notesEl ? (notesEl.isContentEditable ? notesEl.innerHTML.trim() : notesEl.value.trim()) : '';
    const tags = window.TagManager ? TagManager.getSelectedTags() : [];
    const status = statusEl ? statusEl.value : '';
    const date = dateEl ? dateEl.value : '';
    
    if (!name) {
      this.showToast('请输入名称');
      return;
    }
    
    const photos = this.currentPhotos || [];
    const now = new Date().toISOString();
    
    if (this.editingId) {
      const item = await this.getItem(this.editingId);
      if (item) {
        item.name = name;        item.notes = notes;
        item.tags = tags;
        item.status = status;
        item.date = date;
        item.photos = photos;
        item.updatedAt = now;
        await StorageBackend.put(item);
        this.showToast('✅ 已更新');
      }
    } else {
      const newItem = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name,        notes,
        tags,
        status,
        date,
        photos,
        favorite: false,
        createdAt: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        updatedAt: now
      };
      await StorageBackend.put(newItem);
      this.showToast('✅ 已创建');
    }
    
    const titleEl = document.getElementById('create-title');
    if (titleEl) titleEl.textContent = '新建记录';
    
    // 清除草稿
    if (window.DraftManager) DraftManager.clearDraft();
    
    await this.loadItems();
    this.renderTagFilter();
    this.renderItems();
    this.switchPage('home');
  },
  
  currentPhotos: [],
  totalSavedBytes: 0,
  
  async handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const preview = document.getElementById('photo-preview');
    const progressEl = document.getElementById('photo-upload-progress');
    const progressText = document.getElementById('photo-progress-text');
    const progressPercent = document.getElementById('photo-progress-percent');
    const progressFill = document.getElementById('photo-progress-fill');
    const summaryEl = document.getElementById('photo-summary');
    
    if (!preview) return;
    
    // 显示进度条
    if (progressEl) progressEl.classList.add('active');
    if (summaryEl) summaryEl.style.display = 'flex';
    
    const total = files.length;
    
    for (let i = 0; i < total; i++) {
      const file = files[i];
      try {
        const result = await ImageProcessor.compress(file, {
          quality: 0.7,
          maxWidth: 1200,
          maxHeight: 1200
        }, (percent, origSize, compSize) => {
          // 更新进度
          const overallPercent = ((i + percent / 100) / total * 100).toFixed(0);
          if (progressPercent) progressPercent.textContent = overallPercent + '%';
          if (progressFill) progressFill.style.width = overallPercent + '%';
          if (progressText) progressText.textContent = `正在处理 ${i + 1}/${total}...`;
        });
        
        // 保存压缩后的图片
        this.currentPhotos.push(result.dataUrl);
        this.totalSavedBytes += (result.originalSize - result.compressedSize);
        
        // 添加预览项（带删除按钮）
        const idx = this.currentPhotos.length - 1;
        preview.innerHTML += `
          <div class="photo-preview-item">
            <img src="${result.dataUrl}" alt="预览" />
            <button type="button" class="photo-remove" data-idx="${idx}">×</button>
            <div class="photo-item-info">
              <span>${this.escapeHtml(file.name)}</span>
              <span class="photo-size-comparison">
                <span class="photo-size-original">${ImageProcessor.formatSize(result.originalSize)}</span>
                <span class="photo-size-arrow">→</span>
                <span class="photo-size-compressed">${ImageProcessor.formatSize(result.compressedSize)}</span>
                ${result.ratio > 0 ? `<span class="photo-compression-ratio">-${result.ratio}%</span>` : ''}
              </span>
            </div>
          </div>
        `;
        
        // 绑定删除按钮
        preview.querySelector(`.photo-remove[data-idx="${idx}"]`).addEventListener('click', () => {
          const removeIdx = parseInt(preview.querySelector(`.photo-remove[data-idx="${idx}"]`).dataset.idx);
          this.currentPhotos.splice(removeIdx, 1);
          preview.querySelector(`.photo-preview-item:nth-child(${removeIdx + 1})`).remove();
        });
        
      } catch (err) {
        console.error('图片压缩失败:', err);
        this.showToast(`图片处理失败: ${file.name}`);
      }
    }
    
    // 更新摘要
    if (summaryEl) {
      summaryEl.querySelector('.summary-count').textContent = this.currentPhotos.length;
      summaryEl.querySelector('.summary-saved').textContent = ImageProcessor.formatSize(this.totalSavedBytes);
    }
    
    // 隐藏进度条
    if (progressEl) {
      setTimeout(() => progressEl.classList.remove('active'), 1000);
    }
    
    this.showToast(`✅ 已添加 ${total} 张照片`);
    
    // 清空文件输入
    e.target.value = '';
  },
  
  renderTagFilter() {
    const container = document.getElementById('tag-filter');
    if (!container) return;
    
    TagManager.getAllTags().then(tags => {
      if (tags.length === 0) {
        container.innerHTML = '';
        return;
      }
      
      container.innerHTML = `
        <button class="tag-item active" data-tag="">全部</button>
        ${tags.slice(0, 10).map(tag => `
          <button class="tag-item" data-tag="${TagManager.escapeHtml(tag.name)}">${TagManager.escapeHtml(tag.name)}</button>
        `).join('')}
      `;
      
      container.querySelectorAll('.tag-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.tag-item').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.currentTag = e.target.dataset.tag;
          this.currentCategory = '';
          this.filterItems();
          this.renderItems();
        });
      });
    });
  },
  
  async renderFavorites() {
    const container = document.getElementById('favorites-container');
    if (!container) return;
    
    let favorites;
    if (window.IDBModule && IDBModule.db) {
      favorites = await IDBModule.getFavorites();
    } else {
      favorites = this.items.filter(item => item.favorite);
    }
    
    if (favorites.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <img src="empty-favorites.svg" alt="空状态" class="empty-image" />
          <p class="empty-title">暂无收藏</p>
          <p class="empty-desc">收藏你喜欢的记录吧</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = favorites.map(item => `
      <div class="item-card" data-id="${item.id}">
        ${item.photos && item.photos.length > 0 ? `
          <div class="item-photo">
            <img src="${item.photos[0]}" alt="${this.escapeHtml(item.name)}" />
          </div>
        ` : ''}
        <div class="item-content">
          <h3 class="item-name">${this.escapeHtml(item.name || '未命名')}</h3>
          <p class="item-category">${this.escapeHtml(item.category || '未分类')}</p>
          <div class="item-meta">
            <span class="item-date">${item.createdAt}</span>
            <span class="item-favorite">⭐</span>
          </div>
        </div>
      </div>
    `).join('');
  },
  
  async loadStats() {
    const total = this.items.length;
    const favorites = this.items.filter(i => i.favorite).length;
    const byCategory = this.items.reduce((acc, item) => {
      acc[item.category || '未分类'] = (acc[item.category || '未分类'] || 0) + 1;
      return acc;
    }, {});
    
    const totalEl = document.getElementById('stats-total');
    const favEl = document.getElementById('stats-favorites');
    if (totalEl) totalEl.textContent = total;
    if (favEl) favEl.textContent = favorites;
    
    this.renderCharts(byCategory);
  },
  
  renderCharts(byCategory) {
    const categoryChartEl = document.getElementById('category-chart');
    if (!categoryChartEl || !window.echarts) return;
    
    const categoryChart = echarts.init(categoryChartEl);
    categoryChart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: '60%',
        data: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
      }]
    });
  },
  
  async exportData() {
    const items = await StorageBackend.getAll();
    const json = JSON.stringify({
      version: '3.1',
      exportedAt: new Date().toISOString(),
      items: items
    }, null, 2);
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `万物手札备份_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('✅ 导出成功');
  },
  
  async importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.items || !Array.isArray(data.items)) {
          this.showToast('❌ 无效的数据格式');
          return;
        }
        
        const existing = await StorageBackend.getAll();
        const existingIds = new Set(existing.map(item => item.id));
        
        let imported = 0;
        let skipped = 0;
        
        for (const item of data.items) {
          if (existingIds.has(item.id)) {
            skipped++;
          } else {
            item.favorite = item.favorite || false;
            item.tags = item.tags || [];
            existing.push(item);
            imported++;
          }
        }
        
        await StorageBackend.save(existing);
        await this.loadItems();
            this.renderTagFilter();
        this.renderItems();
        this.showToast(`✅ 导入成功：新增 ${imported} 条，跳过 ${skipped} 条重复`);
      } catch (err) {
        this.showToast('❌ JSON 解析失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },
  
  togglePasswordLock() {
    if (Security.hasPassword()) {
      PasswordUI.showModal('🔓 关闭保护', '输入密码关闭数据加密', '输入当前密码', async (password) => {
        if (Security.verifyPassword(password)) {
          const items = Security.decryptData(password);
          if (items) {
            Security.removePassword();
            await StorageBackend.save(items);
            PasswordUI.hideModal();
            this.showToast('保护已关闭');
          } else {
            PasswordUI.showError('解密失败，请重试');
          }
        } else {
          PasswordUI.showError('密码错误');
        }
      });
    } else {
      PasswordUI.showModal('🔒 设置密码', '设置密码保护数据', '输入密码', (password) => {
        PasswordUI.showModal('🔒 确认密码', '请再次输入密码', '再次输入密码', async (confirmPwd) => {
          if (password !== confirmPwd) {
            PasswordUI.showError('两次密码不一致');
            return;
          }
          Security.setPassword(password);
          const items = await StorageBackend.getAll();
          Security.encryptData(items, password);
          window.__isDecrypted = true;
          window.__cachedItems = items;
          PasswordUI.hideModal();
          this.showToast('密码设置成功');
        });
      });
    }
  },
  
  showAbout() {
    alert('万物手札 v3.1.0\n\n记录世间万物，收藏生活点滴\n\n新特性：草稿自动保存、回收站、批量操作');
  },
  
  async migrateLegacyData() {
    console.log('开始执行 v3.4.0 数据迁移...');
    let changed = false;
    for (let item of this.items) {
      if (item.category && item.category.trim() !== '') {
        if (!Array.isArray(item.tags)) item.tags = [];
        if (!item.tags.includes(item.category)) {
          item.tags.push(item.category);
          console.log(`迁移分类 "${item.category}" 到标签列表`);
        }
        delete item.category;
        changed = true;
      }
    }
    if (changed) {
      await StorageBackend.save(this.items);
      console.log('数据迁移完成');
    }
  },

  stripHtml(html) {
    if (!html) return '';
    let tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },

  showToast(message) {

    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    if (toast && toastMessage) {
      toastMessage.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
  },
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  updateCloudStatus() {
    const statusText = document.getElementById('cloud-status-text');
    if (statusText && window.CloudSync) {
      statusText.textContent = CloudSync.getStatusText();
    }
  },
  
  showCloudConfig() {
    const modal = document.getElementById('cloud-modal');
    const gistInput = document.getElementById('sync-gist-id');
    const tokenInput = document.getElementById('sync-token');
    const keyInput = document.getElementById('sync-key');
    
    if (gistInput) gistInput.value = CloudSync.config.gistId || '';
    if (tokenInput) tokenInput.value = CloudSync.config.token || '';
    if (keyInput) keyInput.value = '';
    if (modal) modal.classList.add('active');
    
    setTimeout(() => { if (tokenInput) tokenInput.focus(); }, 100);
  },
  
  async saveCloudConfig() {
    const gistId = document.getElementById('sync-gist-id')?.value.trim() || '';
    const token = document.getElementById('sync-token')?.value.trim() || '';
    const key = document.getElementById('sync-key')?.value || '';
    
    if (!token) {
      this.showToast('请输入 GitHub Token');
      return;
    }
    
    if (key.length < 6) {
      this.showToast('加密密钥至少 6 位');
      return;
    }
    
    CloudSync.config.gistId = gistId;
    CloudSync.config.token = token;
    CloudSync.config.password = key;
    CloudSync.config.enabled = true;
    CloudSync.saveConfig();
    
    const modal = document.getElementById('cloud-modal');
    if (modal) modal.classList.remove('active');
    
    this.updateCloudStatus();
    this.showToast('✅ 同步配置已保存');
  },
  
  async testCloudConnection() {
    const token = document.getElementById('cloud-token-input')?.value.trim() || '';
    if (!token) {
      this.showToast('请先输入 Token');
      return;
    }
    
    CloudSync.config.token = token;
    const testArea = document.getElementById('cloud-test-area');
    const testResult = document.getElementById('cloud-test-result');
    
    if (testArea) testArea.style.display = 'block';
    if (testResult) {
      testResult.className = 'test-result loading';
      testResult.textContent = '正在测试连接...';
    }
    
    const result = await CloudSync.testConnection();
    
    if (testResult) {
      if (result.success) {
        testResult.className = 'test-result success';
        testResult.textContent = `✅ ${result.message}`;
      } else {
        testResult.className = 'test-result error';
        testResult.textContent = `❌ ${result.message}`;
      }
    }
  },
  
  async cloudUpload() {
    if (!CloudSync.config.token) {
      this.showToast('请先配置同步设置');
      this.showCloudConfig();
      return;
    }
    
    PasswordUI.showModal('🔐 加密密码', '输入加密密码以上传数据', '输入密码', async (password) => {
      this.showSyncProgress('正在加密数据...');
      
      const items = await StorageBackend.getAll();
      const result = await CloudSync.upload(items, password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        this.updateCloudStatus();
        this.showToast(`✅ ${result.message}`);
      } else {
        this.showToast(`❌ ${result.message}`);
      }
      
      PasswordUI.hideModal();
    });
  },
  
  async cloudDownload() {
    if (!CloudSync.config.token) {
      this.showToast('请先配置同步设置');
      this.showCloudConfig();
      return;
    }
    
    PasswordUI.showModal(' 解密密码', '输入解密密码以下载数据', '输入密码', async (password) => {
      this.showSyncProgress('正在从云端下载...');
      
      const localItems = await StorageBackend.getAll();
      const result = await CloudSync.download(localItems, password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        await StorageBackend.save(result.items);
        await this.loadItems();
        this.renderItems();
        this.renderFavorites();
            this.updateCloudStatus();
        this.showToast(`✅ ${result.message}`);
      } else {
        this.showToast(`❌ ${result.message}`);
      }
      
      PasswordUI.hideModal();
    });
  },
  
  async cloudSyncBidirectional() {
    if (!CloudSync.config.token) {
      this.showToast('请先配置同步设置');
      this.showCloudConfig();
      return;
    }
    
    PasswordUI.showModal('🔄 同步密码', '输入密码进行双向同步', '输入密码', async (password) => {
      this.showSyncProgress('正在双向同步...');
      
      const localItems = await StorageBackend.getAll();
      const result = await CloudSync.syncBidirectional(localItems, password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        await StorageBackend.save(result.items);
        await this.loadItems();
        this.renderItems();
        this.renderFavorites();
            this.updateCloudStatus();
        this.showToast(`✅ ${result.message}`);
      } else {
        this.showToast(`❌ ${result.message}`);
      }
      
      PasswordUI.hideModal();
    });
  },
  
  async autoSync() {
    if (!CloudSync.config.password) return;
    
    try {
      const localItems = await StorageBackend.getAll();
      const result = await CloudSync.syncBidirectional(localItems, CloudSync.config.password);
      
      if (result.success) {
        await StorageBackend.save(result.items);
        await this.loadItems();
        this.renderItems();
        this.renderFavorites();
            this.updateCloudStatus();
      }
    } catch (e) {
      console.warn('自动同步失败:', e);
    }
  },
  
  showSyncProgress(status) {
    const modal = document.getElementById('sync-progress-modal');
    const text = document.getElementById('sync-status-text');
    if (text) text.textContent = status;
    if (modal) modal.style.display = 'flex';
  },
  
  hideSyncProgress() {
    const modal = document.getElementById('sync-progress-modal');
    if (modal) modal.style.display = 'none';
  },
  
  shareItem(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    
    const text = `【${item.name}】\n${item.notes || ''}\n${item.tags ? '#' + item.tags.join(' #') : ''}`;
    
    if (navigator.share) {
      navigator.share({
        title: item.name,
        text: text
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('已复制到剪贴板');
      });
    }
  },
  
  // ==================== UI 工具方法 ====================
  
  async migrateLegacyData() {
    console.log('开始执行 v3.4.0 数据迁移...');
    let changed = false;
    for (let item of this.items) {
      if (item.category && item.category.trim() !== '') {
        if (!Array.isArray(item.tags)) item.tags = [];
        if (!item.tags.includes(item.category)) {
          item.tags.push(item.category);
          console.log(`迁移分类 "${item.category}" 到标签列表`);
        }
        delete item.category;
        changed = true;
      }
    }
    if (changed) {
      await StorageBackend.save(this.items);
      console.log('数据迁移完成');
    }
  },

  stripHtml(html) {
    if (!html) return '';
    let tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },

  showToast(message) {

    let toast = document.getElementById('toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-notification';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },
  
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  },
  
};

// ===================================
// 启动应用
// ===================================

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// 导出到全局（仅导出未独立成模块的对象）
window.App = App;
window.StorageBackend = StorageBackend;
window.ImageProcessor = ImageProcessor;
window.IDBModule = IDBModule;
window.TrashManager = TrashManager;
window.DraftManager = DraftManager;
window.CalendarView = CalendarView;
window.TemplateManager = TemplateManager;
