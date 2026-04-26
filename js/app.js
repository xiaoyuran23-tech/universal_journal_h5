/**
 * 万物手札 H5 - 主应用逻辑
 * 使用 localStorage 存储数据，无需后端
 */

// ===================================
// 数据存储层
// ===================================

const Storage = {
  KEY: 'universal_journal_items',
  
  getAll() {
    const data = localStorage.getItem(this.KEY);
    return data ? JSON.parse(data) : [];
  },
  
  save(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
  },
  
  add(item) {
    const items = this.getAll();
    item._id = Date.now().toString();
    item.createdAt = new Date().toISOString().split('T')[0];
    item.updatedAt = new Date().toISOString();
    items.unshift(item);
    this.save(items);
    return item;
  },
  
  get(id) {
    const items = this.getAll();
    return items.find(item => item._id === id);
  },
  
  delete(id) {
    const items = this.getAll();
    const filtered = items.filter(item => item._id !== id);
    this.save(filtered);
  },
  
  count() {
    return this.getAll().length;
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
  },
  
  bindEvents() {
    // 主题切换按钮
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
      
      // 主题选项点击
      document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', (e) => {
          const themeId = e.currentTarget.dataset.theme;
          this.apply(themeId);
          panel.classList.remove('show');
        });
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
    
    // 重新绑定事件
    this.bindEvents();
  }
};

// ===================================
// 应用状态
// ===================================

