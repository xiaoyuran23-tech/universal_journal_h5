/**
 * 万物手札 H5 - 主应用逻辑 v3.2.1-hotfix.2
 * 修复：分类管理逻辑、云同步事件绑定、Toast 提示样式
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
// 批量操作管理器
// ===================================

const BatchManager = {
  isBatchMode: false,
  selectedIds: new Set(),
  longPressTimer: null,
  LONG_PRESS_DURATION: 500,
  
  /**
   * 初始化批量操作
   */
  init() {
    this.bindLongPress();
  },
  
  /**
   * 绑定长按事件
   */
  bindLongPress() {
    const container = document.getElementById('items-container');
    if (!container) return;
    
    // 触摸设备长按
    container.addEventListener('touchstart', (e) => {
      const card = e.target.closest('.item-card');
      if (!card) return;
      
      this.longPressTimer = setTimeout(() => {
        this.enterBatchMode(card.dataset.id);
        // 震动反馈
        if (navigator.vibrate) navigator.vibrate(50);
      }, this.LONG_PRESS_DURATION);
    });
    
    container.addEventListener('touchend', () => {
      clearTimeout(this.longPressTimer);
    });
    
    container.addEventListener('touchmove', () => {
      clearTimeout(this.longPressTimer);
    });
    
    // 鼠标右键（桌面端批量模式入口）
    container.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.item-card');
      if (!card) return;
      
      e.preventDefault();
      this.enterBatchMode(card.dataset.id);
    });
  },
  
  /**
   * 进入批量模式
   */
  enterBatchMode(firstId) {
    this.isBatchMode = true;
    this.selectedIds.clear();
    this.selectedIds.add(firstId);
    
    this.showBatchToolbar();
    this.updateCardSelection();
  },
  
  /**
   * 退出批量模式
   */
  exitBatchMode() {
    this.isBatchMode = false;
    this.selectedIds.clear();
    this.hideBatchToolbar();
    this.updateCardSelection();
  },
  
  /**
   * 切换选中状态
   */
  toggleSelect(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.updateCardSelection();
    this.updateBatchToolbar();
  },
  
  /**
   * 全选/取消全选
   */
  toggleSelectAll() {
    if (this.selectedIds.size === App.items.length) {
      this.selectedIds.clear();
    } else {
      App.items.forEach(item => this.selectedIds.add(item.id));
    }
    this.updateCardSelection();
    this.updateBatchToolbar();
  },
  
  /**
   * 更新卡片选中样式
   */
  updateCardSelection() {
    document.querySelectorAll('.item-card').forEach(card => {
      if (this.selectedIds.has(card.dataset.id)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  },
  
  /**
   * 显示批量工具栏
   */
  showBatchToolbar() {
    let toolbar = document.getElementById('batch-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'batch-toolbar';
      toolbar.className = 'batch-toolbar';
      toolbar.innerHTML = `
        <div class="batch-toolbar-content">
          <span class="batch-count" id="batch-count">已选 0 项</span>
          <div class="batch-actions">
            <button class="btn btn-small" id="batch-select-all">全选</button>
            <button class="btn btn-small btn-danger" id="batch-delete">删除</button>
            <button class="btn btn-small" id="batch-cancel">取消</button>
          </div>
        </div>
      `;
      document.body.appendChild(toolbar);
      
      // 绑定事件
      document.getElementById('batch-select-all').addEventListener('click', () => {
        this.toggleSelectAll();
      });
      
      document.getElementById('batch-delete').addEventListener('click', () => {
        this.batchDelete();
      });
      
      document.getElementById('batch-cancel').addEventListener('click', () => {
        this.exitBatchMode();
      });
    }
    
    toolbar.classList.add('show');
    this.updateBatchToolbar();
  },
  
  /**
   * 隐藏批量工具栏
   */
  hideBatchToolbar() {
    const toolbar = document.getElementById('batch-toolbar');
    if (toolbar) {
      toolbar.classList.remove('show');
    }
  },
  
  /**
   * 更新批量工具栏计数
   */
  updateBatchToolbar() {
    const countEl = document.getElementById('batch-count');
    if (countEl) {
      countEl.textContent = `已选 ${this.selectedIds.size} 项`;
    }
  },
  
  /**
   * 批量删除
   */
  async batchDelete() {
    if (this.selectedIds.size === 0) return;
    
    if (!confirm(`确定要删除选中的 ${this.selectedIds.size} 条记录吗？`)) return;
    
    // 添加到回收站
    const itemsToDelete = App.items.filter(item => this.selectedIds.has(item.id));
    if (window.TrashManager) {
      TrashManager.addManyToTrash(itemsToDelete);
    }
    
    // 从主存储删除
    const ids = Array.from(this.selectedIds);
    await StorageBackend.deleteMany(ids);
    
    App.showToast(`已删除 ${ids.length} 条记录`);
    
    this.exitBatchMode();
    await App.loadItems();
    App.renderItems();
  },
  
  /**
   * 点击卡片处理
   */
  handleCardClick(id) {
    if (this.isBatchMode) {
      this.toggleSelect(id);
      return true; // 已处理
    }
    return false; // 未处理，需要正常点击逻辑
  }
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
    StorageBackend.clear();
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
// 标签管理模块
// ===================================

const TagManager = {
  // 当前已选标签（chip 模式）
  currentTags: [],
  
  async getAllTags() {
    if (window.IDBModule && IDBModule.db) {
      return await IDBModule.getAllTags();
    }
    const items = await StorageBackend.getAll();
    const tagMap = {};
    items.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(tagMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  },
  
  renderTagCloud(containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    this.getAllTags().then(tags => {
      if (tags.length === 0) {
        container.innerHTML = '<p class="empty-tags">暂无标签</p>';
        return;
      }
      
      const maxCount = tags[0].count;
      container.innerHTML = tags.map(tag => {
        const size = 0.8 + (tag.count / maxCount) * 0.8;
        return `<span class="tag-cloud-item" data-tag="${this.escapeHtml(tag.name)}" style="font-size: ${size}rem">${this.escapeHtml(tag.name)} (${tag.count})</span>`;
      }).join('');
      
      container.querySelectorAll('.tag-cloud-item').forEach(item => {
        item.addEventListener('click', () => {
          onSelect(item.dataset.tag);
        });
      });
    });
  },
  
  parseTags(input) {
    if (!input) return [];
    return input
      .split(/[,，\s]+/)
      .map(t => t.trim().replace(/^#/, ''))
      .filter(t => t.length > 0);
  },
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  /**
   * 初始化标签 Chip 输入系统
   * @param {string} inputId - 输入框 ID
   * @param {string} wrapperId - 包裹容器 ID
   */
  initTagChipInput(inputId = 'create-tags', wrapperId = 'tag-input-wrapper') {
    const input = document.getElementById(inputId);
    const wrapper = document.getElementById(wrapperId);
    
    if (!input || !wrapper) return;
    
    this.currentTags = [];
    
    // 点击 wrapper 聚焦输入框
    wrapper.addEventListener('click', (e) => {
      if (e.target === wrapper || e.target.classList.contains('chip-remove')) return;
      input.focus();
    });
    
    // 输入框事件
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        this._addTagFromInput(input);
      }
      if (e.key === 'Backspace' && input.value === '' && this.currentTags.length > 0) {
        // 退格键删除最后一个标签
        this.removeTag(this.currentTags[this.currentTags.length - 1]);
        this._renderChips(wrapper, input);
      }
    });
    
    // 逗号/中文逗号分隔（input 事件处理粘贴等情况）
    input.addEventListener('input', (e) => {
      const val = input.value;
      if (/[，,]/.test(val)) {
        this._addTagFromInput(input);
      }
    });
    
    // 显示标签建议
    input.addEventListener('input', () => {
      this._showTagSuggestions(input.value.trim());
    });
    
    input.addEventListener('blur', () => {
      setTimeout(() => {
        const suggestions = document.getElementById('tag-suggestions');
        if (suggestions) suggestions.classList.remove('show');
      }, 200);
    });
  },
  
  /**
   * 从输入框添加标签
   */
  _addTagFromInput(input) {
    const raw = input.value;
    const tags = this.parseTags(raw);
    
    if (tags.length === 0) return;
    
    let addedAny = false;
    tags.forEach(tag => {
      if (this.addTag(tag)) {
        addedAny = true;
      }
    });
    
    input.value = '';
    
    // 重新渲染 chips
    const wrapper = document.getElementById('tag-input-wrapper');
    if (wrapper) {
      this._renderChips(wrapper, input);
    }
  },
  
  /**
   * 添加标签（防重复）
   * @returns {boolean} 是否成功添加
   */
  addTag(tag) {
    tag = tag.trim().replace(/^#/, '');
    if (!tag || this.currentTags.includes(tag)) return false;
    
    this.currentTags.push(tag);
    return true;
  },
  
  /**
   * 移除标签
   */
  removeTag(tag) {
    this.currentTags = this.currentTags.filter(t => t !== tag);
  },
  
  /**
   * 渲染标签 Chips
   */
  _renderChips(wrapper, input) {
    // 清除旧 chips（保留 input 和 suggestions）
    wrapper.querySelectorAll('.tag-chip').forEach(c => c.remove());
    
    // 在 input 前面插入 chips
    this.currentTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        <span class="chip-text">${this.escapeHtml(tag)}</span>
        <button type="button" class="chip-remove" data-tag="${this.escapeHtml(tag)}">×</button>
      `;
      wrapper.insertBefore(chip, input);
      
      // 点击删除按钮
      chip.querySelector('.chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTag(e.target.dataset.tag);
        this._renderChips(wrapper, input);
      });
    });
  },
  
  /**
   * 显示标签建议
   */
  _showTagSuggestions(query) {
    const suggestionsEl = document.getElementById('tag-suggestions');
    if (!suggestionsEl) return;
    
    if (!query) {
      suggestionsEl.classList.remove('show');
      return;
    }
    
    this.getAllTags().then(tags => {
      const matched = tags.filter(t => 
        t.name.toLowerCase().includes(query.toLowerCase()) && 
        !this.currentTags.includes(t.name)
      ).slice(0, 5);
      
      if (matched.length === 0) {
        suggestionsEl.classList.remove('show');
        return;
      }
      
      suggestionsEl.innerHTML = matched.map(tag => `
        <div class="tag-suggestion-item" data-tag="${this.escapeHtml(tag.name)}">
          ${this.escapeHtml(tag.name)}
          <span class="tag-count">${tag.count}</span>
        </div>
      `).join('');
      
      suggestionsEl.classList.add('show');
      
      suggestionsEl.querySelectorAll('.tag-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          this.addTag(item.dataset.tag);
          const wrapper = document.getElementById('tag-input-wrapper');
          const input = document.getElementById('create-tags');
          if (wrapper && input) {
            input.value = '';
            this._renderChips(wrapper, input);
          }
          suggestionsEl.classList.remove('show');
        });
      });
    });
  },
  
  /**
   * 获取当前选中的标签数组
   */
  getSelectedTags() {
    return [...this.currentTags];
  },
  
  /**
   * 设置标签（用于编辑模式）
   */
  setTags(tags) {
    this.currentTags = [...tags];
    const wrapper = document.getElementById('tag-input-wrapper');
    const input = document.getElementById('create-tags');
    if (wrapper && input) {
      input.value = '';
      this._renderChips(wrapper, input);
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
      this.renderCategoryFilter();
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
    const exportBtn = document.getElementById('settings-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportData();
      });
    }
    
    const importBtn = document.getElementById('settings-import');
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
        this.closeModal('category-modal');
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
    
    const uploadBtn = document.getElementById('settings-cloud-upload');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.cloudUpload();
      });
    }
    
    const downloadBtn = document.getElementById('settings-cloud-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this.cloudDownload();
      });
    }
    
    const syncBtn = document.getElementById('settings-cloud-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.cloudSyncBidirectional();
      });
    }
    
    const saveBtn = document.getElementById('cloud-modal-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveCloudConfig();
      });
    }
    
    const testBtn = document.getElementById('cloud-modal-test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.testCloudConnection();
      });
    }
    
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
    
    const closeBtn = document.getElementById('cloud-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
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
      this.populateCategorySelect();
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
  
  populateCategorySelect() {
    const select = document.getElementById('create-category');
    if (!select) return;
    
    const categories = [...new Set(this.items.map(item => item.category).filter(Boolean))];
    const currentValue = select.value;
    
    select.innerHTML = `
      <option value="">选择分类</option>
      ${categories.map(cat => `<option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>`).join('')}
    `;
    
    if (currentValue) select.value = currentValue;
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
      const matchCategory = !this.currentCategory || item.category === this.currentCategory;
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
          <p class="item-notes">${this.escapeHtml(item.notes || '')}</p>
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
          <p class="item-notes">${this.escapeHtml(item.notes || '')}</p>
          <div class="item-meta">
            <span class="item-date">${item.createdAt}</span>
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
            <div class="detail-notes">${this.escapeHtml(item.notes)}</div>
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
    if (categoryEl) categoryEl.value = '';
    
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
    
    if (nameInput) nameInput.value = item.name || '';
    if (categoryInput) categoryInput.value = item.category || '';
    if (notesInput) notesInput.value = item.notes || '';
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
    const notesEl = document.getElementById('create-notes');
    const statusEl = document.getElementById('create-status');
    const dateEl = document.getElementById('create-date');
    
    const name = nameEl ? nameEl.value.trim() : '';
    const category = categoryEl ? categoryEl.value.trim() : '';
    const notes = notesEl ? notesEl.value.trim() : '';
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
        item.name = name;
        item.category = category;
        item.notes = notes;
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
        name,
        category,
        notes,
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
    this.renderCategoryFilter();
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
        this.renderCategoryFilter();
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
      
      const localItems = await StorageBackend.getAll();
      const result = await CloudSync.syncBidirectional(localItems, password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        await StorageBackend.save(result.items);
        await this.loadItems();
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
  
  // ==================== 分类管理 ====================
  
  openCategoryManager() {
    const modal = document.getElementById('category-manager-modal');
    if (modal) {
      modal.style.display = 'flex';
      this.renderCategoryList();
    }
  },
  
  renderCategoryList() {
    const listEl = document.getElementById('category-list');
    if (!listEl) return;
    
    const customCats = JSON.parse(localStorage.getItem('universal_journal_categories') || '[]');
    const usedCats = [...new Set(this.items.map(i => i.category).filter(Boolean))];
    const allCats = [...new Set([...customCats, ...usedCats])];
    
    if (allCats.length === 0) {
      listEl.innerHTML = '<p class="empty-hint">暂无分类</p>';
      return;
    }
    
    listEl.innerHTML = `
      <div class="category-manager-header">
        <button class="btn-sm btn-primary" id="btn-add-category">+ 新增分类</button>
      </div>
      <div class="category-manager-list">
        ${allCats.map(cat => `
          <div class="category-manager-item">
            <span class="category-name">${this.escapeHtml(cat)}</span>
            <button class="btn-sm btn-danger-outline" data-action="delete-category" data-name="${this.escapeHtml(cat)}">删除</button>
          </div>
        `).join('')}
      </div>
    `;
    
    // 绑定新增按钮
    document.getElementById('btn-add-category')?.addEventListener('click', () => {
      this.closeModal('category-manager-modal');
      document.getElementById('category-modal').style.display = 'flex';
    });
    
    // 绑定删除按钮 (事件委托)
    listEl.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-action="delete-category"]');
      if (delBtn) {
        const name = delBtn.dataset.name;
        if (confirm(`确定删除分类"${name}"吗？已使用该分类的记录将保留，但分类标签会被移除。`)) {
          this.deleteCategory(name);
        }
      }
    });
  },
  
  saveCategory() {
    const input = document.getElementById('category-name-input');
    if (!input) return;
    
    const name = input.value.trim();
    if (!name) {
      this.showToast('请输入分类名称');
      return;
    }
    
    const customCats = JSON.parse(localStorage.getItem('universal_journal_categories') || '[]');
    if (customCats.includes(name)) {
      this.showToast('分类已存在');
      return;
    }
    
    customCats.push(name);
    localStorage.setItem('universal_journal_categories', JSON.stringify(customCats));
    
    input.value = '';
    this.closeModal('category-modal');
    this.showToast('分类已添加');
    
    // 刷新列表如果管理器是打开的
    if (document.getElementById('category-manager-modal').style.display === 'flex') {
      this.renderCategoryList();
    }
    
    // 刷新表单下拉框和筛选器
    this.populateCategorySelect();
    this.renderCategoryFilter();
  },
  
  deleteCategory(name) {
    const customCats = JSON.parse(localStorage.getItem('universal_journal_categories') || '[]');
    const filtered = customCats.filter(c => c !== name);
    localStorage.setItem('universal_journal_categories', JSON.stringify(filtered));
    
    // 更新所有使用该分类的记录，将其分类置空或改为"未分类"
    // 这里简单处理：不修改记录，只移除自定义分类列表。
    // 记录上的分类依然存在，只是不再是"预定义"的。
    
    this.renderCategoryList();
    this.populateCategorySelect();
    this.renderCategoryFilter();
    this.showToast('分类已删除');
  }
};

// ===================================
// 启动应用
// ===================================

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// 导出到全局
window.App = App;
window.ThemeManager = ThemeManager;
window.StorageBackend = StorageBackend;
window.Security = Security;
window.Crypto = Crypto;
window.TagManager = TagManager;
window.ImageProcessor = ImageProcessor;
window.IDBModule = IDBModule;
window.TrashManager = TrashManager;
window.DraftManager = DraftManager;
window.BatchManager = BatchManager;
window.CalendarView = CalendarView;
window.TemplateManager = TemplateManager;
window.TemplateManager = TemplateManager;
