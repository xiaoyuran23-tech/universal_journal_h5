锘?**
 * 娑撳洨澧块幍瀣贡 H5 - 娑撹绨查悽銊┾偓鏄忕帆 (娴兼ê瀵查悧?
 * 娴ｈ法鏁?localStorage 鐎涙ê鍋嶉弫鐗堝祦閿涘本鏁幐浣哥槕閻礁濮炵€靛棔绻氶幎?
 */

// ===================================
// 閸旂姴鐦戝銉ュ徔
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
// 鐎瑰鍙忓Ο鈥虫健
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
// 閺佺増宓佺€涙ê鍋?
// ===================================

const Storage = {
  KEY: 'universal_journal_items',
  
  getAll() {
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
    item.photos = item.photos || []; // 閻撗呭閺佹壆绮?
    items.unshift(item);
    this.save(items);
    return item;
  },
  
  update(id, updates) {
    const items = this.getAll();
    const index = items.findIndex(item => item._id === id);
    if (index === -1) return null;
    
    // 娣囨繄鏆€閸樼喐婀?photos 婵″倹鐏夊▽鈩冩箒閺傛壆娈?
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
        return { success: false, message: '鏃犳晥鐨勬暟鎹牸寮? };
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
        message: `鐎电厧鍙嗛幋鎰閿涙碍鏌婃晶?${imported} 閺夆槄绱濈捄瀹犵箖 ${skipped} 閺夛繝鍣告径宄?
        imported,
        skipped
      };
    } catch (e) {
      return { success: false, message: 'JSON 鐟欙絾鐎芥径杈Е閿? + e.message };
    }
  }
};

// ===================================
// 娑撳顣界粻锛勬倞
// ===================================

const ThemeManager = {
  KEY: 'universal_journal_theme',
  
  themes: [
    { id: 'void', name: '閺冪姷鏅崢鐔烘', color: '#1a1a1a' },
    { id: 'grid', name: '濡剝鏆熷鍡樼仸', color: '#0071e3' },
    { id: 'ink', name: '閸楁洝澹婃晶銊ュ', color: '#2c2c2c' },
    { id: 'warm', name: '閺嗘牕鍘滅痪鍛婃拱', color: '#8b7355' },
    { id: 'dark', name: '濞ｈ京鈹栨晶銊ㄥ', color: '#0a84ff' }
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
      this.themes.find(t => t.id === themeId)?.name || '閺冪姷鏅崢鐔烘';
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
        panel.classList.remove('show');
      });
    });
  }
};

// ===================================
// 鐎靛棛鐖滅粻锛勬倞 UI
// ===================================

const PasswordUI = {
  currentAction: null,
  currentCallback: null,
  
  showModal(title, hint, placeholder, callback) {
    this.currentCallback = callback;
    
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-hint').textContent = hint || '';
    document.getElementById('modal-hint').className = 'modal-hint';
    document.getElementById('modal-password').placeholder = placeholder || '鐠囩柉绶崗銉ョ槕閻?;
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
// 鎼存梻鏁ゆ稉濠氣偓鏄忕帆
// ===================================

const App = {
  currentPage: 'home',
  currentCategory: '',
  searchKey: '',
  items: [],
  filteredItems: [],
  editingId: null,
  
  async init() {
    // 閸掓繂顫愰崠?IndexedDB
    if (window.IDB) {
      await IDB.init();
      const migration = await IDB.migrateFromLocalStorage();
      if (migration.migrated > 0) {
        console.log(`棣冩憹 娴?localStorage 鏉╀胶些娴?${migration.migrated} 閺壜ゎ唶瑜版洖鍩?IndexedDB`);
      }
    }
    
    ThemeManager.init();
    ThemeManager.renderOptions();
    this.bindEvents();
    this.bindPasswordEvents();
    this.bindSettingsEvents();
    
    // 閸掓繂顫愰崠鏍ь杻瀵搫濮涢懗?
    if (window.EnhancedFeatures) {
      EnhancedFeatures.init();
    }
    
    CloudSync.loadConfig();
    this.updateCloudStatus();
    
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
    
    console.log('棣冩憹 娑撳洨澧块幍瀣贡 H5 瀹告彃鎯庨崝?);
  },
  
  bindEvents() {
    // TabBar 閸掑洦宕?
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const page = e.currentTarget.closest('.tab-item').dataset.page;
        this.switchPage(page);
      });
    });
    
    // FAB 濞ｈ濮為幐澶愭尦
    document.getElementById('fab-add').addEventListener('click', () => {
      this.editingId = null;
      this.resetForm();
      this.switchPage('create');
    });
    
    // 缁岃櫣濮搁幀浣瑰潑閸旂姵瀵滈柦?
    document.getElementById('empty-add-btn')?.addEventListener('click', () => {
      this.editingId = null;
      this.resetForm();
      this.switchPage('create');
    });
    
    // 閹兼粎鍌?
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
    
    // 閸掑棛琚粵娑⑩偓?
    document.getElementById('category-filter')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('category-item')) {
        document.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentCategory = e.target.dataset.category;
        this.filterItems();
        this.renderItems();
      }
    });
    
    // 鏉╂柨娲栭幐澶愭尦
    document.getElementById('detail-back-btn')?.addEventListener('click', () => {
      this.switchPage('home');
    });
    
    document.getElementById('stats-back-btn')?.addEventListener('click', () => {
      this.switchPage('profile');
    });
    
    // 閸掓稑缂撴い鍨瘻闁?
    document.getElementById('create-cancel-btn')?.addEventListener('click', () => {
      this.switchPage('home');
    });
    
    document.getElementById('create-save-btn')?.addEventListener('click', () => {
      this.submitForm();
    });
    
    // 鐎靛本鏋冮張顒€浼愰崗閿嬬埉
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const command = e.currentTarget.dataset.command;
        document.execCommand(command, false, null);
        document.getElementById('create-rich-content').focus();
      });
    });
    
    // 閻撗呭娑撳﹣绱?
    this.currentPhotos = [];
    document.getElementById('create-photo-btn')?.addEventListener('click', () => {
      document.getElementById('create-photo-input').click();
    });
    
    document.getElementById('create-photo-input')?.addEventListener('change', (e) => {
      this.handlePhotoUpload(e);
    });
    
    // 鐠囷附鍎忛弨鎯版閹稿鎸?
    document.getElementById('detail-favorite-btn')?.addEventListener('click', () => {
      if (this.currentDetailId) {
        const isFav = Storage.toggleFavorite(this.currentDetailId);
        this.updateFavoriteButton(isFav);
        this.showToast(isFav ? '瀹稿弶鏁归挊? : '瀹告彃褰囧☉鍫熸暪閽?);
      }
    });
    
    // 鐠囷附鍎忛崚鍡曢煩閹稿鎸?
    document.getElementById('detail-share-btn')?.addEventListener('click', () => {
      if (this.currentDetailId && window.EnhancedFeatures) {
        const item = Storage.get(this.currentDetailId);
        if (item) {
          EnhancedFeatures.showShare(item);
        }
      }
    });
    
    // 閺€鎯版妞ょ數鐡柅?
    document.getElementById('favorites-category-filter')?.addEventListener('change', () => {
      this.renderFavorites();
    });
  },
  
  bindSettingsEvents() {
    // 鐎电厧鍤弫鐗堝祦
    document.getElementById('settings-export')?.addEventListener('click', () => {
      this.exportData();
    });
    
    // 鐎电厧鍙嗛弫鐗堝祦
    document.getElementById('settings-import')?.addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
    
    document.getElementById('import-file-input')?.addEventListener('change', (e) => {
      this.importData(e);
    });
    
    // 濞撳懐鈹栭弫鐗堝祦
    document.getElementById('settings-clear')?.addEventListener('click', () => {
      if (confirm('閳跨媴绗?绾喖鐣剧憰浣稿灩闂勩倖澧嶉張澶嬫殶閹诡喖鎮ч敍鐔割劃閹垮秳缍旀稉宥呭讲閹垹顦查敍?)) {
        if (confirm('閸愬秵顐肩涵顔款吇閿涙氨婀￠惃鍕洣濞撳懐鈹栭幍鈧張澶屽⒖閸濅焦鏆熼幑顔兼偋閿?)) {
          localStorage.removeItem('universal_journal_items');
          localStorage.removeItem(Security.DATA_KEY);
          this.items = [];
          this.filteredItems = [];
          this.renderItems();
          this.renderFavorites();
          this.showToast('閺佺増宓佸鍙夌缁?);
        }
      }
    });
    
    // 鐎靛棛鐖滄穱婵囧Б
    document.getElementById('settings-lock')?.addEventListener('click', () => {
      this.togglePasswordLock();
    });
    
    // 娑撳顣?
    document.getElementById('settings-theme')?.addEventListener('click', () => {
      document.getElementById('theme-toggle').click();
    });
    
    // 缂佺喕顓?
    document.getElementById('settings-stats')?.addEventListener('click', () => {
      this.loadStats();
      this.switchPage('stats');
    });
    
    // 閸忓厖绨?
    document.getElementById('settings-about')?.addEventListener('click', () => {
      this.showAbout();
    });
    
    // 娴滄垹顏崥灞绢劄
    this.bindCloudEvents();
  },
  
  bindPasswordEvents() {
    document.getElementById('modal-confirm-btn')?.addEventListener('click', () => {
      const password = document.getElementById('modal-password').value;
      if (!password) {
        PasswordUI.showError('鐠囩柉绶崗銉ョ槕閻?);
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
        document.getElementById('lock-hint').textContent = '鐠囩柉绶崗銉ョ槕閻?;
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
        this.showToast('瀹歌尪袙闁?);
      } else {
        document.getElementById('lock-hint').textContent = '鐎靛棛鐖滈柨娆掝嚖閿涘矁顕柌宥堢槸';
        document.getElementById('lock-hint').className = 'lock-hint error';
      }
    });
    
    document.getElementById('lock-password')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('lock-unlock-btn').click();
      }
    });
  },
  
  // 妞ょ敻娼伴崚鍥ㄥ床
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
  
  // 閸旂姾娴囬悧鈺佹惂
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
    
    let html = '<button class="category-item active" data-category="">閸忋劑鍎?/button>';
    categories.forEach(cat => {
      if (cat && cat !== '閸忋劑鍎?) {
        html += `<button class="category-item" data-category="${cat}">${cat}</button>`;
      }
    });
    
    container.innerHTML = html;
    
    // 閺囧瓨鏌婇弨鎯版妞ょ數鐡柅?
    const favFilter = document.getElementById('favorites-category-filter');
    if (favFilter) {
      let favHtml = '<option value="">閸忋劑鍎撮崫浣鸿</option>';
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
      const favIcon = item.isFavorite ? '鐚? : '';
      html += `
        <div class="item-card" data-id="${item._id}">
          <div class="item-card-content">
            <div class="item-content-left">
              <div class="item-meta">${item.createdAt}</div>
              <div class="item-name">${item.name} ${favIcon}</div>
              <div class="item-desc">${item.notes || '閺嗗倹妫ゆ径鍥ㄦ暈'}</div>
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
  
  // 濞撳弶鐓嬮弨鎯版妞?
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
      '濡炲秶澧?: '棣冨岸',
      '娑旓妇鐫?: '棣冩憥',
      '閺佹壆鐖?: '棣冩崌',
      '鐎圭姷澧?: '棣冩儛',
      '閹靛濮?: '棣冨箒',
      '閸忓濂?: '棣冩寱',
      '閸忔湹绮?: '棣冩憹'
    };
    return icons[category] || '棣冩憹';
  },
  
  // 閺勫墽銇氱拠锔藉剰
  showDetail(id) {
    const item = Storage.get(id);
    if (!item) return;
    
    this.currentDetailId = id;
    const isFav = item.isFavorite || false;
    this.updateFavoriteButton(isFav);
    
    const container = document.getElementById('detail-container');
    
    // 濞撳弶鐓嬮悡褏澧?
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
          <div class="detail-status">${item.status || '閸︺劌鐒?}</div>
        </div>
        <div class="detail-meta">
          <div class="detail-meta-item">棣冩惃 閸濅胶琚敍?{item.mainCategory}</div>
          <div class="detail-meta-item">棣冩惍 瑜版洖鍙嗛弮鍫曟？閿?{item.createdAt}</div>
          <div class="detail-meta-item">鐚?閺€鎯版閿?{isFav ? '瀹稿弶鏁归挊? : '閺堫亝鏁归挊?}</div>
        </div>
        ${photosHtml}
        <div class="detail-desc">${item.notes || '閺嗗倹妫ゆ径鍥ㄦ暈'}</div>
      </div>
    `;
    
    // 缂佹垵鐣鹃悡褏澧栭悙鐟板毊娴滃娆㈤敍鍫濆弿鐏炲繑鐓￠惇瀣剁礆
    container.querySelectorAll('.detail-photo-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.showPhotoViewer(item.photos[index]);
      });
    });
    
    this.switchPage('detail');
  },
  
  // 閻撗呭閸忋劌鐫嗛弻銉ф箙
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
    
    // 缂佹垵鐣鹃崗鎶芥４娴滃娆?
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
  
  // 閹绘劒姘︾悰銊ュ礋
  submitForm() {
    const name = document.getElementById('create-name').value.trim();
    if (!name) {
      this.showToast('鐠囧嘲锝為崘娆忔倳缁?);
      return;
    }
    
    const category = document.getElementById('create-category').value.trim();
    const status = document.getElementById('create-status').value;
    const notes = document.getElementById('create-notes').value.trim();
    const richContent = document.getElementById('create-rich-content').innerHTML;
    
    const itemData = {
      name,
      mainCategory: category || '閸忔湹绮?,
      status,
      notes: notes || richContent,
      isFavorite: false,
      photos: this.currentPhotos || []
    };
    
    if (this.editingId) {
      Storage.update(this.editingId, itemData);
      this.showToast('娣囨繂鐡ㄩ幋鎰');
    } else {
      Storage.add(itemData);
      this.showToast('閸掓稑缂撻幋鎰');
    }
    
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
    document.getElementById('create-title').textContent = '閺傛澘缂撶拋鏉跨秿';
    this.currentPhotos = [];
    this.renderPhotoPreview();
  },
  
  // 閻撗呭娑撳﹣绱舵径鍕倞
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
    
    // 濞撳懐鈹?input 娴犮儱鍘戠拋鎼佸櫢婢跺秹鈧瀚ㄩ崥灞肩閺傚洣娆?
    e.target.value = '';
  },
  
  // 濞撳弶鐓嬮悡褏澧栨０鍕潔
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
    
    // 缂佹垵鐣鹃崚鐘绘珟娴滃娆?
    preview.querySelectorAll('.photo-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.currentPhotos.splice(index, 1);
        this.renderPhotoPreview();
      });
    });
  },
  
  // 缂佺喕顓告い鐢告桨
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
      statusCount[item.status || '閸︺劌鐒?] = (statusCount[item.status || '閸︺劌鐒?] || 0) + 1;
    });
    
    const statuses = Object.entries(statusCount).map(([name, value]) => ({ name, value }));
    
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-categories').textContent = Object.keys(categoryCount).length;
    document.getElementById('stat-favorites').textContent = favorites.length;
    document.getElementById('stat-active').textContent = statusCount['閸︺劌鐒?] || 0;
    
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
  
  // 鐎电厧鍤崝鐔诲厴
  exportData() {
    const json = Storage.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `娑撳洨澧块幍瀣贡婢跺洣鍞${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showToast('鐎电厧鍤幋鎰');
  },
  
  // 鐎电厧鍙嗛崝鐔诲厴
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
  
  // 鐎靛棛鐖滄穱婵囧Б
  togglePasswordLock() {
    const hasPassword = Security.hasPassword();
    
    if (!hasPassword) {
      PasswordUI.showModal('棣冩晙 鐠佸墽鐤嗙€靛棛鐖?, '鐠佸墽鐤嗛崥搴㈡殶閹诡喖鐨㈢悮顐㈠鐎靛棗鐡ㄩ崒?, '鏉堟挸鍙?4-20 娴ｅ秴鐦戦惍?, (password) => {
        if (password.length < 4) {
          PasswordUI.showError('鐎靛棛鐖滈懛鍐茬毌 4 娴?);
          return;
        }
        if (password.length > 20) {
          PasswordUI.showError('鐎靛棛鐖滈張鈧径?20 娴?);
          return;
        }
        
        PasswordUI.showModal('棣冩晙 绾喛顓荤€靛棛鐖?, '鐠囧嘲鍟€濞喡ょ翻閸忋儱鐦戦惍?, '閸愬秵顐兼潏鎾冲弳鐎靛棛鐖?, (confirmPwd) => {
          if (password !== confirmPwd) {
            PasswordUI.showError('娑撱倖顐肩€靛棛鐖滄稉宥勭閼?);
            return;
          }
          
          Security.setPassword(password);
          const items = Storage.getAll();
          Security.encryptData(items, password);
          
          window.__isDecrypted = true;
          window.__cachedItems = items;
          
          PasswordUI.hideModal();
          this.showToast('鐎靛棛鐖滅拋鍓х枂閹存劕濮?);
        });
      });
    } else {
      if (Security.isLocked()) {
        PasswordUI.showModal('棣冩晛 閸忔娊妫存穱婵囧Б', '鏉堟挸鍙嗙€靛棛鐖滈崗鎶芥４閺佺増宓侀崝鐘茬槕', '鏉堟挸鍙嗚ぐ鎾冲鐎靛棛鐖?, (password) => {
          if (Security.verifyPassword(password)) {
            const items = Security.decryptData(password);
            if (items) {
              Security.removePassword();
              Storage.save(items);
              PasswordUI.hideModal();
              this.showToast('娣囨繃濮㈠鎻掑彠闂?);
            } else {
              PasswordUI.showError('鐟欙絽鐦戞径杈Е閿涘矁顕柌宥堢槸');
            }
          } else {
            PasswordUI.showError('鐎靛棛鐖滈柨娆掝嚖');
          }
        });
      } else {
        PasswordUI.showModal('棣冩晙 瀵偓閸氼垯绻氶幎?, '瀵偓閸氼垰鎮楅弫鐗堝祦鐏忓棜顫﹂崝鐘茬槕', '鏉堟挸鍙嗙€靛棛鐖?, (password) => {
          if (Security.verifyPassword(password)) {
            localStorage.setItem(Security.LOCK_KEY, 'true');
            PasswordUI.hideModal();
            this.showToast('娣囨繃濮㈠鎻掔磻閸?);
          } else {
            PasswordUI.showError('鐎靛棛鐖滈柨娆掝嚖');
          }
        });
      }
    }
  },
  
  // 閸忓厖绨い鐢告桨
  showAbout() {
    alert('娑撳洨澧块幍瀣贡 v1.0.0\n\n鐠佹澘缍嶆稉鏍？娑撳洨澧块敍灞炬暪閽樺繒鏁撳ú鑽ゅ仯濠婄⒍n\n鐠佹崘顓搁崫鎻掝劅閿涙碍妫ら悾灞藉斧閻?鑴?閺嬩胶鐣濇稉璁崇疅');
  },
  
  // ==================== 娴滄垹顏崥灞绢劄 ====================
  
  bindCloudEvents() {
    // 閸氬本顒炵拋鍓х枂
    document.getElementById('settings-cloud-config')?.addEventListener('click', () => {
      this.showCloudConfig();
    });
    
    // 娑撳﹣绱?
    document.getElementById('settings-cloud-upload')?.addEventListener('click', () => {
      this.cloudUpload();
    });
    
    // 娑撳娴?
    document.getElementById('settings-cloud-download')?.addEventListener('click', () => {
      this.cloudDownload();
    });
    
    // 閸欏苯鎮滈崥灞绢劄
    document.getElementById('settings-cloud-sync')?.addEventListener('click', () => {
      this.cloudSyncBidirectional();
    });
    
    // 婢х偤鍣洪崥灞绢劄
    document.getElementById('settings-cloud-upload-incremental')?.addEventListener('click', () => {
      this.cloudUploadIncremental();
    });
    
    // 閸氬本顒為崢鍡楀蕉
    document.getElementById('settings-cloud-logs')?.addEventListener('click', () => {
      this.showSyncLogs();
    });
    
    // 闁板秶鐤嗗鍦崶 - 娣囨繂鐡?
    document.getElementById('cloud-modal-save-btn')?.addEventListener('click', () => {
      this.saveCloudConfig();
    });
    
    // 闁板秶鐤嗗鍦崶 - 濞村鐦潻鐐村复
    document.getElementById('cloud-modal-test-btn')?.addEventListener('click', () => {
      this.testCloudConnection();
    });
    
    // 闁板秶鐤嗗鍦崶 - 閸欐牗绉?
    document.getElementById('cloud-modal-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('cloud-token-input').value = '';
      document.getElementById('cloud-password-input').value = '';
      document.getElementById('cloud-modal').style.display = 'none';
    });
    
    // 閸愯尙鐛婂鍦崶 - 閸忋劑鍎存穱婵堟殌閺堫剙婀?
    document.getElementById('conflict-keep-local-btn')?.addEventListener('click', () => {
      CloudSync.config.conflictStrategy = 'local';
      document.getElementById('conflict-modal').style.display = 'none';
      this.showToast('瀹告煡鈧瀚ㄩ敍姘弿闁劋绻氶悾娆愭拱閸︽壆澧楅張?);
    });
    
    // 閸愯尙鐛婂鍦崶 - 閸忋劑鍎存穱婵堟殌娴滄垹顏?
    document.getElementById('conflict-keep-remote-btn')?.addEventListener('click', () => {
      CloudSync.config.conflictStrategy = 'remote';
      document.getElementById('conflict-modal').style.display = 'none';
      this.showToast('瀹告煡鈧瀚ㄩ敍姘弿闁劋绻氶悾娆庣隘缁旑垳澧楅張?);
    });
    
    // 閸愯尙鐛婂鍦崶 - 閹靛濮╅柅澶嬪
    document.getElementById('conflict-resolve-btn')?.addEventListener('click', () => {
      document.getElementById('conflict-modal').style.display = 'none';
      this.showToast('鐠囧嘲婀稉濠冩煙閻ㄥ嫬鍟跨粣浣稿灙鐞涖劋鑵戦柅澶嬪濮ｅ繋閲滅拋鏉跨秿閻ㄥ嫮澧楅張?);
    });
    
    // 閸氬本顒為弮銉ョ箶 - 閸忔娊妫?
    document.getElementById('sync-log-close-btn')?.addEventListener('click', () => {
      document.getElementById('sync-log-modal').style.display = 'none';
    });
    
    // 閸氬本顒為弮銉ョ箶 - 濞撳懐鈹?
    document.getElementById('sync-log-clear-btn')?.addEventListener('click', async () => {
      if (confirm('绾喖鐣剧憰浣圭缁岀儤澧嶉張澶婃倱濮濄儲妫╄箛妤€鎮ч敍?)) {
        await IDB.clearSyncLogs();
        this.showSyncLogs();
        this.showToast('閸氬本顒為弮銉ョ箶瀹稿弶绔荤粚?);
      }
    });
  },
  
  updateCloudStatus() {
    const statusText = document.getElementById('cloud-status-text');
    if (statusText) {
      statusText.textContent = CloudSync.getStatusText();
    }
  },
  
  showCloudConfig() {
    const modal = document.getElementById('cloud-modal');
    const tokenInput = document.getElementById('cloud-token-input');
    const passwordInput = document.getElementById('cloud-password-input');
    const testArea = document.getElementById('cloud-test-area');
    const testResult = document.getElementById('cloud-test-result');
    
    // 婵夘偄鍘栧韫箽鐎涙娈戦柊宥囩枂
    tokenInput.value = CloudSync.config.token || '';
    passwordInput.value = '';
    testArea.style.display = 'none';
    testResult.className = 'test-result';
    testResult.textContent = '';
    
    modal.style.display = 'flex';
    setTimeout(() => tokenInput.focus(), 100);
  },
  
  async saveCloudConfig() {
    const token = document.getElementById('cloud-token-input').value.trim();
    const password = document.getElementById('cloud-password-input').value;
    
    if (!token) {
      this.showToast('鐠囩柉绶崗?GitHub Token');
      return;
    }
    
    if (password.length < 6) {
      this.showToast('閸旂姴鐦戠€靛棛鐖滈懛鍐茬毌 6 娴?);
      return;
    }
    
    CloudSync.config.token = token;
    CloudSync.config.password = password;
    CloudSync.config.enabled = true;
    CloudSync.saveConfig();
    
    document.getElementById('cloud-modal').style.display = 'none';
    this.updateCloudStatus();
    this.showToast('閴?閸氬本顒為柊宥囩枂瀹歌弓绻氱€?);
  },
  
  async testCloudConnection() {
    const token = document.getElementById('cloud-token-input').value.trim();
    if (!token) {
      this.showToast('鐠囧嘲鍘涙潏鎾冲弳 Token');
      return;
    }
    
    CloudSync.config.token = token;
    const testArea = document.getElementById('cloud-test-area');
    const testResult = document.getElementById('cloud-test-result');
    
    testArea.style.display = 'block';
    testResult.className = 'test-result loading';
    testResult.textContent = '濮濓絽婀ù瀣槸鏉╃偞甯?..';
    
    const result = await CloudSync.testConnection();
    
    if (result.success) {
      testResult.className = 'test-result success';
      testResult.textContent = `閴?${result.message}`;
    } else {
      testResult.className = 'test-result error';
      testResult.textContent = `閴?${result.message}`;
    }
  },
  
  showSyncProgress(status) {
    const modal = document.getElementById('sync-progress-modal');
    const text = document.getElementById('sync-status-text');
    text.textContent = status;
    modal.style.display = 'flex';
  },
  
  hideSyncProgress() {
    document.getElementById('sync-progress-modal').style.display = 'none';
  },
  
  async cloudUpload() {
    if (!CloudSync.config.token) {
      this.showToast('鐠囧嘲鍘涢柊宥囩枂閸氬本顒炵拋鍓х枂');
      this.showCloudConfig();
      return;
    }
    
    PasswordUI.showModal('棣冩敿 閸旂姴鐦戠€靛棛鐖?, '鏉堟挸鍙嗛崝鐘茬槕鐎靛棛鐖滄禒銉ょ瑐娴肩姵鏆熼幑?, '鏉堟挸鍙嗙€靛棛鐖?, async (password) => {
      this.showSyncProgress('濮濓絽婀崝鐘茬槕閺佺増宓?..');
      
      const items = this.items.length > 0 ? this.items : Storage.getAll();
      const result = await CloudSync.upload(items, password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        this.updateCloudStatus();
        this.showToast(`閴?${result.message}`);
      } else {
        this.showToast(`閴?${result.message}`);
      }
      
      PasswordUI.hideModal();
    });
  },
  
  async cloudUploadIncremental() {
    if (!CloudSync.config.token) {
      this.showToast('鐠囧嘲鍘涢柊宥囩枂閸氬本顒炵拋鍓х枂');
      this.showCloudConfig();
      return;
    }
    
    if (!window.IDB) {
      this.showToast('瑜版挸澧犲ù蹇氼潔閸ｃ劋绗夐弨顖涘瘮 IndexedDB閿涘矁顕担璺ㄦ暏鐎瑰本鏆ｆ稉濠佺炊');
      return;
    }
    
    PasswordUI.showModal('棣冩敿 閸旂姴鐦戠€靛棛鐖?, '鏉堟挸鍙嗛崝鐘茬槕鐎靛棛鐖滄潻娑滎攽婢х偤鍣洪崥灞绢劄', '鏉堟挸鍙嗙€靛棛鐖?, async (password) => {
      this.showSyncProgress('濮濓絽婀晶鐐哄櫤閸氬本顒?..');
      
      const result = await CloudSync.uploadIncremental(password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        this.updateCloudStatus();
        this.showToast(`閴?${result.message}`);
      } else {
        this.showToast(`閴?${result.message}`);
      }
      
      PasswordUI.hideModal();
    });
  },
  
  async cloudDownload() {
    if (!CloudSync.config.token) {
      this.showToast('鐠囧嘲鍘涢柊宥囩枂閸氬本顒炵拋鍓х枂');
      this.showCloudConfig();
      return;
    }
    
    PasswordUI.showModal('棣冩晛 鐟欙絽鐦戠€靛棛鐖?, '鏉堟挸鍙嗙憴锝呯槕鐎靛棛鐖滄禒銉ょ瑓鏉炶姤鏆熼幑?, '鏉堟挸鍙嗙€靛棛鐖?, async (password) => {
      this.showSyncProgress('濮濓絽婀禒搴濈隘缁旑垯绗呮潪?..');
      
      const localItems = this.items.length > 0 ? this.items : Storage.getAll();
      const result = await CloudSync.download(localItems, password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        // 濡偓閺屻儲妲搁崥锔芥箒閸愯尙鐛?
        if (result.conflicts && result.conflicts.length > 0) {
          await this.showConflictResolution(result.conflicts);
        }
        
        this.items = result.items;
        Storage.save(result.items);
        this.filterItems();
        this.renderItems();
        this.renderFavorites();
        this.renderCategoryFilter();
        this.updateCloudStatus();
        this.showToast(`閴?${result.message}`);
      } else {
        this.showToast(`閴?${result.message}`);
      }
      
      PasswordUI.hideModal();
    });
  },
  
  async cloudSyncBidirectional() {
    if (!CloudSync.config.token) {
      this.showToast('鐠囧嘲鍘涢柊宥囩枂閸氬本顒炵拋鍓х枂');
      this.showCloudConfig();
      return;
    }
    
    PasswordUI.showModal('棣冩敡 閸氬本顒炵€靛棛鐖?, '鏉堟挸鍙嗙€靛棛鐖滄潻娑滎攽閸欏苯鎮滈崥灞绢劄', '鏉堟挸鍙嗙€靛棛鐖?, async (password) => {
      this.showSyncProgress('濮濓絽婀崣灞芥倻閸氬本顒?..');
      
      const localItems = this.items.length > 0 ? this.items : Storage.getAll();
      const result = await CloudSync.syncBidirectional(localItems, password);
      
      this.hideSyncProgress();
      
      if (result.success) {
        // 濡偓閺屻儲妲搁崥锔芥箒閸愯尙鐛?
        if (result.conflicts && result.conflicts.length > 0) {
          await this.showConflictResolution(result.conflicts);
        }
        
        this.items = result.items;
        Storage.save(result.items);
        this.filterItems();
        this.renderItems();
        this.renderFavorites();
        this.renderCategoryFilter();
        this.updateCloudStatus();
        this.showToast(`閴?${result.message}`);
      } else {
        this.showToast(`閴?${result.message}`);
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
    } catch (e) { console.warn('閼奉亜濮╅崥灞绢劄婢惰精瑙?', e); }
  },
  
  // ==================== 閸愯尙鐛婄憴锝呭枀 ====================
  
  async showConflictResolution(conflicts) {
    if (!conflicts || conflicts.length === 0) return;
    
    const modal = document.getElementById('conflict-modal');
    const list = document.getElementById('conflict-list');
    
    list.innerHTML = conflicts.map((conflict, index) => `
      <div class="conflict-item" data-id="${conflict.id}">
        <div class="conflict-item-header">
          <span class="conflict-item-name">${this.escapeHtml(conflict.name || '閺堫亜鎳￠崥?)}</span>
          <span class="conflict-item-time">ID: ${conflict.id.substr(0, 8)}...</span>
        </div>
        <div class="conflict-item-versions">
          <div class="conflict-version" data-choice="local" data-index="${index}">
            <div class="conflict-version-label">棣冩懌 閺堫剙婀撮悧鍫熸拱</div>
            <div class="conflict-version-date">${conflict.localModified}</div>
          </div>
          <div class="conflict-version" data-choice="remote" data-index="${index}">
            <div class="conflict-version-label">閳戒緤绗?娴滄垹顏悧鍫熸拱</div>
            <div class="conflict-version-date">${conflict.remoteModified}</div>
          </div>
        </div>
      </div>
    `).join('');
    
    // 缂佹垵鐣鹃柅澶嬪娴滃娆?
    list.querySelectorAll('.conflict-version').forEach(version => {
      version.addEventListener('click', () => {
        const item = version.closest('.conflict-item');
        item.querySelectorAll('.conflict-version').forEach(v => v.classList.remove('selected'));
        version.classList.add('selected');
        item.dataset.choice = version.dataset.choice;
      });
    });
    
    modal.style.display = 'flex';
  },
  
  resolveConflicts(conflicts, choices) {
    const resolved = conflicts.map((conflict, index) => {
      const choice = choices[index] || 'newer';
      if (choice === 'local') return conflict.local;
      if (choice === 'remote') return conflict.remote;
      // newer: 閸欐牞绶濋弬鎵畱
      return new Date(conflict.localModified) > new Date(conflict.remoteModified) ? conflict.local : conflict.remote;
    });
    return resolved;
  },
  
  // ==================== 閸氬本顒為弮銉ョ箶 ====================
  
  async showSyncLogs() {
    const modal = document.getElementById('sync-log-modal');
    const list = document.getElementById('sync-log-list');
    
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary)">閸旂姾娴囨稉?..</div>';
    modal.style.display = 'flex';
    
    const logs = await CloudSync.getSyncHistory(50);
    
    if (logs.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">閺嗗倹妫ら崥灞绢劄鐠佹澘缍?/div>';
      return;
    }
    
    list.innerHTML = logs.map(log => `
      <div class="sync-log-item">
        <div class="sync-log-icon ${log.success ? 'success' : 'error'}">
          ${log.success ? '閴? : '閴?}
        </div>
        <div class="sync-log-content">
          <div class="sync-log-type">${this.getSyncTypeLabel(log.type)}</div>
          <div class="sync-log-message">${this.escapeHtml(log.message)}</div>
        </div>
        <div class="sync-log-time">
          <div>${new Date(log.timestamp).toLocaleDateString('zh-CN')}</div>
          <div>${new Date(log.timestamp).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}</div>
          <div style="font-size:10px;color:var(--text-secondary)">${log.duration}ms</div>
        </div>
      </div>
    `).join('');
  },
  
  getSyncTypeLabel(type) {
    const labels = {
      'upload': '棣冩憶 娑撳﹣绱?,
      'download': '棣冩憸 娑撳娴?,
      'sync_bidirectional': '棣冩敡 閸欏苯鎮滈崥灞绢劄',
      'upload_incremental': '閳?婢х偤鍣烘稉濠佺炊'
    };
    return labels[type] || type;
  },
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// ===================================
// 閸氼垰濮╂惔鏃傛暏
// ===================================

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});