const App = {
  currentPage: 'home',
  currentCategory: '',
  searchKey: '',
  items: [],
  filteredItems: [],
  uploadFiles: [],
  
  mainCategories: ['植物', '手办', '书籍', '数码', '宠物', '其他'],
  
  init() {
    ThemeManager.init();
    ThemeManager.renderOptions();
    this.bindEvents();
    this.loadItems();
    this.renderCategoryFilter();
    this.renderItems();
    console.log('📦 万物手札 H5 已启动');
  },
  
  bindEvents() {
    // TabBar 切换
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const page = e.currentTarget.dataset.page;
        this.switchPage(page);
      });
    });
    
    // FAB 添加按钮
    document.getElementById('fab-add').addEventListener('click', () => {
      this.switchPage('add');
    });
    
    // 空状态添加按钮
    document.getElementById('empty-add-btn')?.addEventListener('click', () => {
      this.switchPage('add');
    });
    
    // 搜索
    document.getElementById('search-btn').addEventListener('click', () => {
      this.searchKey = document.getElementById('search-input').value.trim();
      this.filterItems();
      this.renderItems();
    });
    
    document.getElementById('search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchKey = e.target.value.trim();
        this.filterItems();
        this.renderItems();
      }
    });
    
    // 返回按钮
    document.getElementById('add-back-btn').addEventListener('click', () => {
      this.switchPage('home');
    });
    
    document.getElementById('detail-back-btn').addEventListener('click', () => {
      this.switchPage('home');
    });
    
    // 文件上传
    document.getElementById('upload-placeholder').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });
    
    document.getElementById('file-input').addEventListener('change', (e) => {
      this.handleFileSelect(e);
    });
    
    // 提交表单
    document.getElementById('submit-btn').addEventListener('click', () => {
      this.submitForm();
    });
  },
  
  // ===================================
  // 页面切换
  // ===================================
  
  switchPage(page) {
    // 更新 TabBar
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.page === page);
    });
    
    // 更新页面显示
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    // 更新 FAB 显示
    const fab = document.getElementById('fab-add');
    fab.style.display = (page === 'home' || page === 'add') ? 'flex' : 'none';
    
    this.currentPage = page;
    
    // 加载统计数据
    if (page === 'stats') {
      this.loadStats();
    }
    
    // 滚动到顶部
    document.querySelector('.main-content').scrollTop = 0;
  },
  
  // ===================================
  // 物品管理
  // ===================================
  
  loadItems() {
    this.items = Storage.getAll();
    this.filterItems();
  },
  
  filterItems() {
    this.filteredItems = this.items.filter(item => {
      const matchCategory = !this.currentCategory || item.mainCategory === this.currentCategory;
      const matchSearch = !this.searchKey || 
        item.name.toLowerCase().includes(this.searchKey.toLowerCase()) ||
        (item.desc && item.desc.toLowerCase().includes(this.searchKey.toLowerCase()));
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
    
    // 绑定点击事件
    container.querySelectorAll('.category-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentCategory = e.currentTarget.dataset.category;
        this.filterItems();
        this.renderItems();
      });
    });
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
      html += `
        <div class="item-card" data-id="${item._id}">
          <div class="item-card-inner">
            ${item.cover ? `<img src="${item.cover}" class="item-cover" alt="${item.name}" />` : ''}
            <div class="item-info">
              <div class="item-name">${item.name}</div>
              <div class="item-tags">
                <span class="item-tag">${item.mainCategory}</span>
                ${item.subCategory ? `<span class="item-tag sub">${item.subCategory}</span>` : ''}
              </div>
              <div class="item-meta">📅 ${item.createdAt}</div>
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    // 绑定点击事件
    container.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showDetail(card.dataset.id);
      });
    });
  },
  
  // ===================================
  // 详情页面
  // ===================================
  
  showDetail(id) {
    const item = Storage.get(id);
    if (!item) return;
    
    const container = document.getElementById('detail-container');
    
    let imagesHtml = '';
    if (item.images && item.images.length > 1) {
      imagesHtml = '<div class="detail-images">';
      item.images.forEach(img => {
        imagesHtml += `<img src="${img}" class="detail-image-item" />`;
      });
      imagesHtml += '</div>';
    }
    
    container.innerHTML = `
      ${item.cover ? `<img src="${item.cover}" class="detail-cover" alt="${item.name}" />` : ''}
      <div class="detail-content">
        <div class="detail-header">
          <div class="detail-title">${item.name}</div>
          <div class="detail-status ${item.status}">${item.status}</div>
        </div>
        <div class="detail-meta">
          <div class="detail-meta-item">📂 主品类：${item.mainCategory}</div>
          <div class="detail-meta-item">🏷️ 子分类：${item.subCategory || '未分类'}</div>
          <div class="detail-meta-item">📅 录入时间：${item.createdAt}</div>
        </div>
        <div class="detail-desc">${item.desc || '暂无备注'}</div>
        ${imagesHtml}
      </div>
    `;
    
    this.switchPage('detail');
  },
  
  // ===================================
  // 文件上传
  // ===================================
  
  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        this.uploadFiles.push({
          file: file,
          dataUrl: event.target.result,
          type: file.type.startsWith('video/') ? 'video' : 'image'
        });
        this.renderUploadPreview();
      };
      reader.readAsDataURL(file);
    });
    
    // 清空 input
    e.target.value = '';
  },
  
  renderUploadPreview() {
    const container = document.getElementById('upload-preview');
    const placeholder = document.getElementById('upload-placeholder');
    
    if (this.uploadFiles.length === 0) {
      placeholder.style.display = 'flex';
      container.innerHTML = '';
      return;
    }
    
    placeholder.style.display = 'none';
    
    let html = '';
    this.uploadFiles.forEach((file, index) => {
      if (file.type === 'video') {
        html += `
          <div class="upload-preview-item">
            <video src="${file.dataUrl}"></video>
            <button class="upload-preview-delete" data-index="${index}">×</button>
          </div>
        `;
      } else {
        html += `
          <div class="upload-preview-item">
            <img src="${file.dataUrl}" />
            <button class="upload-preview-delete" data-index="${index}">×</button>
          </div>
        `;
      }
    });
    
    container.innerHTML = html;
    
    // 绑定删除事件
    container.querySelectorAll('.upload-preview-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(e.currentTarget.dataset.index);
        this.uploadFiles.splice(index, 1);
        this.renderUploadPreview();
      });
    });
  },
  
  // ===================================
  // 表单提交
  // ===================================
  
  submitForm() {
    const name = document.getElementById('item-name').value.trim();
    if (!name) {
      this.showToast('请填写名称');
      return;
    }
    
    const mainCategory = document.getElementById('item-category').value;
    const subCategory = document.getElementById('item-subcategory').value.trim();
    const status = document.getElementById('item-status').value;
    const desc = document.getElementById('item-desc').value.trim();
    
    // 处理图片
    const cover = this.uploadFiles.length > 0 ? this.uploadFiles[0].dataUrl : '';
    const images = this.uploadFiles.map(f => f.dataUrl);
    
    const item = {
      name,
      mainCategory,
      subCategory,
      status,
      desc,
      cover,
      images
    };
    
    Storage.add(item);
    
    this.showToast('添加成功');
    
    // 重置表单
    this.resetForm();
    
    // 刷新列表
    this.loadItems();
    this.renderCategoryFilter();
    this.renderItems();
    
    // 返回主页
    setTimeout(() => {
      this.switchPage('home');
    }, 1500);
  },
  
  resetForm() {
    document.getElementById('item-name').value = '';
    document.getElementById('item-category').value = '其他';
    document.getElementById('item-subcategory').value = '';
    document.getElementById('item-status').value = '在役';
    document.getElementById('item-desc').value = '';
    this.uploadFiles = [];
    this.renderUploadPreview();
  },
  
  // ===================================
  // 统计页面
  // ===================================
  
  loadStats() {
    const items = Storage.getAll();
    const total = items.length;
    
    // 品类统计
    const categoryCount = {};
    items.forEach(item => {
      categoryCount[item.mainCategory] = (categoryCount[item.mainCategory] || 0) + 1;
    });
    
    const categories = Object.entries(categoryCount).map(([name, value]) => ({ name, value }));
    
    // 状态统计
    const statusCount = {};
    items.forEach(item => {
      statusCount[item.status] = (statusCount[item.status] || 0) + 1;
    });
    
    const statuses = Object.entries(statusCount).map(([name, value]) => ({ name, value }));
    
    // 更新 UI
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-categories').textContent = Object.keys(categoryCount).length;
    
    // 渲染图表
    if (window.Charts) {
      window.Charts.renderCategoryChart(categories);
      window.Charts.renderStatusChart(statuses);
    }
  },
  
  // ===================================
  // Toast 提示
  // ===================================
  
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
