/**
 * 万物手札 H5 - 模板系统模块
 * 提供预设模板和自定义模板功能
 * 版本：v3.2.0
 */

const TemplateManager = {
  STORAGE_KEY: 'journal_templates',
  _eventsBound: false,
  _templatesChanged: false, // 标记模板是否被修改过
  
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
      icon: '📖',
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
        { label: '必备物品', type: 'textarea', value: '' },
        { label: '预算', type: 'text', value: '' }
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
    },
    {
      id: 'tpl_meeting',
      name: '会议纪要',
      icon: '📋',
      category: '工作',
      description: '记录会议内容和待办事项',
      fields: [
        { label: '会议主题', type: 'text', value: '' },
        { label: '参会人员', type: 'text', value: '' },
        { label: '会议时间', type: 'text', value: '' },
        { label: '会议内容', type: 'textarea', value: '' },
        { label: '待办事项', type: 'textarea', value: '' }
      ]
    }
  ],
  
  /**
   * 初始化模板系统
   */
  init() {
    this._ensureDefaults();
    this.renderTemplateSelector();
    this.bindEvents();
  },
  
  /**
   * 确保默认模板存在
   */
  _ensureDefaults() {
    const custom = this.getCustomTemplates();
    const existingIds = custom.map(t => t.id);
    
    // 合并默认模板（去重）
    const defaults = this.DEFAULT_TEMPLATES.filter(t => !existingIds.includes(t.id));
    if (defaults.length > 0) {
      this.saveTemplates([...defaults, ...custom]);
    }
  },
  
  /**
   * 获取所有模板
   */
  getAllTemplates() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return [...this.DEFAULT_TEMPLATES];
      }
    }
    return [...this.DEFAULT_TEMPLATES];
  },
  
  /**
   * 获取自定义模板（排除内置）
   */
  getCustomTemplates() {
    const all = this.getAllTemplates();
    const defaultIds = this.DEFAULT_TEMPLATES.map(t => t.id);
    return all.filter(t => !defaultIds.includes(t.id));
  },
  
  /**
   * 保存模板列表
   */
  saveTemplates(templates) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
  },
  
  /**
   * 根据 ID 获取模板
   */
  getTemplate(id) {
    return this.getAllTemplates().find(t => t.id === id);
  },
  
  /**
   * 添加自定义模板
   */
  addCustomTemplate(template) {
    const all = this.getAllTemplates();
    template.id = 'tpl_custom_' + Date.now();
    all.push(template);
    this.saveTemplates(all);
    this.renderTemplateSelector();
    return template;
  },
  
  /**
   * 删除模板
   */
  deleteTemplate(id) {
    const defaultIds = this.DEFAULT_TEMPLATES.map(t => t.id);
    if (defaultIds.includes(id)) return false; // 不允许删除内置模板
    
    const all = this.getAllTemplates().filter(t => t.id !== id);
    this.saveTemplates(all);
    this.renderTemplateSelector();
    return true;
  },
  
  /**
   * 应用模板到表单
   */
  applyTemplate(id) {
    const template = this.getTemplate(id);
    if (!template) return;
    
    // 将分类转为标签 (兼容旧模板)
    if (template.category) {
      if (window.TagManager) {
        TagManager.addTag(template.category);
      }
    }
    
    // 构建备注内容 (富文本编辑器)
    const richEditor = document.getElementById('create-rich-content');
    if (richEditor && template.fields) {
      const html = template.fields.map(f => {
        const label = f.label || '';
        const value = f.value || '';
        return `<p><strong>${label}:</strong> ${value}</p>`;
      }).join('\n');
      richEditor.innerHTML = html;
    }
    
    // 设置名称
    const nameEl = document.getElementById('create-name');
    if (nameEl && template.name) {
      nameEl.value = template.name;
    }
    
    // 触发草稿保存
    if (window.DraftManager) {
      DraftManager.saveDraft();
    }
    
    // 隐藏模板选择器
    this.hideTemplateSelector();
    
    // 提示
    if (window.App) {
      App.showToast(`已应用模板: ${template.icon} ${template.name}`);
    }
  },
  
  /**
   * 将当前表单保存为模板
   */
  saveCurrentAsTemplate(name, icon, category) {
    const richEditor = document.getElementById('create-rich-content');
    const nameEl = document.getElementById('create-name');
    
    // 从富文本编辑器解析字段
    const fields = [];
    if (richEditor) {
      const paragraphs = richEditor.querySelectorAll('p');
      paragraphs.forEach(p => {
        const strong = p.querySelector('strong');
        if (strong) {
          const label = strong.textContent.replace(':', '').trim();
          // 获取 strong 后面的文本
          let value = '';
          const nextSibling = strong.nextSibling;
          if (nextSibling) {
            value = nextSibling.textContent.trim();
          }
          fields.push({
            label,
            type: 'textarea',
            value
          });
        } else {
          fields.push({ label: '', type: 'textarea', value: p.textContent.trim() });
        }
      });
    }
    
    const template = {
      name: name || nameEl?.value || '未命名模板',
      icon: icon || '📝',
      category: category || '',
      description: '自定义模板',
      fields
    };
    
    return this.addCustomTemplate(template);
  },
  
  /**
   * 渲染模板选择器
   */
  renderTemplateSelector() {
    const container = document.getElementById('template-selector');
    if (!container) return;
    
    const templates = this.getAllTemplates();
    
    container.innerHTML = `
      <div class="template-header">
        <span>📋 使用模板快速创建</span>
        <button class="template-close-btn" id="template-close-btn">×</button>
      </div>
      <div class="template-list">
        ${templates.map(t => `
          <div class="template-card" data-id="${t.id}">
            <span class="template-icon">${t.icon || '📝'}</span>
            <div class="template-info">
              <span class="template-name">${this._escapeHtml(t.name)}</span>
              <span class="template-desc">${this._escapeHtml(t.description || '')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },
  
  /**
   * 显示模板选择器
   */
  showTemplateSelector() {
    const container = document.getElementById('template-selector');
    if (container) {
      container.style.display = 'block';
      this.renderTemplateSelector();
    }
  },
  
  /**
   * 隐藏模板选择器
   */
  hideTemplateSelector() {
    const container = document.getElementById('template-selector');
    if (container) {
      container.style.display = 'none';
    }
  },
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // 防止重复绑定
    if (this._eventsBound) return;
    this._eventsBound = true;
    
    const container = document.getElementById('template-selector');
    if (!container) return;
    
    container.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('#template-close-btn');
      const templateCard = e.target.closest('.template-card');
      
      if (closeBtn) {
        this.hideTemplateSelector();
        return;
      }
      
      if (templateCard) {
        const id = templateCard.dataset.id;
        if (id) this.applyTemplate(id);
      }
    });
  },
  
  /**
   * HTML 转义
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  // ==================== 模板管理功能 ====================
  
  /**
   * 显示模板管理页面
   */
  showTemplateManager() {
    const container = document.getElementById('template-manager-container');
    if (!container) return;
    
    const templates = this.getAllTemplates();
    
    if (templates.length === 0) {
      container.innerHTML = `
        <div class="template-manager-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <p>暂无模板</p>
          <p class="hint">在表单页使用"保存为模板"创建您的第一个模板</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="template-manager-list">
        ${templates.map(t => {
          const isDefault = t.id.startsWith('tpl_');
          return `
          <div class="template-manager-card" data-id="${t.id}">
            <div class="template-card-header">
              <span class="template-icon">${t.icon || ''}</span>
              <div class="template-card-info">
                <span class="template-name">${this._escapeHtml(t.name)}</span>
                <span class="template-category">${this._escapeHtml(t.category || '未分类')}</span>
              </div>
            </div>
            <p class="template-desc">${this._escapeHtml(t.description || '')}</p>
            <div class="template-card-actions">
              <button class="btn-sm btn-use" data-action="use" data-id="${t.id}">使用</button>
              ${!isDefault ? `<button class="btn-sm btn-delete" data-action="delete" data-id="${t.id}">删除</button>` : ''}
            </div>
          </div>
        `}).join('')}
      </div>
    `;
  },
  
  /**
   * 删除模板
   */
  deleteTemplate(id) {
    if (!confirm('确定要删除这个模板吗？')) return;
    
    const custom = this.getCustomTemplates();
    const filtered = custom.filter(t => t.id !== id);
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      this._templatesChanged = true;
      
      // 刷新管理页面
      this.showTemplateManager();
      
      if (window.App) {
        App.showToast('模板已删除');
      }
    } catch (e) {
      console.error('删除模板失败:', e);
      if (window.App) {
        App.showToast('删除失败');
      }
    }
  },
  
  /**
   * 绑定模板管理页面事件
   */

  /**
   * 渲染模板快捷列表 (Bottom Sheet)
   */
  renderTemplateSheet() {
    const container = document.getElementById('template-sheet-list');
    if (!container) return;
    
    const templates = this.getAllTemplates();
    if (templates.length === 0) {
      container.innerHTML = '<p class="empty-hint" style="text-align:center;color:#999;padding:20px;">暂无模板</p>';
      return;
    }
    
    container.innerHTML = templates.map(t => `
      <div class="template-sheet-item" data-id="${t.id}">
        <h4>${t.icon || '📝'} ${this._escapeHtml(t.name)}</h4>
        <p>${this._escapeHtml(t.description || '')}</p>
      </div>
    `).join('');
    
    // 绑定点击事件
    container.querySelectorAll('.template-sheet-item').forEach(el => {
      el.addEventListener('click', () => {
        this.applyTemplate(el.dataset.id);
        this.closeTemplateSheet();
      });
    });
  },

  /**
   * 打开模板抽屉
   */
  openTemplateSheet() {
    this.renderTemplateSheet();
    const sheet = document.getElementById('template-bottom-sheet');
    if (sheet) sheet.classList.add('active');
  },

  /**
   * 关闭模板抽屉
   */
  closeTemplateSheet() {
    const sheet = document.getElementById('template-bottom-sheet');
    if (sheet) sheet.classList.remove('active');
  },

  /**
   * 保存当前表单为模板
   */
  saveCurrentAsTemplateWrapper() {
    // 从表单获取名称和备注
    const name = document.getElementById('create-name')?.value || '未命名';
    const richEditor = document.getElementById('create-rich-content');
    if (!richEditor || !richEditor.innerHTML.trim()) {
        if (window.App) App.showToast('请先填写备注内容');
        return;
    }
    
    const tplName = prompt('模板名称:', name);
    if (!tplName) return;
    
    const tplIcon = prompt('模板图标 (Emoji):', '📝') || '📝';
    
    // 构建字段
    const fields = [];
    const paragraphs = richEditor.querySelectorAll('p');
    paragraphs.forEach(p => {
        const strong = p.querySelector('strong');
        if (strong) {
            fields.push({
                label: strong.textContent.replace(':', ''),
                type: 'text',
                value: strong.nextSibling ? strong.nextSibling.textContent.trim() : ''
            });
        }
    });

    this.addCustomTemplate({
        name: tplName,
        icon: tplIcon,
        description: '自定义',
        fields: fields.length > 0 ? fields : [{label: '内容', type: 'textarea', value: richEditor.innerHTML}]
    });
    
    if (window.App) App.showToast('✅ 模板已保存');
  }

  bindTemplateManagerEvents() {
    const container = document.getElementById('template-manager-container');
    if (!container) return;
    
    container.addEventListener('click', (e) => {
      const useBtn = e.target.closest('[data-action="use"]');
      const deleteBtn = e.target.closest('[data-action="delete"]');
      
      if (useBtn) {
        const id = useBtn.dataset.id;
        this.applyTemplate(id);
        if (window.App) {
          App.switchPage('form');
        }
        return;
      }
      
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        this.deleteTemplate(id);
        return;
      }
    });
  },
  
  /**
   * 显示保存模板对话框
   */
  showSaveTemplateModal() {
    const richEditor = document.getElementById('create-rich-content');
    const nameEl = document.getElementById('create-name');
    
    if (!richEditor || !richEditor.innerHTML.trim()) {
      if (window.App) {
        App.showToast('请先填写备注内容再保存为模板');
      }
      return;
    }
    
    const name = prompt('请输入模板名称:', nameEl?.value || '我的模板');
    if (!name) return;
    
    const icon = prompt('请输入模板图标 (emoji):', '') || '📝';
    const category = prompt('请输入模板分类:', '自定义') || '自定义';
    
    this.saveCurrentAsTemplate(name, icon, category);
    
    if (window.App) {
      App.showToast('模板已保存');
    }
  },
  
  /**
   * 显示模板管理页
   */
  showTemplateManager() {
    const container = document.getElementById('template-manager-container');
    if (!container) return;
    
    const templates = this.getAllTemplates();
    const defaultIds = this.DEFAULT_TEMPLATES.map(t => t.id);
    
    let html = '<div class="template-manager-list">';
    
    templates.forEach(t => {
      const isDefault = defaultIds.includes(t.id);
      html += `
        <div class="template-manager-item" data-id="${t.id}">
          <span class="template-item-icon">${t.icon || '📝'}</span>
          <div class="template-item-info">
            <div class="template-item-name">${this._escapeHtml(t.name)}</div>
            <div class="template-item-desc">${this._escapeHtml(t.description || '')}</div>
          </div>
          <div class="template-item-actions">
            <button class="btn-sm btn-use" data-action="use" data-id="${t.id}">使用</button>
            ${!isDefault ? `<button class="btn-sm btn-delete" data-action="delete" data-id="${t.id}">删除</button>` : ''}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    html += '<button class="btn-add-template" id="btn-add-template"><span>+</span> 新增模板</button>';
    
    container.innerHTML = html;
  },
  
  /**
   * 绑定模板管理页事件
   */

  /**
   * 渲染模板快捷列表 (Bottom Sheet)
   */
  renderTemplateSheet() {
    const container = document.getElementById('template-sheet-list');
    if (!container) return;
    
    const templates = this.getAllTemplates();
    if (templates.length === 0) {
      container.innerHTML = '<p class="empty-hint" style="text-align:center;color:#999;padding:20px;">暂无模板</p>';
      return;
    }
    
    container.innerHTML = templates.map(t => `
      <div class="template-sheet-item" data-id="${t.id}">
        <h4>${t.icon || '📝'} ${this._escapeHtml(t.name)}</h4>
        <p>${this._escapeHtml(t.description || '')}</p>
      </div>
    `).join('');
    
    // 绑定点击事件
    container.querySelectorAll('.template-sheet-item').forEach(el => {
      el.addEventListener('click', () => {
        this.applyTemplate(el.dataset.id);
        this.closeTemplateSheet();
      });
    });
  },

  /**
   * 打开模板抽屉
   */
  openTemplateSheet() {
    this.renderTemplateSheet();
    const sheet = document.getElementById('template-bottom-sheet');
    if (sheet) sheet.classList.add('active');
  },

  /**
   * 关闭模板抽屉
   */
  closeTemplateSheet() {
    const sheet = document.getElementById('template-bottom-sheet');
    if (sheet) sheet.classList.remove('active');
  },

  /**
   * 保存当前表单为模板
   */
  saveCurrentAsTemplateWrapper() {
    // 从表单获取名称和备注
    const name = document.getElementById('create-name')?.value || '未命名';
    const richEditor = document.getElementById('create-rich-content');
    if (!richEditor || !richEditor.innerHTML.trim()) {
        if (window.App) App.showToast('请先填写备注内容');
        return;
    }
    
    const tplName = prompt('模板名称:', name);
    if (!tplName) return;
    
    const tplIcon = prompt('模板图标 (Emoji):', '📝') || '📝';
    
    // 构建字段
    const fields = [];
    const paragraphs = richEditor.querySelectorAll('p');
    paragraphs.forEach(p => {
        const strong = p.querySelector('strong');
        if (strong) {
            fields.push({
                label: strong.textContent.replace(':', ''),
                type: 'text',
                value: strong.nextSibling ? strong.nextSibling.textContent.trim() : ''
            });
        }
    });

    this.addCustomTemplate({
        name: tplName,
        icon: tplIcon,
        description: '自定义',
        fields: fields.length > 0 ? fields : [{label: '内容', type: 'textarea', value: richEditor.innerHTML}]
    });
    
    if (window.App) App.showToast('✅ 模板已保存');
  }

  bindTemplateManagerEvents() {
    // 使用全局事件委托，避免重复绑定
    if (this._managerEventsBound) return;
    this._managerEventsBound = true;
    
    const container = document.getElementById('template-manager-container');
    if (!container) return;
    
    container.addEventListener('click', (e) => {
      const useBtn = e.target.closest('[data-action="use"]');
      if (useBtn) {
        this.applyTemplate(useBtn.dataset.id);
        if (window.App) {
          App.switchPage('form');
        }
        return;
      }
      
      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        if (confirm('确定删除此模板？')) {
          this.deleteTemplate(deleteBtn.dataset.id);
          this.showTemplateManager(); // 重新渲染
        }
        return;
      }
    });
    
    // 新增模板按钮
    const addBtn = document.getElementById('btn-add-template');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (window.App) {
          App.switchPage('form');
        }
        // 提示用户填写内容后保存为模板
        setTimeout(() => {
          this.showSaveTemplateModal();
        }, 300);
      });
    }
  }
};

// 全局导出
window.TemplateManager = TemplateManager;
