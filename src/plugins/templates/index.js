/**
 * Templates Plugin - 模板系统插件
 * 提供预设模板和自定义模板功能
 * @version 6.0.0
 */

const TemplatesPlugin = {
  name: 'templates',
  version: '1.0.0',
  dependencies: ['records'],
  
  STORAGE_KEY: 'journal_templates_v6',
  _templates: [],
  _eventsBound: false,

  // 内置默认模板
  DEFAULT_TEMPLATES: [
    {
      id: 'tpl_shopping',
      name: '购物清单',
      icon: '🛒',
      category: '生活',
      description: '记录需要购买的物品',
      fields: [
        { label: '购物地点', type: 'text', value: '' },
        { label: '预算', type: 'text', value: '' },
        { label: '清单', type: 'textarea', value: '' },
        { label: '备注', type: 'textarea', value: '' }
      ]
    },
    {
      id: 'tpl_reading',
      name: '读书笔记',
      icon: '',
      category: '学习',
      description: '记录阅读心得和摘抄',
      fields: [
        { label: '书名', type: 'text', value: '' },
        { label: '作者', type: 'text', value: '' },
        { label: '评分', type: 'text', value: '⭐⭐⭐⭐⭐' },
        { label: '摘抄', type: 'textarea', value: '' },
        { label: '读后感', type: 'textarea', value: '' }
      ]
    },
    {
      id: 'tpl_travel',
      name: '旅行计划',
      icon: '✈️',
      category: '生活',
      description: '规划旅行行程和必备物品',
      fields: [
        { label: '目的地', type: 'text', value: '' },
        { label: '出发日期', type: 'date', value: '' },
        { label: '返回日期', type: 'date', value: '' },
        { label: '行程安排', type: 'textarea', value: '' },
        { label: '必备物品', type: 'textarea', value: '' }
      ]
    },
    {
      id: 'tpl_movie',
      name: '观影记录',
      icon: '🎬',
      category: '娱乐',
      description: '记录观影感受和评价',
      fields: [
        { label: '电影名', type: 'text', value: '' },
        { label: '导演', type: 'text', value: '' },
        { label: '评分', type: 'text', value: '⭐⭐⭐⭐⭐' },
        { label: '观影地点', type: 'text', value: '' },
        { label: '影评', type: 'textarea', value: '' }
      ]
    }
  ],

  /**
   * 初始化插件
   */
  async init() {
    console.log('[TemplatesPlugin] Initializing...');
    
    // 加载模板
    await this._loadTemplates();
    
    this.routes = [
      {
        path: 'templates',
        title: '模板库',
        component: 'templates-view'
      }
    ];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[TemplatesPlugin] Starting...');
    this._bindEvents();
    this._render();
  },

  /**
   * 停止插件
   */
  stop() {
    console.log('[TemplatesPlugin] Stopping...');
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
   * 加载模板
   * @private
   */
  async _loadTemplates() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this._templates = JSON.parse(saved);
      } else {
        this._templates = [...this.DEFAULT_TEMPLATES];
        await this._saveTemplates();
      }
    } catch (error) {
      console.error('[TemplatesPlugin] Load failed:', error);
      this._templates = [...this.DEFAULT_TEMPLATES];
    }
  },

  /**
   * 保存模板
   * @private
   */
  async _saveTemplates() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._templates));
    } catch (error) {
      console.error('[TemplatesPlugin] Save failed:', error);
    }
  },

  /**
   * 渲染模板库
   * @private
   */
  _render() {
    const container = document.getElementById('templates-container');
    if (!container) return;

    if (this._templates.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>还没有模板</p>
          <button class="btn-primary" data-action="add-template">+ 创建模板</button>
        </div>
      `;
      return;
    }

    // 按分类分组
    const groups = {};
    this._templates.forEach(tpl => {
      const cat = tpl.category || '其他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tpl);
    });

    let html = `<div class="templates-library">`;
    
    Object.keys(groups).forEach(category => {
      html += `<div class="template-category">
        <h3 class="template-category-title">${category}</h3>
        <div class="template-grid">`;
      
      groups[category].forEach(tpl => {
        html += this._renderTemplateCard(tpl);
      });
      
      html += `</div></div>`;
    });
    
    html += `</div>`;
    container.innerHTML = html;
  },

  /**
   * 渲染模板卡片
   * @param {Object} tpl
   * @returns {string}
   * @private
   */
  _renderTemplateCard(tpl) {
    return `
      <div class="template-card" data-id="${tpl.id}">
        <div class="template-card-icon">${tpl.icon || '📝'}</div>
        <h4 class="template-card-name">${this._escapeHtml(tpl.name)}</h4>
        <p class="template-card-desc">${this._escapeHtml(tpl.description || '')}</p>
        <div class="template-card-actions">
          <button class="template-btn-use" data-action="use-template" data-id="${tpl.id}">使用</button>
          <button class="template-btn-edit" data-action="edit-template" data-id="${tpl.id}">编辑</button>
        </div>
      </div>
    `;
  },

  /**
   * 使用模板创建记录
   * @param {string} templateId
   * @private
   */
  async _useTemplate(templateId) {
    const tpl = this._templates.find(t => t.id === templateId);
    if (!tpl) return;

    // 构建记录内容
    let notes = '';
    tpl.fields.forEach(field => {
      notes += `**${field.label}**\n${field.value || '(未填写)'}\n\n`;
    });

    // 创建记录
    if (window.RecordsPlugin) {
      await RecordsPlugin.createRecord({
        name: tpl.name,
        tags: [tpl.category || '模板'],
        notes: notes.trim(),
        photos: []
      });
      
      this._showToast('已使用模板创建记录');
      
      // 跳转到首页
      if (window.Router) {
        Router.navigate('home');
      }
    }
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const container = document.getElementById('templates-container');
    if (!container) return;

    // 事件委托
    container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (target) {
        const action = target.dataset.action;
        const id = target.dataset.id;
        
        switch (action) {
          case 'use-template':
            this._useTemplate(id);
            break;
          case 'edit-template':
            this._showToast('编辑功能开发中');
            break;
          case 'add-template':
            this._showToast('创建模板功能开发中');
            break;
        }
      }
    });
  },

  /**
   * HTML 转义
   * @private
   */
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * 显示 Toast
   * @private
   */
  _showToast(message) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(message, { duration: 2000 });
    } else if (window.App) {
      App.showToast(message);
    }
  }
};

// 全局暴露
window.TemplatesPlugin = TemplatesPlugin;

console.log('[TemplatesPlugin] 模板插件已定义');
