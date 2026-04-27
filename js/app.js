/**
 * 万物手札 H5 - 主应用逻辑 (优化版)
 * 使用 localStorage 存储数据，支持密码加密保护
 */

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
// 数据存储
// ===================================

const Storage = {
  KEY: 'universal_journal_items',
  
  getAll() {
    const data = localStorage.getItem(this.KEY);
    if (window.__cachedItems) {
      return window.__cachedItems;
    }
    const items = data ? JSON.parse(data) : [];
    
    // 数据迁移：确保老数据兼容
    items.forEach(item => {
      // 老数据只有 category 字段，新数据有 mainCategory 和 category
      if (!item.mainCategory && item.category) {
        item.mainCategory = item.category;
      }
      if (!item.category && item.mainCategory) {
        item.category = item.mainCategory;
      }
      // 确保必填字段存在
      item.isFavorite = item.isFavorite || false;
      item.photos = item.photos || [];
      item.status = item.status || 'in-use';
    });
    
    return items;
  },
  
  save(items) {
    if (window.__isDecrypted) {
      window.__cachedItems = items;
      return;
    }
    localStorage.setItem(this.KEY, JSON.stringify(items));
  },
  
  add(item) {
    const items = this.getAll();
    item._id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    item.createdAt = new Date().toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    item.isFavorite = item.isFavorite || false;
    item.photos = item.photos || []; // 照片数组
    items.unshift(item);
    this.save(items);
    return item;
  },
  
  update(id, updates) {
    const items = this.getAll();
    const index = items.findIndex(item => item._id === id);
    if (index === -1) return null;
    
    // 保留原有 photos 如果没有新的
    if (!updates.photos && items[index].photos) {
      updates.photos = items[index].photos;
    }
    items[index] = { ...items[index], ...updates };
    this.save(items);
    return items[index];
  },
  
  delete(id) {
    const items = this.getAll();
    const filtered = items.filter(item => item._id !== id);
    this.save(filtered);
  },
  
  get(id) {
    const items = this.getAll();
    return items.find(item => item._id === id);
  },
  
  getFavorites() {
    const items = this.getAll();
    return items.filter(item => item.isFavorite);
  },
  
  toggleFavorite(id) {
    const items = this.getAll();
    const item = items.find(item => item._id === id);
    if (item) {
      item.isFavorite = !item.isFavorite;
      this.save(items);
      return item.isFavorite;
    }
    return false;
  },
  
  count() {
    return this.getAll().length;
  },
  
  exportJSON() {
    const items = this.getAll();
    return JSON.stringify({
      version: '1.0',
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
      const existingIds = new Set(existing.map(item => item._id));
      
      let imported = 0;
      let skipped = 0;
      
      data.items.forEach(item => {
        if (existingIds.has(item._id)) {
          skipped++;
        } else {
          item.isFavorite = item.isFavorite || false;
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
      return { success: false, message: 'JSON 解析失败：' + e.message };
    }
  }
};

// ===================================
// 主题管理
// ===================================

const ThemeManager = {
  KEY: 'universal_journal_theme',
  
  themes: [
    { id: 'void', name: '无界原白', color: '#1a1a1a' },
    { id: 'grid', name: '模数框架', color: '#0071e3' },
    { id: 'ink', name: '单色墨影', color: '#2c2c2c' },
    { id: 'warm', name: '暖光纸本', color: '#8b7355' },
    { id: 'dark', name: '深空墨色', color: '#0a84ff' }
  ],
  
  init() {
    const saved = localStorage.getItem(this.KEY);
    const theme = saved || 'void';
    this.apply(theme);
    this.bindEvents();
  },
  
  apply(themeId) {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem(this.KEY, themeId);
    this.updatePanel(themeId);
    document.getElementById('current-theme-name').textContent = 
      this.themes.find(t => t.id === themeId)?.name || '无界原白';
  },
  
  bindEvents() {
    const toggle = document.getElementById('theme-toggle');
    const panel = document.getElementById('theme-panel');
    
    if (toggle && panel) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('show');
      });
      
      document.addEventListener('click', () => {
        panel.classList.remove('show');
      });
    }
  },
  
  updatePanel(activeTheme) {
    document.querySelectorAll('.theme-option').forEach(option => {
      const isActive = option.dataset.theme === activeTheme;
      option.classList.toggle('active', isActive);
    });
  },
  
  renderOptions() {
    const container = document.getElementById('theme-options');
    if (!container) return;
    
    const saved = localStorage.getItem(this.KEY) || 'void';
    
    let html = '';
    this.themes.forEach(theme => {
      html += `
        <div class="theme-option" data-theme="${theme.id}">
          <div class="theme-color" style="background: ${theme.color}"></div>
          <span class="theme-name">${theme.name}</span>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    container.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', (e) => {
        const themeId = e.currentTarget.dataset.theme;
        this.apply(themeId);
        const panel = document.getElementById('theme-panel');
        if (panel) panel.classList.remove('show');
      });
    });
  }
};

// ===================================
// 密码管理 UI
// ===================================

const PasswordUI = {
  currentAction: null,
  currentCallback: null,
  
  showModal(title, hint, placeholder, callback) {
    this.currentCallback = callback;
    
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-hint').textContent = hint || '';
    document.getElementById('modal-hint').className = 'modal-hint';
    document.getElementById('modal-password').placeholder = placeholder || '请输入密码';
    document.getElementById('modal-password').value = '';
    document.getElementById('password-modal').style.display = 'flex';
    
    setTimeout(() => {
      document.getElementById('modal-password').focus();
    }, 100);
  },
  
  hideModal() {
    document.getElementById('password-modal').style.display = 'none';
    this.currentCallback = null;
  },
  
  showError(message) {
    const hint = document.getElementById('modal-hint');
    hint.textContent = message;
    hint.className = 'modal-hint error';
  },
  
  showLockScreen() {
    document.getElementById('lock-password').value = '';
    document.getElementById('lock-hint').textContent = '';
    document.getElementById('lock-hint').className = 'lock-hint';
    document.getElementById('lock-overlay').style.display = 'flex';
    
    setTimeout(() => {
      document.getElementById('lock-password').focus();
    }, 100);
  },
  
  hideLockScreen() {
    document.getElementById('lock-overlay').style.display = 'none';
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
  
  init() {
    ThemeManager.init();
    ThemeManager.renderOptions();
    this.bindEvents();
    this.bindPasswordEvents();
    this.bindSettingsEvents();
    
    if (Security.isLocked()) {
      PasswordUI.showLockScreen();
    } else {
      this.loadItems();
      this.renderCategoryFilter();
      this.renderItems();
    }
    
    console.log('📦 万物手札 H5 已启动');
  },
  
  bindEvents() {
    // TabBar 切换
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const page = e.currentTarget.closest('.tab-item').dataset.page;
        this.switchPage(page);
      });
    });
    
    // FAB 添加按钮
    document.getElementById('fab-add').addEventListener('click', () => {
      this.editingId = null;
      this.resetForm();
      this.switchPage('create');
    });
    
    // 空状态添加按钮
    document.getElementById('empty-add-btn')?.addEventListener('click', () => {
      this.editingId = null;
      this.resetForm();
      this.switchPage('create');
    });
    
    // 搜索
    document.getElementById('search-btn')?.addEventListener('click', () => {
      this.searchKey = document.getElementById('search-input').value.trim();
      this.filterItems();
      this.renderItems();
    });
    
    document.getElementById('search-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchKey = e.target.value.trim();
        this.filterItems();
        this.renderItems();
      }
    });
    
    // 分类筛选
    document.getElementById('category-filter')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('category-item')) {
        document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentCategory = e.target.dataset.category;
        this.filterItems();
        this.renderItems();
      }
    });
    
    // 返回按钮
    document.getElementById('detail-back-btn')?.addEventListener('click', () => {
      this.switchPage('home');
    });
    
    document.getElementById('stats-back-btn')?.addEventListener('click', () => {
      this.switchPage('profile');
    });
    
    // 创建页按钮
    document.getElementById('create-cancel-btn')?.addEventListener('click', () => {
      this.editingId = null;
      this.resetForm();
      this.switchPage('home');
    });
    
    document.getElementById('create-save-btn')?.addEventListener('click', () => {
      this.submitForm();
    });
    
    // 富文本工具栏
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const command = e.currentTarget.dataset.command;
        document.execCommand(command, false, null);
        document.getElementById('create-rich-content').focus();
      });
    });
    
    // 照片上传
    this.currentPhotos = [];
    document.getElementById('create-photo-btn')?.addEventListener('click', () => {
      document.getElementById('create-photo-input').click();
    });
    
    document.getElementById('create-photo-input')?.addEventListener('change', (e) => {
      this.handlePhotoUpload(e);
    });
    
    // 详情收藏按钮
    document.getElementById('detail-favorite-btn')?.addEventListener('click', () => {
      if (this.currentDetailId) {
        const isFav = Storage.toggleFavorite(this.currentDetailId);
        this.updateFavoriteButton(isFav);
        this.showToast(isFav ? '已收藏' : '已取消收藏');
      }
    });
    
    // 详情编辑按钮
    document.getElementById('detail-edit-btn')?.addEventListener('click', () => {
      if (this.currentDetailId) {
        this.editItem(this.currentDetailId);
      }
    });
    
    // 收藏页筛选
    document.getElementById('favorites-category-filter')?.addEventListener('change', () => {
      this.renderFavorites();
    });
  },
  
  bindSettingsEvents() {
    // 导出数据
    document.getElementById('settings-export')?.addEventListener('click', () => {
      this.exportData();
    });
    
    // 导入数据
    document.getElementById('settings-import')?.addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
    
    document.getElementById('import-file-input')?.addEventListener('change', (e) => {
      this.importData(e);
    });
    
    // 清空数据
    document.getElementById('settings-clear')?.addEventListener('click', () => {
      if (confirm('⚠️ 确定要删除所有数据吗？此操作不可恢复！')) {
        if (confirm('再次确认：真的要清空所有物品数据吗？')) {
          localStorage.removeItem('universal_journal_items');
          localStorage.removeItem(Security.DATA_KEY);
          this.items = [];
          this.filteredItems = [];
          this.renderItems();
          this.renderFavorites();
          this.showToast('数据已清空');
        }
      }
    });
    
    // 密码保护
    document.getElementById('settings-lock')?.addEventListener('click', () => {
      this.togglePasswordLock();
    });
    
    // 主题
    document.getElementById('settings-theme')?.addEventListener('click', () => {
      document.getElementById('theme-toggle').click();
    });
    
    // 统计
    document.getElementById('settings-stats')?.addEventListener('click', () => {
      this.loadStats();
      this.switchPage('stats');
    });
    
    // 关于
    document.getElementById('settings-about')?.addEventListener('click', () => {
      this.showAbout();
    });
  },
  
  bindPasswordEvents() {
    document.getElementById('modal-confirm-btn')?.addEventListener('click', () => {
      const password = document.getElementById('modal-password').value;
      if (!password) {
        PasswordUI.showError('请输入密码');
        return;
      }
      
      if (this.currentCallback) {
        this.currentCallback(password);
      }
    });
    
    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
      PasswordUI.hideModal();
    });
    
    document.getElementById('modal-password')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('modal-confirm-btn').click();
      }
    });
    
    document.getElementById('lock-unlock-btn')?.addEventListener('click', () => {
      const password = document.getElementById('lock-password').value;
      if (!password) {
        document.getElementById('lock-hint').textContent = '请输入密码';
        document.getElementById('lock-hint').className = 'lock-hint error';
        return;
      }
      
      if (Security.verifyPassword(password)) {
        window.__isDecrypted = true;
        window.__cachedItems = Security.decryptData(password);
        PasswordUI.hideLockScreen();
        this.loadItems();
        this.renderCategoryFilter();
        this.renderItems();
        this.showToast('已解锁');
      } else {
        document.getElementById('lock-hint').textContent = '密码错误，请重试';
        document.getElementById('lock-hint').className = 'lock-hint error';
      }
    });
    
    document.getElementById('lock-password')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('lock-unlock-btn').click();
      }
    });
  },
  
  // 页面切换
  switchPage(page) {
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.page === page);
    });
    
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    const fab = document.getElementById('fab-add');
    fab.style.display = (page === 'home') ? 'flex' : 'none';
    
    this.currentPage = page;
    
    if (page === 'stats') {
      this.loadStats();
    }
    
    if (page === 'favorites') {
      this.renderFavorites();
    }
    
    document.querySelector('.main-content').scrollTop = 0;
  },
  
  // 加载物品
  loadItems() {
    this.items = Storage.getAll();
    this.filterItems();
  },
  
  filterItems() {
    this.filteredItems = this.items.filter(item => {
      const matchCategory = !this.currentCategory || item.mainCategory === this.currentCategory;
      const matchSearch = !this.searchKey || 
        item.name.toLowerCase().includes(this.searchKey.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(this.searchKey.toLowerCase()));
      return matchCategory && matchSearch;
    });
  },
  
  renderCategoryFilter() {
    const container = document.getElementById('category-filter');
    const categories = [...new Set(this.items.map(item => item.mainCategory))];
    
    let html = '<button class="category-item active" data-category="">全部</button>';
    categories.forEach(cat => {
      if (cat && cat !== '全部') {
        html += `<button class="category-item" data-category="${cat}">${cat}</button>`;
      }
    });
    
    container.innerHTML = html;
    
    // 更新收藏页筛选
    const favFilter = document.getElementById('favorites-category-filter');
    if (favFilter) {
      let favHtml = '<option value="">全部品类</option>';
      categories.forEach(cat => {
        if (cat) {
          favHtml += `<option value="${cat}">${cat}</option>`;
        }
      });
      favFilter.innerHTML = favHtml;
    }
  },
  
  renderItems() {
    const container = document.getElementById('items-list');
    const emptyState = document.getElementById('empty-state');
    
    if (this.filteredItems.length === 0) {
      container.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    container.style.display = 'flex';
    emptyState.style.display = 'none';
    
    let html = '';
    this.filteredItems.forEach(item => {
      const favIcon = item.isFavorite ? '⭐' : '';
      html += `
        <div class="item-card" data-id="${item._id}">
          <div class="item-card-content">
            <div class="item-content-left">
              <div class="item-meta">${item.createdAt}</div>
              <div class="item-name">${item.name} ${favIcon}</div>
              <div class="item-desc">${item.notes || '暂无备注'}</div>
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    container.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showDetail(card.dataset.id);
      });
    });
  },
  
  // 渲染收藏页
  renderFavorites() {
    const favorites = Storage.getFavorites();
    const container = document.getElementById('favorites-grid');
    const emptyState = document.getElementById('favorites-empty');
    const categoryFilter = document.getElementById('favorites-category-filter')?.value;
    
    const filtered = categoryFilter 
      ? favorites.filter(item => item.mainCategory === categoryFilter)
      : favorites;
    
    if (filtered.length === 0) {
      container.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }
    
    container.style.display = 'grid';
    emptyState.style.display = 'none';
    
    let html = '';
    filtered.forEach(item => {
      const icon = this.getCategoryIcon(item.mainCategory);
      html += `
        <div class="favorite-card" data-id="${item._id}">
          <div class="favorite-icon">${icon}</div>
          <div class="favorite-name">${item.name}</div>
          <div class="favorite-date">${item.createdAt}</div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    container.querySelectorAll('.favorite-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showDetail(card.dataset.id);
      });
    });
  },
  
  getCategoryIcon(category) {
    const icons = {
      '植物': '🌿',
      '书籍': '📚',
      '数码': '💻',
      '宠物': '🐱',
      '手办': '🎭',
      '光影': '💡',
      '其他': '📦'
    };
    return icons[category] || '📦';
  },
  
  // 显示详情
  showDetail(id) {
    const item = Storage.get(id);
    if (!item) return;
    
    this.currentDetailId = id;
    const isFav = item.isFavorite || false;
    this.updateFavoriteButton(isFav);
    
    const container = document.getElementById('detail-container');
    
    // 渲染照片
    let photosHtml = '';
    if (item.photos && item.photos.length > 0) {
      photosHtml = '<div class="detail-photos">';
      item.photos.forEach((photo, index) => {
        photosHtml += `
          <div class="detail-photo-item" data-index="${index}">
            <img src="${photo}" alt="Photo ${index}" />
          </div>
        `;
      });
      photosHtml += '</div>';
    }
    
    container.innerHTML = `
      <div class="detail-content">
        <div class="detail-header">
          <div class="detail-title">${item.name}</div>
          <div class="detail-status">${item.status || '在役'}</div>
        </div>
        <div class="detail-meta">
          <div class="detail-meta-item">📂 品类：${item.mainCategory}</div>
          ${item.date ? `<div class="detail-meta-item">📅 日期：${item.date}</div>` : ''}
          <div class="detail-meta-item">📅 录入时间：${item.createdAt}</div>
          <div class="detail-meta-item">⭐ 收藏：${isFav ? '已收藏' : '未收藏'}</div>
        </div>
        ${photosHtml}
        <div class="detail-desc">${item.notes || '暂无备注'}</div>
      </div>
    `;
    
    // 绑定照片点击事件（全屏查看）
    container.querySelectorAll('.detail-photo-item').forEach(photoItem => {
      photoItem.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.showPhotoViewer(item.photos[index]);
      });
    });
    
    this.switchPage('detail');
  },
  
  // 照片全屏查看
  showPhotoViewer(photoSrc) {
    const viewer = document.createElement('div');
    viewer.className = 'photo-viewer';
    viewer.innerHTML = `
      <div class="photo-viewer-overlay"></div>
      <div class="photo-viewer-content">
        <img src="${photoSrc}" alt="Full size photo" />
        <button class="photo-viewer-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(viewer);
    
    // 绑定关闭事件
    const close = () => {
      viewer.remove();
    };
    
    viewer.querySelector('.photo-viewer-close').addEventListener('click', close);
    viewer.querySelector('.photo-viewer-overlay').addEventListener('click', close);
  },
  
  updateFavoriteButton(isFav) {
    const btn = document.getElementById('detail-favorite-btn');
    if (btn) {
      btn.style.color = isFav ? '#ffd700' : 'var(--text-muted)';
      btn.querySelector('svg').style.fill = isFav ? '#ffd700' : 'none';
    }
  },
  
  // 提交表单
  submitForm() {
    const name = document.getElementById('create-name').value.trim();
    if (!name) {
      this.showToast('请填写名称');
      return;
    }
    
    const category = document.getElementById('create-category').value.trim();
    const status = document.getElementById('create-status').value;
    const notes = document.getElementById('create-notes').value.trim();
    const richContent = document.getElementById('create-rich-content').innerHTML;
    const dateInput = document.getElementById('create-date');
    const date = dateInput ? dateInput.value : null;
    
    const itemData = {
      name,
      mainCategory: category || '其他',
      category: category || '其他', // 兼容老数据
      status,
      notes: notes || richContent,
      date: date || null,
      photos: this.currentPhotos || []
    };
    
    if (this.editingId) {
      // 编辑时保留 isFavorite 和 createdAt
      const existing = Storage.get(this.editingId);
      if (existing) {
        itemData.isFavorite = existing.isFavorite;
        itemData.createdAt = existing.createdAt;
      }
      Storage.update(this.editingId, itemData);
      this.showToast('保存成功');
    } else {
      itemData.isFavorite = false;
      Storage.add(itemData);
      this.showToast('创建成功');
    }
    
    this.editingId = null;
    this.loadItems();
    this.renderCategoryFilter();
    this.renderItems();
    
    setTimeout(() => {
      this.switchPage('home');
    }, 1000);
  },
  
  resetForm() {
    document.getElementById('create-name').value = '';
    document.getElementById('create-category').value = '';
    document.getElementById('create-status').value = 'in-use';
    document.getElementById('create-notes').value = '';
    document.getElementById('create-rich-content').innerHTML = '';
    const dateInput = document.getElementById('create-date');
    if (dateInput) dateInput.value = '';
    document.getElementById('create-title').textContent = '新建记录';
    this.currentPhotos = [];
    this.renderPhotoPreview();
  },
  
  editItem(id) {
    const item = Storage.get(id);
    if (!item) return;
    
    this.editingId = id;
    
    // 填充表单
    document.getElementById('create-name').value = item.name || '';
    document.getElementById('create-category').value = item.category || item.mainCategory || '';
    document.getElementById('create-status').value = item.status || 'in-use';
    document.getElementById('create-notes').value = item.notes || '';
    
    // 填充日期（如果有）
    const dateInput = document.getElementById('create-date');
    if (dateInput && item.date) {
      dateInput.value = item.date;
    }
    
    // 加载照片
    this.currentPhotos = item.photos || [];
    this.renderPhotoPreview();
    
    // 更新标题
    document.getElementById('create-title').textContent = '编辑记录';
    
    // 切换到创建页面
    this.switchPage('create');
  },
  
  // 照片上传处理
  handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        this.currentPhotos.push(base64);
        this.renderPhotoPreview();
      };
      reader.readAsDataURL(file);
    });
    
    // 清空 input 以允许重复选择同一文件
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
    });
    html += '</div>';
    
    preview.innerHTML = html;
    
    // 绑定删除事件
    preview.querySelectorAll('.photo-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.currentPhotos.splice(index, 1);
        this.renderPhotoPreview();
      });
    });
  },
  
  // 统计页面
  loadStats() {
    const items = Storage.getAll();
    const favorites = Storage.getFavorites();
    const total = items.length;
    
    const categoryCount = {};
    items.forEach(item => {
      categoryCount[item.mainCategory] = (categoryCount[item.mainCategory] || 0) + 1;
    });
    
    const categories = Object.entries(categoryCount).map(([name, value]) => ({ name, value }));
    
    const statusCount = {};
    items.forEach(item => {
      statusCount[item.status || '在役'] = (statusCount[item.status || '在役'] || 0) + 1;
    });
    
    const statuses = Object.entries(statusCount).map(([name, value]) => ({ name, value }));
    
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-categories').textContent = Object.keys(categoryCount).length;
    document.getElementById('stat-favorites').textContent = favorites.length;
    document.getElementById('stat-active').textContent = statusCount['在役'] || 0;
    
    this.renderCharts(categories, statuses);
  },
  
  renderCharts(categories, statuses) {
    const categoryChart = echarts.init(document.getElementById('category-chart'));
    const statusChart = echarts.init(document.getElementById('status-chart'));
    
    categoryChart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: categories,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    });
    
    statusChart.setOption({
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: statuses
      }]
    });
  },
  
  // 导出功能
  exportData() {
    const json = Storage.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `万物手札备份_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showToast('导出成功');
  },
  
  // 导入功能
  importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = Storage.importJSON(event.target.result);
      
      if (result.success) {
        this.showToast(result.message);
        this.loadItems();
        this.renderCategoryFilter();
        this.renderItems();
        this.renderFavorites();
      } else {
        this.showToast(result.message);
      }
    };
    reader.readAsText(file);
    
    e.target.value = '';
  },
  
  // 密码保护
  togglePasswordLock() {
    const hasPassword = Security.hasPassword();
    
    if (!hasPassword) {
      PasswordUI.showModal('🔒 设置密码', '设置后数据将被加密存储', '输入 4-20 位密码', (password) => {
        if (password.length < 4) {
          PasswordUI.showError('密码至少 4 位');
          return;
        }
        if (password.length > 20) {
          PasswordUI.showError('密码最多 20 位');
          return;
        }
        
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
    } else {
      if (Security.isLocked()) {
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
        PasswordUI.showModal('🔒 开启保护', '开启后数据将被加密', '输入密码', (password) => {
          if (Security.verifyPassword(password)) {
            localStorage.setItem(Security.LOCK_KEY, 'true');
            PasswordUI.hideModal();
            this.showToast('保护已开启');
          } else {
            PasswordUI.showError('密码错误');
          }
        });
      }
    }
  },
  
  // 关于页面
  showAbout() {
    alert('万物手札 v1.0.0\n\n记录世间万物，收藏生活点滴\n\n设计哲学：无界原白 × 极简主义');
  },
  
  // Toast 提示
  showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }
};

// ===================================
// 启动应用
// ===================================

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
