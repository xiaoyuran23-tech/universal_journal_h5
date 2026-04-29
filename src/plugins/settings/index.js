/**
 * Settings Plugin - 设置页面插件
 * 提供用户设置、数据管理、主题切换等功能
 * @version 6.1.0
 */

// 幂等加载保护
if (!window.SettingsPlugin) {
const SettingsPlugin = {
  name: 'settings',
  version: '1.0.0',
  dependencies: ['records'],
  
  _eventsBound: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[SettingsPlugin] Initializing...');
    
    this.routes = [
      {
        path: 'settings',
        title: '设置',
        component: 'settings-view'
      }
    ];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[SettingsPlugin] Starting...');
    this._bindEvents();
    this._render();
  },

  /**
   * 停止插件
   */
  stop() {
    console.log('[SettingsPlugin] Stopping...');
    this._eventsBound = false;
  },

  /**
   * 路由定义
   */
  routes: [],

  /**
   * Actions
   */
  actions: {},

  /**
   * 渲染设置页面
   * @private
   */
  _render() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    const records = window.Store ? window.Store.getState('records.list') : [];
    const favorites = records.filter(r => r.favorite);

    container.innerHTML = `
      <div class="settings-page">
        <!-- 用户信息 -->
        <div class="settings-section">
          <div class="settings-profile">
            <div class="settings-avatar">
              <span>${this._getAvatarLetter()}</span>
            </div>
            <div class="settings-profile-info">
              <h3 class="settings-name" id="settings-display-name">${this._getDisplayName()}</h3>
              <p class="settings-stats">${records.length} 条记录 · ${favorites.length} 条收藏</p>
            </div>
            <button class="settings-edit-btn" data-action="edit-profile">编辑</button>
          </div>
        </div>

        <!-- 数据管理 -->
        <div class="settings-section">
          <h3 class="settings-section-title">数据管理</h3>
          
          <div class="settings-item" data-action="export-data">
            <span class="settings-item-icon"></span>
            <div class="settings-item-content">
              <span class="settings-item-title">导出数据</span>
              <span class="settings-item-desc">导出为 JSON 文件备份</span>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
          
          <div class="settings-item" data-action="import-data">
            <span class="settings-item-icon">📥</span>
            <div class="settings-item-content">
              <span class="settings-item-title">导入数据</span>
              <span class="settings-item-desc">从 JSON 文件恢复数据</span>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
          
          <div class="settings-item settings-item-danger" data-action="clear-data">
            <span class="settings-item-icon">🗑️</span>
            <div class="settings-item-content">
              <span class="settings-item-title">清空数据</span>
              <span class="settings-item-desc">删除所有本地记录</span>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
        </div>

        <!-- 外观设置 -->
        <div class="settings-section">
          <h3 class="settings-section-title">外观</h3>
          
          <div class="settings-item" data-action="toggle-theme">
            <span class="settings-item-icon">🎨</span>
            <div class="settings-item-content">
              <span class="settings-item-title">深色模式</span>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" id="theme-toggle" ${this._isDarkMode() ? 'checked' : ''} />
              <span class="settings-toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 关于 -->
        <div class="settings-section">
          <h3 class="settings-section-title">关于</h3>
          
          <div class="settings-item">
            <span class="settings-item-icon">📱</span>
            <div class="settings-item-content">
              <span class="settings-item-title">万物手札</span>
              <span class="settings-item-desc">v6.1.0 · 微内核架构</span>
            </div>
          </div>
          
          <div class="settings-item" data-action="view-source">
            <span class="settings-item-icon">💻</span>
            <div class="settings-item-content">
              <span class="settings-item-title">源代码</span>
              <span class="settings-item-desc">GitHub 开源项目</span>
            </div>
            <span class="settings-item-arrow">›</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const container = document.getElementById('settings-container');
    if (!container) return;

    // 事件委托
    container.addEventListener('click', (e) => {
      const item = e.target.closest('[data-action]');
      if (item) {
        const action = item.dataset.action;
        this._handleAction(action);
      }

      // 主题切换
      if (e.target.id === 'theme-toggle') {
        this._toggleTheme();
      }
    });
  },

  /**
   * 处理操作
   * @param {string} action
   * @private
   */
  _handleAction(action) {
    switch (action) {
      case 'edit-profile':
        this._editProfile();
        break;
      case 'export-data':
        this._exportData();
        break;
      case 'import-data':
        this._importData();
        break;
      case 'clear-data':
        this._clearData();
        break;
      case 'toggle-theme':
        this._toggleTheme();
        break;
      case 'view-source':
        window.open('https://github.com/xiaoyuran23-tech/universal_journal_h5', '_blank');
        break;
    }
  },

  /**
   * 编辑个人资料
   * @private
   */
  _editProfile() {
    const currentName = this._getDisplayName();
    const newName = prompt('请输入昵称：', currentName);
    
    if (newName !== null && newName.trim()) {
      localStorage.setItem('user_nickname', newName.trim());
      this._render();
      this._showToast('昵称已更新', { type: 'success' });
    }
  },

  /**
   * 导出数据
   * @private
   */
  _exportData() {
    const records = window.Store ? window.Store.getState('records.list') : [];
    const data = {
      version: '6.0.0',
      exportDate: new Date().toISOString(),
      records: records
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this._showToast('数据已导出', { type: 'success' });
  },

  /**
   * 导入数据
   * @private
   */
  _importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (data.records && Array.isArray(data.records)) {
          // 导入记录 — 区分新增/更新
          if (window.Store && window.StorageService) {
            const existing = window.Store.getState('records.list') || [];
            const existingIds = new Set(existing.map(r => r.id));

            for (const record of data.records) {
              if (existingIds.has(record.id)) {
                // 更新已有记录
                window.Store.dispatch({
                  type: 'records/update',
                  payload: { id: record.id, updates: record }
                });
                await window.StorageService.put(record);
              } else {
                // 导入新记录
                await window.StorageService.put(record);
              }
            }
            // 刷新 Store 中的记录列表
            const allRecords = await window.StorageService.getAll();
            window.Store.dispatch({
              type: 'SET_STATE',
              payload: { records: { list: allRecords, filtered: allRecords } }
            });
          }
          this._showToast(`成功导入 ${data.records.length} 条记录`, { type: 'success' });
          this._render();
        } else {
          this._showToast('文件格式不正确', { type: 'error' });
        }
      } catch (error) {
        console.error('[SettingsPlugin] Import failed:', error);
        this._showToast('导入失败：' + error.message, { type: 'error' });
      }
    });

    input.click();
  },

  /**
   * 清空数据
   * @private
   */
  _clearData() {
    if (confirm('️ 确定要删除所有数据吗？此操作不可恢复！')) {
      if (confirm('⚠️ 再次确认：真的要清空所有记录吗？')) {
        // 清空 Store
        if (window.Store) {
          window.Store.dispatch({
            type: 'SET_STATE',
            payload: {
              records: {
                list: [],
                filtered: [],
                loading: false
              }
            }
          });
        }

        // 清空存储
        if (window.StorageService) {
          StorageService.clear();
        }

        this._showToast('数据已清空', { type: 'success' });
        this._render();
      }
    }
  },

  /**
   * 切换主题
   * @private
   */
  _toggleTheme() {
    const isDark = this._isDarkMode();
    const newTheme = isDark ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app_theme', newTheme);
    
    this._showToast(isDark ? '已切换到浅色模式' : '已切换到深色模式', { type: 'success' });
  },

  /**
   * 获取显示名称
   * @private
   */
  _getDisplayName() {
    return localStorage.getItem('user_nickname') || '用户';
  },

  /**
   * 获取头像字母
   * @private
   */
  _getAvatarLetter() {
    const name = this._getDisplayName();
    return name.charAt(0).toUpperCase();
  },

  /**
   * 检查是否为深色模式
   * @private
   */
  _isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ||
           localStorage.getItem('app_theme') === 'dark';
  },

  /**
   * 显示 Toast
   * @private
   */
  _showToast(message, options = {}) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(message, { duration: 2000, ...options });
    } else if (window.App) {
      App.showToast(message);
    }
  }
};

// 全局暴露
window.SettingsPlugin = SettingsPlugin;

console.log('[SettingsPlugin] 设置插件已定义');
} else {
  console.log('[SettingsPlugin] 已存在，跳过加载');
}
