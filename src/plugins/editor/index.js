/**
 * Editor Plugin - 编辑器插件
 * 提供记录的新建和编辑功能
 * @version 6.0.0
 */

// 幂等加载保护
if (!window.EditorPlugin) {
const EditorPlugin = {
  name: 'editor',
  version: '1.0.0',
  dependencies: ['records'],
  
  _currentRecord: null,
  _isEditing: false,
  _photos: [],
  _eventsBound: false,

  /**
   * 初始化插件
   */
  async init() {
    console.log('[EditorPlugin] Initializing...');
    
    this.routes = [
      {
        path: 'editor',
        title: '编辑记录',
        component: 'record-editor',
        guard: () => true
      }
    ];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[EditorPlugin] Starting...');
    this._bindEvents();
    
    // 监听路由变化，自动加载记录
    if (window.Router) {
      window.Router.subscribe(route => {
        if (route && route.path === 'editor') {
          this._loadRecord(route.params);
        }
      });
    }
  },

  /**
   * 停止插件
   */
  stop() {
    console.log('[EditorPlugin] Stopping...');
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
   * 加载记录 (新建或编辑)
   * @param {Object} params - 路由参数 { id, mode, date }
   * @private
   */
  async _loadRecord(params) {
    const { id, mode, date } = params || {};
    
    this._isEditing = !!id;
    this._photos = [];

    if (id) {
      // 编辑模式：从 Store 加载
      const records = window.Store ? window.Store.getState('records.list') : [];
      this._currentRecord = records.find(r => r.id === id);
    } else {
      // 新建模式：创建空记录
      this._currentRecord = {
        id: null,
        name: '',
        tags: [],
        notes: '',
        photos: [],
        location: null,
        favorite: false,
        status: 'active',
        createdAt: date ? new Date(date).getTime() : Date.now(),
        updatedAt: Date.now()
      };
    }

    this._render();
  },

  /**
   * 渲染编辑器
   * @private
   */
  _render() {
    const container = document.getElementById('editor-container');
    if (!container) return;

    const record = this._currentRecord;
    if (!record) return;

    container.innerHTML = `
      <div class="editor-header">
        <button class="editor-back-btn" data-action="back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"></path>
          </svg>
          返回
        </button>
        <h2>${this._isEditing ? '编辑记录' : '新建记录'}</h2>
        <button class="editor-save-btn" data-action="save">保存</button>
      </div>
      
      <div class="editor-body">
        <div class="editor-field">
          <label>名称</label>
          <input type="text" id="editor-name" value="${this._escapeHtml(record.name || '')}" placeholder="给这条记录起个名字..." />
        </div>
        
        <div class="editor-field">
          <label>标签 (用逗号分隔)</label>
          <input type="text" id="editor-tags" value="${(record.tags || []).join(', ')}" placeholder="例如：生活，旅行，美食" />
        </div>
        
        <div class="editor-field">
          <label>备注</label>
          <textarea id="editor-notes" rows="5" placeholder="记录你的想法...">${this._escapeHtml(record.notes || '')}</textarea>
        </div>
        
        <div class="editor-field">
          <label>照片</label>
          <div class="editor-photos" id="editor-photos">
            ${(record.photos || []).map((photo, index) => `
              <div class="editor-photo-item" data-index="${index}">
                <img src="${photo}" alt="Photo ${index + 1}" />
                <button class="editor-photo-remove" data-action="remove-photo" data-index="${index}">×</button>
              </div>
            `).join('')}
            <label class="editor-photo-add">
              <input type="file" id="editor-photo-input" accept="image/*" multiple style="display: none;" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>添加照片</span>
            </label>
          </div>
        </div>
        
        <div class="editor-field">
          <label>
            <input type="checkbox" id="editor-favorite" ${record.favorite ? 'checked' : ''} />
            收藏
          </label>
        </div>
      </div>
    `;

    this._bindPhotoEvents();
  },

  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const container = document.getElementById('editor-container');
    if (!container) return;

    // 事件委托
    container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (target) {
        const action = target.dataset.action;
        const index = target.dataset.index ? parseInt(target.dataset.index) : null;
        this._handleAction(action, index);
      }
    });

    // 自动保存草稿
    const nameInput = document.getElementById('editor-name');
    const notesInput = document.getElementById('editor-notes');
    
    if (nameInput) {
      nameInput.addEventListener('input', () => this._autoSave());
    }
    if (notesInput) {
      notesInput.addEventListener('input', () => this._autoSave());
    }
  },

  /**
   * 绑定照片事件
   * @private
   */
  _bindPhotoEvents() {
    const photoInput = document.getElementById('editor-photo-input');
    if (photoInput) {
      photoInput.addEventListener('change', (e) => this._handlePhotoUpload(e));
    }
  },

  /**
   * 处理操作
   * @param {string} action
   * @param {number|null} index
   * @private
   */
  _handleAction(action, index) {
    switch (action) {
      case 'back':
        if (window.Router) {
          window.Router.back();
        }
        break;
      case 'save':
        this._saveRecord();
        break;
      case 'remove-photo':
        if (index !== null) {
          this._removePhoto(index);
        }
        break;
    }
  },

  /**
   * 保存记录
   * @private
   */
  async _saveRecord() {
    const name = document.getElementById('editor-name')?.value.trim();
    const tagsStr = document.getElementById('editor-tags')?.value.trim();
    const notes = document.getElementById('editor-notes')?.value.trim();
    const favorite = document.getElementById('editor-favorite')?.checked;

    if (!name) {
      this._showToast('请输入记录名称');
      return;
    }

    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];

    const recordData = {
      name,
      tags,
      notes,
      photos: [...this._photos],
      favorite: !!favorite,
      updatedAt: Date.now()
    };

    try {
      if (window.RecordsPlugin) {
        if (this._isEditing && this._currentRecord?.id) {
          await RecordsPlugin.updateRecord(this._currentRecord.id, recordData);
          this._showToast('记录已更新');
        } else {
          const newRecord = await RecordsPlugin.createRecord({
            ...recordData,
            createdAt: Date.now()
          });
          this._currentRecord = newRecord;
          this._isEditing = true;
          this._showToast('记录已创建');
        }

        // 返回上一页
        setTimeout(() => {
          if (window.Router) {
            window.Router.back();
          }
        }, 500);
      }
    } catch (error) {
      console.error('[EditorPlugin] Save failed:', error);
      this._showToast('保存失败：' + error.message);
    }
  },

  /**
   * 处理照片上传
   * @param {Event} event
   * @private
   */
  async _handlePhotoUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    this._showToast('正在处理照片...');

    try {
      for (const file of files) {
        const dataUrl = await this._compressImage(file);
        this._photos.push(dataUrl);
      }
      this._render();
      this._showToast(`已添加 ${files.length} 张照片`);
    } catch (error) {
      console.error('[EditorPlugin] Photo upload failed:', error);
      this._showToast('照片处理失败');
    }

    // 重置 input
    event.target.value = '';
  },

  /**
   * 压缩图片
   * @param {File} file
   * @returns {Promise<string>}
   * @private
   */
  _compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 1200;
          const maxHeight = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * 移除照片
   * @param {number} index
   * @private
   */
  _removePhoto(index) {
    this._photos.splice(index, 1);
    this._render();
  },

  /**
   * 自动保存草稿
   * @private
   */
  _autoSave() {
    // 简化实现：仅保存到 localStorage
    // 完整版可集成 DraftManager
    const name = document.getElementById('editor-name')?.value;
    const notes = document.getElementById('editor-notes')?.value;
    
    if (name || notes) {
      localStorage.setItem('editor_draft', JSON.stringify({ name, notes, timestamp: Date.now() }));
    }
  },

  /**
   * 显示 Toast
   * @param {string} message
   * @private
   */
  _showToast(message) {
    if (window.App && typeof App.showToast === 'function') {
      App.showToast(message);
    } else {
      console.log('[EditorPlugin] Toast:', message);
    }
  },

  /**
   * HTML 转义
   * @param {string} str
   * @returns {string}
   * @private
   */
  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// 全局暴露
window.EditorPlugin = EditorPlugin;

console.log('[EditorPlugin] 编辑器插件已定义');
} else {
  console.log('[EditorPlugin] 已存在，跳过加载');
}
