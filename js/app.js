/**
 * 万物手札 H5 - 主应用逻辑
 * 支持：IndexedDB、云端同步、冲突解决、分享功能
 */

// CloudSync 别名（兼容 sync.js 导出的 Sync 对象）
const CloudSync = window.Sync || {
  loadConfig: () => {},
  isEnabled: () => false,
  config: {},
  getStatusText: () => '未配置',
  saveConfig: () => {},
  testConnection: async () => ({success: false}),
  upload: async () => ({success: false}),
  download: async () => ({success: false}),
  syncBidirectional: async () => ({success: false}),
  uploadIncremental: async () => ({success: false})
};

// ===================================
// 加密工具
// ===================================

const Crypto = {
  KEY_STORAGE: '_uj_salt',
  
  generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  },
  
  deriveKey(password, salt) {
    let key = salt;
    for (let i = 0; i < 100; i++) {
      key = password + key + salt;
      let hash = 0;
      for (let j = 0; j < key.length; j++) {
        const char = key.charCodeAt(j);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      key = hash.toString(36);
    }
    return key;
  },
  
  encrypt(text, password) {
    const salt = this.generateSalt();
    const key = this.deriveKey(password, salt);
    let encrypted = '';
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      encrypted += String.fromCharCode(charCode ^ keyChar);
    }
    
    return salt + ':' + btoa(encrypted);
  },
  
  decrypt(encryptedText, password) {
    try {
      const [salt, data] = encryptedText.split(':');
      if (!salt || !data) return null;
      
      const key = this.deriveKey(password, salt);
      const decoded = atob(data);
      let decrypted = '';
      
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        decrypted += String.fromCharCode(charCode ^ keyChar);
      }
      
      return decrypted;
    } catch (e) {
      return null;
    }
  }
};

// ===================================
// 安全模块
// ===================================

const Security = {
  LOCK_KEY: '_uj_locked',
  DATA_KEY: '_uj_data_encrypted',
  HASH_KEY: '_uj_hash',
  
  isLocked() {
    return localStorage.getItem(this.LOCK_KEY) === 'true';
  },
  
  hasPassword() {
    return !!localStorage.getItem(this.HASH_KEY);
  },
  
  setPassword(password) {
    const hash = this.hashPassword(password);
    localStorage.setItem(this.HASH_KEY, hash);
    localStorage.setItem(this.LOCK_KEY, 'true');
  },
  
  verifyPassword(password) {
    const hash = this.hashPassword(password);
    return hash === localStorage.getItem(this.HASH_KEY);
  },
  
  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  },
  
  encryptData(items, password) {
    const json = JSON.stringify(items);
    const encrypted = Crypto.encrypt(json, password);
    localStorage.setItem(this.DATA_KEY, encrypted);
    localStorage.removeItem('universal_journal_items');
  },
  
  decryptData(password) {
    const encrypted = localStorage.getItem(this.DATA_KEY);
    if (!encrypted) return null;
    
    const decrypted = Crypto.decrypt(encrypted, password);
    if (!decrypted) return null;
    
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return null;
    }
  },
  
  removePassword() {
    localStorage.removeItem(this.HASH_KEY);
    localStorage.removeItem(this.LOCK_KEY);
    localStorage.removeItem(this.DATA_KEY);
  }
};

// ===================================
// 存储模块（支持 localStorage 和 IndexedDB）
// ===================================

