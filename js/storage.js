/**
 * 万物手札 - 存储管理模块
 * 负责 localStorage ?IndexedDB 的数据读?
 * 版本：v2.5.0
 */

const Storage = {
  // 本地存储键名
  STORAGE_KEY: 'journal_items',
  SETTINGS_KEY: 'journal_settings',
  
  // 初始?
  init() {
    console.log('Storage module initialized');
    this.migrateLegacyData();
  },
  
  // 获取所有记?
  getAll() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      let items = data ? JSON.parse(data) : [];
      
      // 确保是数?
      if (!Array.isArray(items)) {
        items = [];
      }
      
      // 数据迁移：处理旧版数据结?
      items = this.migrateItems(items);
      
      return items;
    } catch (e) {
      console.error('Storage.getAll error:', e);
      return [];
    }
  },
  
  // 保存所有记?
  saveAll(items) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      console.error('Storage.saveAll error:', e);
      return false;
    }
  },
  
  // 添加新记录
  addItem(itemData) {
    const items = this.getAll();
    const newItem = {
      id: Date.now().toString(),
      name: itemData.name || '未命名',
      category: itemData.category || 'general',
      mainCategory: itemData.category || 'general', // 兼容性字段
      date: itemData.date || new Date().toISOString().split('T')[0],
      notes: itemData.notes || '',
      photos: itemData.photos || [], // 照片数组
      favorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // 保留所有额外字段
      ...itemData
    };
    
    items.unshift(newItem);
    this.saveAll(items);
    return newItem;
  },
  
  // 更新记录
  updateItem(id, updates) {
    const items = this.getAll();
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) {
      console.error('Item not found:', id);
      return null;
    }
    
    // 保留原有照片（如果未提供新照片）
    if (!updates.photos && items[index].photos) {
      updates.photos = items[index].photos;
    }
    
    items[index] = {
      ...items[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.saveAll(items);
    return items[index];
  },
  
  // 删除记录
  deleteItem(id) {
    const items = this.getAll();
    const filtered = items.filter(item => item.id !== id);
    this.saveAll(filtered);
    return filtered.length < items.length;
  },
  
  // 获取单条记录
  getItem(id) {
    const items = this.getAll();
    return items.find(item => item.id === id) || null;
  },
  
  // 切换收藏状态
  toggleFavorite(id) {
    const items = this.getAll();
    const item = items.find(item => item.id === id);
    
    if (!item) return null;
    
    item.favorite = !item.favorite;
    item.updatedAt = new Date().toISOString();
    this.saveAll(items);
    return item;
  },
  
  // 获取收藏记录
  getFavorites() {
    return this.getAll().filter(item => item.favorite);
  },
  
  // 搜索记录
  searchItems(query) {
    const items = this.getAll();
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery) return items;
    
    return items.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) ||
      item.notes.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery)
    );
  },
  
  // 获取设置
  getSettings() {
    try {
      const data = localStorage.getItem(this.SETTINGS_KEY);
      return data ? JSON.parse(data) : {
        theme: 'light',
        fontSize: 'medium',
        sortBy: 'newest'
      };
    } catch (e) {
      console.error('Storage.getSettings error:', e);
      return { theme: 'light' };
    }
  },
  
  // 保存设置
  saveSettings(settings) {
    try {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error('Storage.saveSettings error:', e);
      return false;
    }
  },
  
  // ========== 自定义分类管理 ==========
  
  // 获取所有分类（预设 + 自定义）
  getCategories() {
    const presetCategories = [
      { id: 'general', name: '通用' },
      { id: 'tech', name: '科技' },
      { id: 'life', name: '生活' },
      { id: 'work', name: '工作' },
      { id: 'study', name: '学习' },
      { id: 'other', name: '其他' }
    ];
    
    const settings = this.getSettings();
    const customCategories = settings.customCategories || [];
    
    // 合并预设和自定义分类
    const allCategories = [...presetCategories];
    
    // 添加自定义分类（避免与预?ID 冲突?
    customCategories.forEach(cat => {
      if (typeof cat === 'string') {
        // 兼容旧格式（纯字符串?
        allCategories.push({ id: 'custom_' + this.slugify(cat), name: cat });
      } else if (cat && cat.id && cat.name) {
        // 新格式（对象?
        allCategories.push(cat);
      }
    });
    
    return allCategories;
  },
  
  // 添加自定义分类
  addCategory(name) {
    if (!name || !name.trim()) return false;
    
    const trimmedName = name.trim();
    const settings = this.getSettings();
    
    if (!settings.customCategories) {
      settings.customCategories = [];
    }
    
    // 检查是否已存在
    const exists = settings.customCategories.some(cat => {
      const catName = typeof cat === 'string' ? cat : (cat.name || '');
      return catName.toLowerCase() === trimmedName.toLowerCase();
    });
    
    if (exists) return false;
    
    settings.customCategories.push({
      id: 'custom_' + this.slugify(trimmedName),
      name: trimmedName
    });
    
    return this.saveSettings(settings);
  },
  
  // 删除自定义分类
  deleteCategory(categoryId) {
    // 不允许删除预设分类
    if (['general', 'tech', 'life', 'work', 'study', 'other'].includes(categoryId)) {
      return false;
    }
    
    const settings = this.getSettings();
    if (!settings.customCategories) return false;
    
    const beforeLen = settings.customCategories.length;
    settings.customCategories = settings.customCategories.filter(cat => {
      const catId = typeof cat === 'string' ? 'custom_' + this.slugify(cat) : (cat.id || '');
      return catId !== categoryId;
    });
    
    if (settings.customCategories.length === beforeLen) return false;
    
    return this.saveSettings(settings);
  },
  
  // 根据分类 ID 获取名称
  getCategoryName(categoryId) {
    const categories = this.getCategories();
    const found = categories.find(cat => cat.id === categoryId);
    return found ? found.name : categoryId;
  },
  
  // 字符串转 slug（用于生成分?ID?
  slugify(text) {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^\w\u4e00-\u9fa5]/g, '')
      .replace(/_+/g, '_');
  },
  
  // 导出数据
  exportData() {
    const data = {
      version: '2.2.1',
      exportDate: new Date().toISOString(),
      items: this.getAll(),
      settings: this.getSettings()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
  
  // 导入数据
  importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          if (data.items && Array.isArray(data.items)) {
            this.saveAll(data.items);
          }
          
          if (data.settings) {
            this.saveSettings(data.settings);
          }
          
          resolve(true);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  },
  
  // 数据迁移：处理旧版数据结构（保留所有字段，不丢失数据）
  migrateItems(items) {
    return items.map(item => {
      // 使用 spread 保留所有已有字段，只补充缺失的必需字段
      return {
        id: item.id || Date.now().toString(),
        name: item.name || '未命名',
        category: item.category || item.mainCategory || 'general',
        mainCategory: item.mainCategory || item.category || 'general',
        date: item.date || new Date().toISOString().split('T')[0],
        notes: item.notes || '',
        favorite: item.favorite || false,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        // 保留所有其他字段（如 photos, customCategoryName 等）
        ...item
      };
    });
  },
  
  // 迁移遗留数据（首次加载时执行）
  migrateLegacyData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return;
      
      let items = JSON.parse(data);
      if (!Array.isArray(items)) return;
      
      // 检查是否需要迁移
      const needsMigration = items.some(item => 
        !item.mainCategory || !item.date || !item.createdAt
      );
      
      if (needsMigration) {
        const migrated = this.migrateItems(items);
        this.saveAll(migrated);
        console.log('Legacy data migrated successfully');
      }
    } catch (e) {
      console.error('migrateLegacyData error:', e);
    }
  }
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
  Storage.init();
});
