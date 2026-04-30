/**
 * Editor Plugin - 编辑器插件
 * 提供记录的新建和编辑功能
 * @version 6.1.0
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

    // 延迟到下一个微任务执行，确保 legacy App 的 resetForm() 先完成
    // （legacy App 和 v6 都绑定了 FAB 按钮，legacy 后绑定但会先清空表单）
    Promise.resolve().then(() => {
      this._populateForm();
      this._bindEvents();
    });
  },

  /**
   * 填充已有表单字段（复用 #page-form 中的表单）
   * @private
   */
  _populateForm() {
    const record = this._currentRecord;
    if (!record) return;

    // 更新标题
    const titleEl = document.getElementById('create-title');
    if (titleEl) titleEl.textContent = this._isEditing ? '编辑记录' : '新建记录';

    // 名称
    const nameEl = document.getElementById('create-name');
    if (nameEl) nameEl.value = record.name || '';

    // 标签
    const tagsEl = document.getElementById('create-tags');
    if (tagsEl) tagsEl.value = (record.tags || []).join(', ');

    // 备注 (contenteditable div)
    const notesEl = document.getElementById('create-rich-content');
    if (notesEl) notesEl.innerHTML = this._escapeHtml(record.notes || '');

    // 状态
    const statusEl = document.getElementById('create-status');
    if (statusEl) statusEl.value = record.status || 'in-use';

    // 日期
    const dateEl = document.getElementById('create-date');
    if (dateEl && record.createdAt) {
      const d = new Date(record.createdAt);
      dateEl.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // 照片预览
    this._photos = [...(record.photos || [])];
    const preview = document.getElementById('photo-preview');
    if (preview && this._photos.length > 0) {
      preview.innerHTML = this._photos.map((photo, idx) => `
        <div class="photo-preview-item">
          <img src="${photo}" alt="预览" />
          <button type="button" class="photo-remove" data-idx="${idx}">×</button>
        </div>
      `).join('');
    }

    // 设置 App.editingId 以便 legacy 表单能正确更新
    if (window.App && this._currentRecord?.id) {
      window.App.editingId = this._currentRecord.id;
    }
  },

  /**
   * 绑定事件（监听自动保存草稿）
   * @private
   */
  _bindEvents() {
    const container = document.getElementById('page-form');
    if (!container) return;

    // 自动保存草稿（监听 legacy 表单字段）
    const nameInput = document.getElementById('create-name');
    const notesInput = document.getElementById('create-rich-content');

    if (nameInput) {
      nameInput.addEventListener('input', () => this._autoSave());
    }
    if (notesInput) {
      notesInput.addEventListener('input', () => this._autoSave());
    }
  },

  /**
   * 自动保存草稿
   * @private
   */
  _autoSave() {
    const name = document.getElementById('create-name')?.value;
    const notes = document.getElementById('create-rich-content')?.innerHTML;

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