const Storage = {
  KEY: 'universal_journal_items',
  
  getAll() {
    // 优先使用 IndexedDB
    if (window.IDB && IDB.db) {
      return window.__cachedItems || [];
    }
    
    // 降级到 localStorage
    const data = localStorage.getItem(this.KEY);
    if (window.__cachedItems) {
      return window.__cachedItems;
    }
    return data ? JSON.parse(data) : [];
  },
  
  save(items) {
    if (window.__isDecrypted) {
      window.__cachedItems = items;
      return;
    }
    
    // 优先使用 IndexedDB
    if (window.IDB && IDB.db) {
      IDB.putMany(items);
      window.__cachedItems = items;
      return;
    }
    
    localStorage.setItem(this.KEY, JSON.stringify(items));
  },
  
  add(item) {
    const items = this.getAll();
    item.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    item.createdAt = new Date().toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    item.updatedAt = new Date().toISOString();
    item.favorite = item.favorite || false;
    item.photos = item.photos || [];
    items.unshift(item);
    this.save(items);
    
    // 标记为修改（增量同步用）
    if (window.IDB) IDB.markAsModified(item.id);
    
    return item;
  },
  
  update(id, updates) {
    const items = this.getAll();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    if (!updates.photos && items[index].photos) {
      updates.photos = items[index].photos;
    }
    
    updates.updatedAt = new Date().toISOString();
    items[index] = { ...items[index], ...updates };
    this.save(items);
    
    // 标记为修改
    if (window.IDB) IDB.markAsModified(id);
    
    return items[index];
  },
  
  delete(id) {
    const items = this.getAll();
    const filtered = items.filter(item => item.id !== id);
    this.save(filtered);
    
    // 标记为删除
    if (window.IDB) IDB.markAsDeleted(id);
  },
  
  get(id) {
    const items = this.getAll();
    return items.find(item => item.id === id);
  },
  
  getFavorites() {
    const items = this.getAll();
    return items.filter(item => item.favorite);
  },
  
  toggleFavorite(id) {
    const items = this.getAll();
    const item = items.find(item => item.id === id);
    if (item) {
      item.favorite = !item.favorite;
      item.updatedAt = new Date().toISOString();
      this.save(items);
      if (window.IDB) IDB.markAsModified(id);
      return item.favorite;
    }
    return false;
  },
  
  count() {
    return this.getAll().length;
  },
  
  deleteItem(id) {
    const items = this.getAll();
    const filtered = items.filter(item => item.id !== id);
    this.save(filtered);
    return filtered.length < items.length;
  },
  
  exportJSON() {
    const items = this.getAll();
    return JSON.stringify({
      version: '2.0',
      exportedAt: new Date().toISOString(),
      items: items
    }, null, 2);
  },
  
  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.items || !Array.isArray(data.items)) {
        return { success: false, message: '无效的数据格式' };
      }
      
      const existing = this.getAll();
      const existingIds = new Set(existing.map(item => item.id));
      
      let imported = 0;
      let skipped = 0;
      
      data.items.forEach(item => {
        if (existingIds.has(item.id)) {
          skipped++;
        } else {
          item.favorite = item.favorite || false;
          existing.push(item);
          imported++;
        }
      });
      
      this.save(existing);
      return {
        success: true,
        message: `导入成功：新增 ${imported} 条，跳过 ${skipped} 条重复`,
        imported,
        skipped
      };
    } catch (e) {
      return { success: false, message: 'JSON 解析失败' };
    }
  }
};

// ===================================
// 主题管理
// ===================================

const ThemeManager = {
  currentTheme: 'light',
  themes: [
    { id: 'light', name: '明亮' },
    { id: 'dark', name: '暗黑' },
    { id: 'warm', name: '暖光' },
    { id: 'ink', name: '墨影' }
  ],
  
  init() {
    const saved = localStorage.getItem('universal_journal_theme');
    if (saved && this.themes.find(t => t.id === saved)) {
      this.currentTheme = saved;
    }
    document.documentElement.setAttribute('data-theme', this.currentTheme);
  },
  
  apply(themeId) {
    const theme = this.themes.find(t => t.id === themeId);
    if (!theme) return;
    
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('universal_journal_theme', themeId);
    this.currentTheme = themeId;
    
    const themeNameEl = document.getElementById('current-theme-name');
    if (themeNameEl) themeNameEl.textContent = theme.name;
  },
  
  renderOptions() {
    const container = document.getElementById('theme-options');
    if (!container) return;
    
    container.innerHTML = this.themes.map(theme => `
      <div class="theme-option" data-theme="${theme.id}">
        <div class="theme-preview" style="background: var(--bg); border-color: var(--primary)"></div>
        <span class="theme-name">${theme.name}</span>
      </div>
    `).join('');
    
    container.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => {
        this.apply(option.dataset.theme);
        document.getElementById('theme-panel').classList.remove('show');
      });
    });
  }
};

// ===================================
// 密码 UI
// ===================================

const PasswordUI = {
  currentAction: null,
  currentCallback: null,
  
  showModal(title, hint, placeholder, callback) {
    this.currentCallback = callback;
    
    const titleEl = document.getElementById('modal-title');
    const hintEl = document.getElementById('modal-hint');
    const input = document.getElementById('modal-password');
    const modal = document.getElementById('password-modal');
    
    if (titleEl) titleEl.textContent = title;
    if (hintEl) hintEl.textContent = hint || '';
    if (input) {
      input.placeholder = placeholder || '请输入密码';
      input.value = '';
    }
    if (modal) modal.style.display = 'flex';
    
    setTimeout(() => { if (input) input.focus(); }, 100);
  },
  
  hideModal() {
    const modal = document.getElementById('password-modal');
    if (modal) modal.style.display = 'none';
    this.currentCallback = null;
  },
  
  showError(message) {
    const hint = document.getElementById('modal-hint');
    if (hint) {
      hint.textContent = message;
      hint.className = 'modal-hint error';
    }
  },
  
  showLockScreen() {
    const input = document.getElementById('lock-password');
    const hint = document.getElementById('lock-hint');
    const overlay = document.getElementById('lock-overlay');
    
    if (input) input.value = '';
    if (hint) {
      hint.textContent = '';
      hint.className = 'lock-hint';
    }
    if (overlay) overlay.style.display = 'flex';
    
    setTimeout(() => { if (input) input.focus(); }, 100);
  },
  
  hideLockScreen() {
    const overlay = document.getElementById('lock-overlay');
    if (overlay) overlay.style.display = 'none';
  }
};

// ===================================
// 应用主逻辑
// ===================================

const App = {
  currentPage: 'home',
  currentCategory: '',
  searchKey: '',
  items: [],
  filteredItems: [],
  editingId: null,
  currentDetailId: null,
  
  async init() {
    // 初始化 IndexedDB
    if (window.IDB) {
      await IDB.init();
      const migration = await IDB.migrateFromLocalStorage();
      if (migration.migrated > 0) {
        console.log(`📦 从 localStorage 迁移 ${migration.migrated} 条记录到 IndexedDB`);
      }
    }
    
    ThemeManager.init();
    ThemeManager.renderOptions();
    this.bindEvents();
    this.bindPasswordEvents();
    this.bindSettingsEvents();
    
    // 初始化增强功能
    if (window.EnhancedFeatures) {
      EnhancedFeatures.init();
    }
    
    // 加载云同步配置
    CloudSync.loadConfig();
    this.updateCloudStatus();
    
    // 启动时自动同步
    if (CloudSync.isEnabled() && CloudSync.config.syncOnStart) {
      this.autoSync();
    }
    
    if (Security.isLocked()) {
      PasswordUI.showLockScreen();
    } else {
      this.loadItems();
      this.renderCategoryFilter();
      this.renderItems();
    }
    
    // 确保初始页面和 FAB 状态正确
    this.switchPage('home');
    
    console.log(' 万物手札 H5 已启动 v=2.7.4');
  },
  
  bindEvents() {
    // 主题切换
    const toggle = document.getElementById('theme-toggle');
    const panel = document.getElementById('theme-panel');
    if (toggle) {
      toggle.addEventListener('click', () => {
        panel.classList.toggle('show');
      });
    }
    
    // 点击外部关闭主题面板
    document.addEventListener('click', (e) => {
      if (panel && !panel.contains(e.target) && !toggle.contains(e.target)) {
        panel.classList.remove('show');
      }
    });
    
    // TabBar 切换
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const page = e.currentTarget.closest('.tab-item').dataset.page;
        this.switchPage(page);
      });
    });
    
    // FAB 添加按钮
    const fabBtn = document.getElementById('fab-add');
    if (fabBtn) {
      fabBtn.addEventListener('click', () => {
        this.editingId = null;
        this.resetForm();
        this.switchPage('form');
      });
    }
    
    // 空状态添加按钮
    const emptyBtn = document.getElementById('empty-add-btn');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => {
        this.editingId = null;
        this.resetForm();
        this.switchPage('form');
      });
    }
    
    // 搜索
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    
    // 实时搜索（防抖）
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
    
    // 分类筛选
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-item')) {
          document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.currentCategory = e.target.dataset.category;
          this.filterItems();
          this.renderItems();
        }
      });
    }
    
    // 返回按钮
    const detailBack = document.getElementById('detail-back-btn');
    if (detailBack) {
      detailBack.addEventListener('click', () => {
        this.switchPage('home');
      });
    }
    
    const statsBack = document.getElementById('stats-back-btn');
    if (statsBack) {
      statsBack.addEventListener('click', () => {
        this.switchPage('profile');
      });
    }
    
    // 创建页按钮
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
    
    // 富文本工具栏
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const command = e.currentTarget.dataset.command;
        document.execCommand(command, false, null);
        const content = document.getElementById('create-rich-content');
        if (content) content.focus();
      });
    });
    
    // 照片上传
    const photoInput = document.getElementById('create-photo-input');
    const photoBtn = document.getElementById('create-photo-btn');
    
    if (photoBtn && photoInput) {
      photoBtn.addEventListener('click', () => {
        photoInput.click();
      });
      
      photoInput.addEventListener('change', (e) => {
        this.handlePhotoUpload(e);
      });
    }
    
    // 详情收藏按钮
    const detailFav = document.getElementById('detail-favorite-btn');
    if (detailFav) {
      detailFav.addEventListener('click', () => {
        if (this.currentDetailId) {
          const isFav = Storage.toggleFavorite(this.currentDetailId);
          this.updateFavoriteButton(isFav);
          this.showToast(isFav ? '已收藏' : '已取消收藏');
        }
      });
    }
    
    // 详情分享按钮
    const detailShare = document.getElementById('detail-share-btn');
    if (detailShare && window.EnhancedFeatures) {
      detailShare.addEventListener('click', () => {
        if (this.currentDetailId) {
          const item = Storage.get(this.currentDetailId);
          if (item) EnhancedFeatures.showShare(item);
        }
      });
    }
    
    // 详情编辑按钮
    const detailEdit = document.getElementById('detail-edit-btn');
    if (detailEdit) {
      detailEdit.addEventListener('click', () => {
        if (this.currentDetailId) {
          this.editItem(this.currentDetailId);
        }
      });
    }
    
    // 详情删除按钮
    const detailDelete = document.getElementById('detail-delete-btn');
    if (detailDelete) {
      detailDelete.addEventListener('click', () => {
        if (this.currentDetailId) {
          if (confirm('确定要删除这条记录吗？')) {
            Storage.deleteItem(this.currentDetailId);
            this.showToast('已删除');
            this.currentDetailId = null;
            this.loadItems();
            this.renderItems();
            this.switchPage('home');
          }
        }
      });
    }
    
    // 收藏页筛选
    const favFilter = document.getElementById('favorites-category-filter');
    if (favFilter) {
      favFilter.addEventListener('change', () => {
        this.renderFavorites();
      });
    }
  },
  
  bindSettingsEvents() {
    // 导出数据
    const exportBtn = document.getElementById('settings-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportData();
      });
    }
    
    // 导入数据
    const importBtn = document.getElementById('settings-import');
    const importInput = document.getElementById('import-file-input');
    
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => {
        importInput.click();
      });
      
      importInput.addEventListener('change', (e) => {
        this.importData(e);
      });
    }
    
    // 清空数据
    const clearBtn = document.getElementById('settings-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('⚠️ 确定要删除所有数据吗？此操作不可恢复！')) {
          if (confirm('再次确认：真的要清空所有物品数据吗？')) {
            localStorage.removeItem('universal_journal_items');
            localStorage.removeItem(Security.DATA_KEY);
            if (window.IDB) IDB.clear();
            this.items = [];
            this.filteredItems = [];
            this.renderItems();
            this.renderFavorites();
            this.showToast('数据已清空');
          }
        }
      });
    }
    
    // 密码保护
    const lockBtn = document.getElementById('settings-lock');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        this.togglePasswordLock();
      });
    }
    
    // 主题
    const themeBtn = document.getElementById('settings-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) toggle.click();
      });
    }
    
    // 统计
    const statsBtn = document.getElementById('settings-stats');
    if (statsBtn) {
      statsBtn.addEventListener('click', () => {
        this.loadStats();
        this.switchPage('stats');
      });
    }
    
    // 关于
    const aboutBtn = document.getElementById('settings-about');
    if (aboutBtn) {
      aboutBtn.addEventListener('click', () => {
        this.showAbout();
      });
    }
    
    // 云端同步事件
    this.bindCloudEvents();
  },
  
  bindCloudEvents() {
    // 同步设置
    const configBtn = document.getElementById('settings-cloud-config');
    if (configBtn) {
      configBtn.addEventListener('click', () => {
        this.showCloudConfig();
      });
    }
    
    // 上传
    const uploadBtn = document.getElementById('settings-cloud-upload');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.cloudUpload();
      });
    }
    
    // 下载
    const downloadBtn = document.getElementById('settings-cloud-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.cloudDownload();
      });
    }
    
    // 双向同步
    const syncBtn = document.getElementById('settings-cloud-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.cloudSyncBidirectional();
      });
    }
    
    // 增量同步
    const incSyncBtn = document.getElementById('settings-cloud-upload-incremental');
    if (incSyncBtn) {
      incSyncBtn.addEventListener('click', () => {
        this.cloudUploadIncremental();
      });
    }
    
    // 同步日志
    const logsBtn = document.getElementById('settings-cloud-logs');
    if (logsBtn && window.EnhancedFeatures) {
      logsBtn.addEventListener('click', () => {
        EnhancedFeatures.showSyncLogs();
      });
    }
    
    // 配置弹窗 - 保存
    const saveBtn = document.getElementById('cloud-modal-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveCloudConfig();
      });
    }
    
    // 配置弹窗 - 测试连接
    const testBtn = document.getElementById('cloud-modal-test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.testCloudConnection();
      });
    }
    
    // 配置弹窗 - 取消
    const cancelBtn = document.getElementById('cloud-modal-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const tokenInput = document.getElementById('cloud-token-input');
        const passInput = document.getElementById('cloud-password-input');
        if (tokenInput) tokenInput.value = '';
        if (passInput) passInput.value = '';
        const modal = document.getElementById('cloud-modal');
        if (modal) modal.style.display = 'none';
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
      unlockBtn.addEventListener('click', () => {
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
          this.loadItems();
          this.renderCategoryFilter();
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
  
  // ... 其他方法保持不变 ...
  
  switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    
    const pageEl = document.getElementById(`page-${page}`);
    const tabEl = document.querySelector(`.tab-item[data-page="${page}"]`);
    
    if (pageEl) pageEl.classList.add('active');
    if (tabEl) tabEl.classList.add('active');
    
    this.currentPage = page;
    
    // 控制 FAB 显示/隐藏 - 只在首页显示
    const fab = document.getElementById('fab-add');
    if (fab) {
      fab.style.display = (page === 'home') ? 'flex' : 'none';
    }
    
    if (page === 'favorites') {
      this.renderFavorites();
    } else if (page === 'profile') {
      // 更新状态
      this.updateCloudStatus();
    }
  },
  
  loadItems() {
    if (window.__cachedItems) {
      this.items = window.__cachedItems;
    } else if (window.IDB && IDB.db) {
      this.items = IDB.getAll();
    } else {
      this.items = Storage.getAll();
    }
    this.filterItems();
  },
  
  filterItems() {
    this.filteredItems = this.items.filter(item => {
      const matchCategory = !this.currentCategory || item.category === this.currentCategory;
      const matchSearch = !this.searchKey || 
        (item.name && item.name.toLowerCase().includes(this.searchKey.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(this.searchKey.toLowerCase()));
      return matchCategory && matchSearch;
    });
  },
  
  renderItems() {
    const container = document.getElementById('items-container');
    if (!container) return;
    
    if (this.filteredItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <img src="empty-box.svg" alt="空状态" class="empty-image" />
          <p class="empty-title">暂无记录</p>
          <p class="empty-desc">添加你的第一条手札吧</p>
          <button class="btn btn-primary" id="empty-list-add-btn">新建记录</button>
        </div>
      `;
      
      const addBtn = document.getElementById('empty-list-add-btn');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          this.editingId = null;
          this.resetForm();
          this.switchPage('form');
        });
      }
      return;
    }
    
    container.innerHTML = this.filteredItems.map(item => `
      <div class="item-card" data-id="${item.id}">
        ${item.photos && item.photos.length > 0 ? `
          <div class="item-photo">
            <img src="${item.photos[0]}" alt="${item.name}" />
          </div>
        ` : ''}
        <div class="item-content">
          <h3 class="item-name">${this.escapeHtml(item.name || '未命名')}</h3>
          <p class="item-category">${this.escapeHtml(item.category || '未分类')}</p>
          <p class="item-notes">${this.escapeHtml(item.notes || '')}</p>
          <div class="item-meta">
            <span class="item-date">${item.createdAt}</span>
            ${item.favorite ? '<span class="item-favorite">⭐</span>' : ''}
          </div>
        </div>
      </div>
    `).join('');
    
    container.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showDetail(card.dataset.id);
      });
    });
  },
  
  showDetail(id) {
    const item = Storage.get(id);
    if (!item) return;
    
    this.currentDetailId = id;
    const container = document.getElementById('detail-content');
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
        
        ${item.notes ? `
          <div class="detail-section">
            <h3 class="detail-section-title">备注</h3>
            <div class="detail-notes">${this.escapeHtml(item.notes)}</div>
          </div>
        ` : ''}
        
        ${item.tags && item.tags.length > 0 ? `
          <div class="detail-section">
            <h3 class="detail-section-title">标签</h3>
            <div class="detail-tags">
              ${item.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    this.updateFavoriteButton(isFav === 'filled');
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
    const inputs = ['create-name', 'create-category', 'create-notes', 'create-rich-content'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    const status = document.getElementById('create-status');
    if (status) status.value = 'in-use';
    
    const dateInput = document.getElementById('create-date');
    if (dateInput) dateInput.value = '';
    
    const preview = document.getElementById('photo-preview');
    if (preview) preview.innerHTML = '';
    
    this.currentPhotos = [];
  },
  
  /**
   * 编辑条目
   */
  editItem(id) {
    const item = Storage.get(id);
    if (!item) return;
    
    this.editingId = id;
    
    // 填充表单
    const nameInput = document.getElementById('create-name');
    const categoryInput = document.getElementById('create-category');
    const notesInput = document.getElementById('create-notes');
    const statusSelect = document.getElementById('create-status');
    const dateInput = document.getElementById('create-date');
    
    if (nameInput) nameInput.value = item.name || '';
    if (categoryInput) categoryInput.value = item.category || '';
    if (notesInput) notesInput.value = item.notes || '';
    if (statusSelect) statusSelect.value = item.status || 'in-use';
    if (dateInput && item.date) dateInput.value = item.date;
    
    // 加载照片
    this.currentPhotos = item.photos || [];
    const preview = document.getElementById('photo-preview');
    if (preview && item.photos) {
      preview.innerHTML = item.photos.map(photo => `
        <div class="photo-preview-item">
          <img src="${photo}" alt="预览" />
        </div>
      `).join('');
    }
    
    // 更新标题
    const titleEl = document.getElementById('create-title');
    if (titleEl) titleEl.textContent = '编辑记录';
    
    // 切换到编辑页
    this.switchPage('form');
  },
  
  submitForm() {
    const nameEl = document.getElementById('create-name');
    const categoryEl = document.getElementById('create-category');
    const notesEl = document.getElementById('create-notes');
    const statusEl = document.getElementById('create-status');
    const dateEl = document.getElementById('create-date');
    
    const name = nameEl ? nameEl.value.trim() : '';
    const category = categoryEl ? categoryEl.value.trim() : '';
    const notes = notesEl ? notesEl.value.trim() : '';
    const status = statusEl ? statusEl.value : '';
    const date = dateEl ? dateEl.value : '';
    
    if (!name) {
      this.showToast('请输入名称');
      return;
    }
    
    const photos = this.currentPhotos || [];
    
    if (this.editingId) {
      Storage.update(this.editingId, { name, category, notes, status, date, photos });
      this.showToast('✅ 已更新');
    } else {
      Storage.add({ name, category, notes, status, date, photos });
      this.showToast('✅ 已创建');
    }
    
    // 重置标题
    const titleEl = document.getElementById('create-title');
    if (titleEl) titleEl.textContent = '新建记录';
    
    this.loadItems();
    this.renderCategoryFilter();
    this.renderItems();
    this.switchPage('home');
  },
  
  currentPhotos: [],
  
  handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const preview = document.getElementById('photo-preview');
    if (!preview) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.currentPhotos.push(event.target.result);
        preview.innerHTML += `
          <div class="photo-preview-item">
            <img src="${event.target.result}" alt="预览" />
          </div>
        `;
      };
      reader.readAsDataURL(file);
    });
  },
  
  renderCategoryFilter() {
    const container = document.getElementById('category-filter');
    if (!container) return;
    
    const categories = [...new Set(this.items.map(item => item.category).filter(Boolean))];
    
    container.innerHTML = `
      <button class="category-item active" data-category="">全部</button>
      ${categories.map(cat => `
        <button class="category-item" data-category="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</button>
      `).join('')}
    `;
  },
  
  renderFavorites() {
    const container = document.getElementById('favorites-container');
    if (!container) return;
    
    const favorites = Storage.getFavorites();
    
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
            <img src="${item.photos[0]}" alt="${item.name}" />
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
    
    container.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showDetail(card.dataset.id);
      });
    });
  },
  
  loadStats() {
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
    
    // 渲染图表
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
  
  exportData() {
    const json = Storage.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `万物手札备份_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('✅ 导出成功');
  },
  
  importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = Storage.importJSON(event.target.result);
      if (result.success) {
        this.loadItems();
        this.renderCategoryFilter();
        this.renderItems();
        this.showToast(`✅ ${result.message}`);
      } else {
        this.showToast(`❌ ${result.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },
  
  togglePasswordLock() {
    if (Security.hasPassword()) {
      PasswordUI.showModal('🔓 关闭保护', '输入密码关闭数据加密', '输入当前密码', (password) => {
        if (Security.verifyPassword(password)) {
          const items = Security.decryptData(password);
          if (items) {
            Security.removePassword();
            Storage.save(items);
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
        PasswordUI.showModal('🔒 确认密码', '请再次输入密码', '再次输入密码', (confirmPwd) => {
          if (password !== confirmPwd) {
            PasswordUI.showError('两次密码不一致');
            return;
          }
          Security.setPassword(password);
          const items = Storage.getAll();
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
    alert('万物手札 v2.0.0\n\n记录世间万物，收藏生活点滴\n\n设计哲学：无界原白 × 极简主义');
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
    if (statusText && CloudSync) {
      statusText.textContent = CloudSync.getStatusText();
    }
  },
  
  showCloudConfig() {
    const modal = document.getElementById('cloud-modal');
    const tokenInput = document.getElementById('cloud-token-input');
    const passInput = document.getElementById('cloud-password-input');
    const testArea = document.getElementById('cloud-test-area');
    const testResult = document.getElementById('cloud-test-result');
    
    if (tokenInput) tokenInput.value = CloudSync.config.token || '';
    if (passInput) passInput.value = '';
    if (testArea) testArea.style.display = 'none';
    if (testResult) {
      testResult.className = 'test-result';
      testResult.textContent = '';
    }
    if (modal) modal.style.display = 'flex';
    
    setTimeout(() => { if (tokenInput) tokenInput.focus(); }, 100);
  },
  
  async saveCloudConfig() {
    const token = document.getElementById('cloud-token-input')?.value.trim() || '';
    const password = document.getElementById('cloud-password-input')?.value || '';
    
    if (!token) {
      this.showToast('请输入 GitHub Token');
      return;
    }
    
    if (password.length < 6) {
      this.showToast('加密密码至少 6 位');
      return;
    }
    
    CloudSync.config.token = token;
    CloudSync.config.password = password;
    CloudSync.config.enabled = true;
    CloudSync.saveConfig();
    
    const modal = document.getElementById('cloud-modal');
    if (modal) modal.style.display = 'none';
    
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
      
      const items = this.items.length > 0 ? this.items : Storage.getAll();
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
    
    PasswordUI.showModal('🔓 解密密码', '输入解密密码以下载数据', '输入密码', async (password) => {
      this.showSyncProgress('正在从云端下载...');
      
      const localItems = Storage.getAll();
      const result = await CloudSync.download(localItems, password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        this.items = result.items;
        Storage.save(result.items);
        this.filterItems();
        this.renderItems();
        this.renderFavorites();
        this.renderCategoryFilter();
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
      
      const localItems = Storage.getAll();
      const result = await CloudSync.syncBidirectional(localItems, password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        this.items = result.items;
        Storage.save(result.items);
        this.filterItems();
        this.renderItems();
        this.renderFavorites();
        this.renderCategoryFilter();
        this.updateCloudStatus();
        this.showToast(`✅ ${result.message}`);
      } else {
        this.showToast(`❌ ${result.message}`);
      }
      
      PasswordUI.hideModal();
    });
  },
  
  async cloudUploadIncremental() {
    if (!CloudSync.config.token) {
      this.showToast('请先配置同步设置');
      this.showCloudConfig();
      return;
    }
    
    PasswordUI.showModal('🔐 加密密码', '输入加密密码以增量上传', '输入密码', async (password) => {
      this.showSyncProgress('正在增量上传...');
      
      const localItems = Storage.getAll();
      const result = await CloudSync.uploadIncremental(localItems, password);
      
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
  
  async autoSync() {
    if (!CloudSync.config.password) return;
    
    try {
      const localItems = Storage.getAll();
      const result = await CloudSync.syncBidirectional(localItems, CloudSync.config.password);
      
      if (result.success) {
        this.items = result.items;
        Storage.save(result.items);
        this.filterItems();
        this.renderItems();
        this.renderFavorites();
        this.renderCategoryFilter();
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
  }
};

// ===================================
// 启动应用
// ===================================

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
