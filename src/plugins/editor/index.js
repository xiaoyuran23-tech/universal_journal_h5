/**
 * Editor Plugin - 编辑器插件 (v2: 富文本编辑器 + 工具栏)
 * 提供记录的新建、编辑、保存功能，内置轻量级富文本工具栏
 * @version 6.2.0
 */

// 幂等加载保护
if (!window.EditorPlugin) {
const EditorPlugin = {
  name: 'editor',
  version: '2.0.0',
  dependencies: ['records'],

  _currentRecord: null,
  _isEditing: false,
  _photos: [],
  _eventsBound: false,
  _autoSaveBound: false,
  _aiEventsBound: false,
  _autoSaveTimer: null,

  // 工具栏按钮配置
  TOOLBAR_ITEMS: [
    { action: 'undo', icon: '↩', title: '撤销 (Ctrl+Z)' },
    { action: 'redo', icon: '↪', title: '重做 (Ctrl+Shift+Z)' },
    { sep: true },
    { cmd: 'bold', icon: 'B', title: '加粗', style: 'font-weight:bold' },
    { cmd: 'italic', icon: 'I', title: '斜体', style: 'font-style:italic' },
    { cmd: 'underline', icon: 'U', title: '下划线', style: 'text-decoration:underline' },
    { cmd: 'strikeThrough', icon: 'S', title: '删除线', style: 'text-decoration:line-through' },
    { sep: true },
    { cmd: 'insertUnorderedList', icon: '•', title: '无序列表' },
    { cmd: 'insertOrderedList', icon: '1.', title: '有序列表' },
    { sep: true },
    { cmd: 'formatBlock', value: 'blockquote', icon: '"', title: '引用' },
    { cmd: 'formatBlock', value: 'h3', icon: 'H', title: '标题' },
    { sep: true },
    { cmd: 'removeFormat', icon: '✕', title: '清除格式' },
  ],

  // AI 工具栏按钮配置
  AI_TOOLBAR_ITEMS: [
    { action: 'ai-summary', icon: '✨ 摘要', title: 'AI 自动生成摘要' },
    { action: 'ai-tags', icon: '🏷️ 标签建议', title: 'AI 推荐标签' },
    { action: 'ai-prompt', icon: '💡 灵感', title: '随机写作灵感' },
  ],

  /**
   * 初始化插件
   */
  async init() {
    console.log('[EditorPlugin] Initializing...');
    this.routes = [
      { path: 'editor', title: '编辑记录', component: 'record-editor', guard: () => true }
    ];
  },

  /**
   * 启动插件
   */
  async start() {
    console.log('[EditorPlugin] Starting...');
    this._bindToolbarEvents();
    this._bindSaveHandler();
    this._bindPhotoEvents();

    if (window.Router) {
      window.Router.subscribe(route => {
        if (route && route.path === 'editor') {
          this._loadRecord(route.params);
        }
      });
    }
  },

  stop() {
    console.log('[EditorPlugin] Stopping...');
    this._eventsBound = false;
  },

  routes: [],
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
      // v7.0.3: 从 IndexedDB 读取最新数据，而非依赖可能过时的 Store
      const StorageBackend = window.StorageBackend || window.StorageService;
      if (StorageBackend) {
        this._currentRecord = await StorageBackend.get(id);
      }
      // 降级方案：回退到 Store
      if (!this._currentRecord && window.Store) {
        const records = window.Store.getState('records.list') || [];
        this._currentRecord = records.find(r => r.id === id);
      }
    } else {
      this._currentRecord = {
        id: null, name: '', tags: [], notes: '', photos: [],
        location: null, favorite: false, status: 'active',
        createdAt: date ? new Date(date).getTime() : Date.now(),
        updatedAt: Date.now()
      };
    }

    Promise.resolve().then(() => {
      this._populateForm();
      this._bindAutoSave();
      this._initEditorToolbar();
      this._initAIToolbar();
      this._initWritingAssistant();
      this._bindAIEvents();
    });
  },

  /**
   * 填充已有表单字段
   * @private
   */
  _populateForm() {
    const record = this._currentRecord;
    if (!record) return;

    const titleEl = document.getElementById('create-title');
    if (titleEl) titleEl.textContent = this._isEditing ? '编辑记录' : '新建记录';

    const nameEl = document.getElementById('create-name');
    if (nameEl) nameEl.value = record.name || '';

    const tagsEl = document.getElementById('create-tags');
    if (tagsEl) tagsEl.value = (record.tags || []).join(', ');

    const notesEl = document.getElementById('create-rich-content');
    if (notesEl) notesEl.innerHTML = this._sanitizeHTML(record.notes || '');

    const statusEl = document.getElementById('create-status');
    if (statusEl) statusEl.value = record.status || 'in-use';

    const dateEl = document.getElementById('create-date');
    if (dateEl && record.createdAt) {
      const d = new Date(record.createdAt);
      dateEl.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

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

    if (window.App && this._currentRecord?.id) {
      window.App.editingId = this._currentRecord.id;
    }
  },

  /**
   * 初始化工具栏 (动态插入 DOM)
   * @private
   */
  _initEditorToolbar() {
    const editor = document.getElementById('create-rich-content');
    if (!editor) return;

    // 移除已存在的工具栏
    const existing = document.getElementById('rich-editor-toolbar');
    if (existing) existing.remove();

    // 创建工具栏
    const toolbar = document.createElement('div');
    toolbar.id = 'rich-editor-toolbar';
    toolbar.className = 'rich-editor-toolbar';

    this.TOOLBAR_ITEMS.forEach(item => {
      if (item.sep) {
        const sep = document.createElement('span');
        sep.className = 'rich-toolbar-sep';
        toolbar.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rich-toolbar-btn';
      btn.title = item.title;
      btn.dataset.cmd = item.cmd;
      if (item.value) btn.dataset.value = item.value;
      btn.innerHTML = item.icon;
      toolbar.appendChild(btn);
    });

    // 插入到编辑器上方
    editor.parentNode.insertBefore(toolbar, editor);
  },

  /**
   * 绑定工具栏事件
   * @private
   */
  _bindToolbarEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.rich-toolbar-btn');
      if (!btn) return;

      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const value = btn.dataset.value || null;
      const action = btn.dataset.action;

      // 处理撤销/重做
      if (action === 'undo' && window.Store) {
        window.Store.undo();
        return;
      }
      if (action === 'redo' && window.Store) {
        window.Store.redo();
        return;
      }

      // 确保编辑器获得焦点
      const editor = document.getElementById('create-rich-content');
      if (editor) editor.focus();

      // 执行格式化命令
      if (cmd === 'formatBlock' && value) {
        document.execCommand(cmd, false, `<${value}>`);
      } else {
        document.execCommand(cmd, false, value);
      }

      this._updateToolbarState();
    });
  },

  /**
   * 更新工具栏按钮激活状态
   * @private
   */
  _updateToolbarState() {
    const toolbar = document.getElementById('rich-editor-toolbar');
    if (!toolbar) return;

    toolbar.querySelectorAll('.rich-toolbar-btn').forEach(btn => {
      const cmd = btn.dataset.cmd;
      let active = false;
      if (cmd === 'formatBlock') {
        active = document.queryCommandValue('formatBlock')?.toLowerCase().includes(btn.dataset.value?.toLowerCase());
      } else {
        active = document.queryCommandState(cmd);
      }
      btn.classList.toggle('active', !!active);
    });
  },

  /**
   * 绑定照片上传事件
   * @private
   */
  _bindPhotoEvents() {
    const photoBtn = document.getElementById('create-photo-btn');
    const photoInput = document.getElementById('create-photo-input');
    if (!photoBtn || !photoInput) return;

    // 按钮点击触发文件选择
    photoBtn.addEventListener('click', () => photoInput.click());

    // 文件选择后处理
    photoInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const progressEl = document.getElementById('photo-upload-progress');
      if (progressEl) progressEl.style.display = 'block';

      let failedCount = 0;
      for (const file of files) {
        try {
          if (window.ImageService) {
            const base64 = await window.ImageService.compress(file, { quality: 0.7 });
            this._photos.push(base64);
          } else {
            // Fallback: read as base64 without compression
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            this._photos.push(base64);
          }
        } catch (err) {
          console.error('[EditorPlugin] Photo compress failed:', err);
          failedCount++;
        }
      }

      this._renderPhotoPreview();
      photoInput.value = ''; // 重置 input

      if (progressEl) {
        setTimeout(() => { progressEl.style.display = 'none'; }, 500);
      }
      if (failedCount > 0) {
        this._showToast(`${failedCount} 张图片处理失败`);
      }
    });

    // 照片删除 (事件委托)
    const preview = document.getElementById('photo-preview');
    if (preview) {
      preview.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.photo-remove');
        if (!removeBtn) return;
        const idx = parseInt(removeBtn.dataset.idx, 10);
        if (!isNaN(idx) && idx >= 0 && idx < this._photos.length) {
          this._photos.splice(idx, 1);
          this._renderPhotoPreview();
        }
      });
    }
  },

  /**
   * 渲染照片预览
   * @private
   */
  _renderPhotoPreview() {
    const preview = document.getElementById('photo-preview');
    const summary = document.getElementById('photo-summary');
    if (!preview) return;

    if (this._photos.length === 0) {
      preview.innerHTML = '';
      if (summary) summary.style.display = 'none';
      return;
    }

    preview.innerHTML = this._photos.map((photo, idx) => `
      <div class="photo-preview-item">
        <img src="${photo}" alt="预览" />
        <button type="button" class="photo-remove" data-idx="${idx}">×</button>
      </div>
    `).join('');

    if (summary) {
      summary.style.display = 'block';
      const countEl = summary.querySelector('.summary-count');
      const savedEl = summary.querySelector('.summary-saved');
      if (countEl) countEl.textContent = this._photos.length;
      if (savedEl) {
        // 计算照片总大小（base64 字符串解码后的实际字节数）
        const totalBytes = this._photos.reduce((sum, photo) => {
          // base64 格式: data:image/xxx;base64,YYYYYYY
          const base64Data = photo.includes(',') ? photo.split(',')[1] : photo;
          // 每 4 个 base64 字符 = 3 字节，减去末尾 = 填充
          const padding = (base64Data.match(/=/g) || []).length;
          return sum + Math.floor((base64Data.length * 3) / 4) - padding;
        }, 0);
        const kb = (totalBytes / 1024).toFixed(1);
        savedEl.textContent = `${kb} KB`;
      }
    }
  },

  /**
   * 绑定自动保存
   * @private
   */
  _bindAutoSave() {
    // v7.0.3: 防止每次加载记录时累积事件监听器
    if (this._autoSaveBound) return;
    this._autoSaveBound = true;

    const nameInput = document.getElementById('create-name');
    const notesInput = document.getElementById('create-rich-content');

    if (nameInput) nameInput.addEventListener('input', () => this._autoSave());
    if (notesInput) notesInput.addEventListener('input', () => this._autoSave());
  },

  /**
   * 绑定保存按钮
   * @private
   */
  _bindSaveHandler() {
    const saveBtn = document.getElementById('create-save-btn');
    if (!saveBtn) return;

    // 移除旧的事件监听 (防止重复绑定)
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.addEventListener('click', async () => {
      await this._saveRecord();
    });
  },

  /**
   * 保存记录
   * @private
   */
  async _saveRecord() {
    const name = document.getElementById('create-name')?.value?.trim();
    const notes = document.getElementById('create-rich-content')?.innerHTML || '';
    const tagsStr = document.getElementById('create-tags')?.value || '';
    const status = document.getElementById('create-status')?.value || 'in-use';
    const dateStr = document.getElementById('create-date')?.value;

    if (!name && !notes) {
      this._showToast('请至少填写名称或备注');
      return;
    }

    // 解析标签
    const tags = tagsStr.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);

    // XSS 过滤: 清理 notes 中的危险标签
    const cleanNotes = this._sanitizeHTML(notes);

    const now = Date.now();
    const baseRecord = {
      id: this._currentRecord?.id || `rec_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: name || '未命名记录',
      tags,
      notes: cleanNotes,
      photos: this._photos,
      location: this._currentRecord?.location || null,
      favorite: this._currentRecord?.favorite || false,
      status,
      createdAt: this._currentRecord?.createdAt || now,
      updatedAt: now
    };

    // 自动提取元数据
    const metadata = window.MetadataService ? window.MetadataService.extract(baseRecord) : {};

    // P2-1: 自动解析 blocks
    const blocks = window.BlockParser ? window.BlockParser.parseBlocks(cleanNotes) : [];

    // P2-2: 自动解析双向链接
    const allRecords = window.Store ? (window.Store.getState('records.list') || []) : [];
    const links = window.LinkParser ? window.LinkParser.parseLinks(cleanNotes, allRecords, baseRecord.id) : [];
    // 填充 sourceName
    links.forEach(link => { link.sourceName = baseRecord.name; });

    const record = { ...baseRecord, metadata, blocks, links };

    // v7.0: 保存心情 (从 todayMood 获取)
    const todayMood = window.MoodService?.getTodayMood();
    if (todayMood) record.mood = todayMood.mood;

    try {
      // 保存到 IndexedDB
      if (window.StorageBackend) {
        await window.StorageBackend.put(record);
      } else if (window.StorageService) {
        await window.StorageService.put(record);
      }

      // 更新 Store (使用专用 action 类型)
      if (window.Store) {
        if (this._isEditing) {
          window.Store.dispatch({
            type: 'records/update',
            payload: { id: record.id, updates: record }
          });
        } else {
          window.Store.dispatch({
            type: 'records/add',
            payload: record
          });
        }
      }

      // 清除草稿
      localStorage.removeItem('editor_draft');
      if (window.DraftPlugin) DraftPlugin.clearDraft();

      // v7.0: 更新连续记录天数
      const dateStr = document.getElementById('create-date')?.value;
      window.StreakService?.recordToday(dateStr);

      // v7.0: 记录变更用于自动同步
      window.AutoSyncPlugin?.recordChange(this._isEditing ? 'update' : 'create', record);

      this._showToast(this._isEditing ? '记录已更新' : '记录已保存');

      // 返回列表页
      if (window.Router) {
        setTimeout(() => window.Router.navigate('home'), 500);
      }
    } catch (error) {
      console.error('[EditorPlugin] Save failed:', error);
      this._showToast('保存失败: ' + error.message);
    }
  },

  /**
   * 自动保存草稿
   * @private
   */
  _autoSave() {
    // v7.0.3: 添加防抖，避免每次按键都写 localStorage
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      const name = document.getElementById('create-name')?.value;
      const notes = document.getElementById('create-rich-content')?.innerHTML;
      if (name || notes) {
        localStorage.setItem('editor_draft', JSON.stringify({ name, notes, timestamp: Date.now() }));
      }
    }, 1000);
  },

  /**
   * XSS 过滤: 清理危险标签和属性
   * @param {string} html
   * @returns {string}
   * @private
   */
  _sanitizeHTML(html) {
    if (!html) return '';

    // Pre-filter: strip javascript: URIs (including obfuscated whitespace variants)
    html = html.replace(/javascript\s*:/gi, '');

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 移除危险标签
    const dangerous = doc.querySelectorAll('script, iframe, object, embed, link, style, form, input, button, select, textarea');
    dangerous.forEach(el => el.remove());

    // 移除所有元素的事件属性和 javascript: 链接
    const allEls = doc.body.querySelectorAll('*');
    allEls.forEach(el => {
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const name = attrs[i].name.toLowerCase();
        const value = attrs[i].value;
        if (name.startsWith('on') || value.toLowerCase().startsWith('javascript:')) {
          el.removeAttribute(attrs[i].name);
        }
      }
    });

    return doc.body.innerHTML;
  },

  /**
   * 初始化 AI 工具栏 (在富文本工具栏后追加)
   * @private
   */
  _initAIToolbar() {
    const toolbar = document.getElementById('rich-editor-toolbar');
    if (!toolbar || !window.AILiteService) return;

    // 移除已有的 AI 工具栏
    const existing = document.getElementById('ai-editor-toolbar');
    if (existing) existing.remove();

    const aiToolbar = document.createElement('div');
    aiToolbar.id = 'ai-editor-toolbar';
    aiToolbar.className = 'ai-editor-toolbar';

    this.AI_TOOLBAR_ITEMS.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-toolbar-btn';
      btn.title = item.title;
      btn.dataset.action = item.action;
      btn.innerHTML = item.icon;
      aiToolbar.appendChild(btn);
    });

    toolbar.parentNode.insertBefore(aiToolbar, toolbar.nextSibling);
  },

  /**
   * 初始化写作助手面板
   * @private
   */
  _initWritingAssistant() {
    if (!window.AILiteService) return;

    const existing = document.getElementById('writing-assistant');
    if (existing) existing.remove();

    const assistant = document.createElement('div');
    assistant.id = 'writing-assistant';
    assistant.className = 'writing-assistant';
    assistant.innerHTML = `
      <div class="writing-assistant-header">
        <button type="button" class="writing-assistant-toggle" id="writing-assistant-toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          写作助手
          <span class="writing-assistant-arrow">▼</span>
        </button>
      </div>
      <div class="writing-assistant-body" id="writing-assistant-body" style="display:none;">
        <div class="assistant-section">
          <div class="assistant-label">情绪检测</div>
          <div class="assistant-value" id="assistant-mood">
            <span class="mood-indicator mood-neutral">--</span>
          </div>
        </div>
        <div class="assistant-section">
          <div class="assistant-label">字数统计</div>
          <div class="assistant-value" id="assistant-wordcount">0 字</div>
        </div>
        <div class="assistant-section" id="assistant-tips-section" style="display:none;">
          <div class="assistant-label">写作建议</div>
          <div class="assistant-tips" id="assistant-tips"></div>
        </div>
      </div>
    `;

    // 插入到标签建议区域下方
    const tagWrapper = document.getElementById('tag-input-wrapper');
    if (tagWrapper) {
      tagWrapper.parentNode.insertBefore(assistant, tagWrapper.nextSibling);
    }
  },

  /**
   * 绑定 AI 按钮事件
   * @private
   */
  _bindAIEvents() {
    // v7.0.3: 防止每次加载记录时累积事件监听器
    if (this._aiEventsBound) return;
    this._aiEventsBound = true;
    // AI 工具栏按钮
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-toolbar-btn');
      if (!btn) return;

      e.preventDefault();
      const action = btn.dataset.action;

      if (action === 'ai-summary') {
        this._handleAISummary();
      } else if (action === 'ai-tags') {
        this._handleAITags();
      } else if (action === 'ai-prompt') {
        this._handleAIPrompt();
      }
    });

    // 写作助手折叠
    const toggle = document.getElementById('writing-assistant-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const body = document.getElementById('writing-assistant-body');
        const arrow = toggle.querySelector('.writing-assistant-arrow');
        if (body && arrow) {
          const isVisible = body.style.display !== 'none';
          body.style.display = isVisible ? 'none' : 'block';
          arrow.textContent = isVisible ? '▼' : '▲';
        }
      });
    }

    // 实时情绪检测 + 写作建议
    const notesInput = document.getElementById('create-rich-content');
    if (notesInput && window.AILiteService) {
      // 防抖
      let moodTimer = null;
      notesInput.addEventListener('input', () => {
        if (moodTimer) clearTimeout(moodTimer);
        moodTimer = setTimeout(() => {
          this._updateMoodDetection();
          this._updateWordCount();
          this._updateWritingTips();
        }, 500);
      });
    }
  },

  /**
   * 处理 AI 摘要生成
   * @private
   */
  _handleAISummary() {
    if (!window.AILiteService) return;
    const notesEl = document.getElementById('create-rich-content');
    if (!notesEl) return;

    const text = notesEl.innerText || notesEl.textContent || '';
    if (text.length < 20) {
      this._showToast('内容太少，先多写点再生成摘要吧');
      return;
    }

    const summary = window.AILiteService.generateSummary(text);
    if (!summary) {
      this._showToast('无法生成摘要');
      return;
    }

    // 在内容顶部插入摘要块
    const summaryHTML = `<div class="ai-summary-block" contenteditable="false"><strong>[AI 摘要]</strong> ${this._escapeHTML(summary)}</div>`;
    notesEl.innerHTML = summaryHTML + notesEl.innerHTML;
    this._showToast('摘要已插入到顶部');
    this._autoSave();
  },

  /**
   * 处理 AI 标签建议
   * @private
   */
  _handleAITags() {
    if (!window.AILiteService) return;
    const notesEl = document.getElementById('create-rich-content');
    const tagsEl = document.getElementById('create-tags');
    if (!notesEl || !tagsEl) return;

    const text = notesEl.innerText || notesEl.textContent || '';
    if (text.length < 10) {
      this._showToast('内容太少，先多写点再生成标签吧');
      return;
    }

    // 获取现有标签
    const existingTags = tagsEl.value.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
    const suggested = window.AILiteService.suggestTags(text, existingTags);

    if (suggested.length === 0) {
      this._showToast('没有找到更多标签建议');
      return;
    }

    // 移除旧的建议 chips
    const oldChips = document.getElementById('ai-tag-suggestions');
    if (oldChips) oldChips.remove();

    // 创建建议 chips 容器
    const chipsContainer = document.createElement('div');
    chipsContainer.id = 'ai-tag-suggestions';
    chipsContainer.className = 'ai-tag-suggestions';
    chipsContainer.innerHTML = '<span class="ai-tag-label">建议标签：</span>' +
      suggested.map(tag =>
        `<button type="button" class="ai-tag-chip" data-tag="${this._escapeHTML(tag)}">${this._escapeHTML(tag)}</button>`
      ).join('');

    // 插入到标签输入框下方
    const tagWrapper = document.getElementById('tag-input-wrapper');
    if (tagWrapper) {
      tagWrapper.parentNode.insertBefore(chipsContainer, tagWrapper.nextSibling);
    }

    // 绑定点击事件
    chipsContainer.querySelectorAll('.ai-tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.tag;
        const currentTags = tagsEl.value.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
        if (!currentTags.includes(tag)) {
          currentTags.push(tag);
          tagsEl.value = currentTags.join(', ');
          chip.classList.add('applied');
          chip.textContent = tag + ' ✓';
          chip.disabled = true;
        }
      });
    });

    this._showToast(`找到 ${suggested.length} 个标签建议，点击可添加`);
  },

  /**
   * 处理 AI 灵感生成
   * @private
   */
  _handleAIPrompt() {
    if (!window.AILiteService) return;

    const prompt = window.AILiteService.generateWritingPrompt();
    const notesEl = document.getElementById('create-rich-content');
    if (!notesEl) return;

    // 获取光标位置或追加到末尾
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && notesEl.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(prompt + '\n');
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      notesEl.innerHTML += `<div>${this._escapeHTML(prompt)}</div>`;
    }

    notesEl.focus();
    this._showToast('灵感已插入到光标位置');
    this._autoSave();
  },

  /**
   * 更新情绪检测显示
   * @private
   */
  _updateMoodDetection() {
    if (!window.AILiteService) return;
    const notesEl = document.getElementById('create-rich-content');
    const moodEl = document.getElementById('assistant-mood');
    if (!notesEl || !moodEl) return;

    const text = notesEl.innerText || notesEl.textContent || '';
    const mood = window.AILiteService.detectMood(text);

    let moodClass = 'mood-neutral';
    if (mood.mood === '非常积极' || mood.mood === '积极') {
      moodClass = 'mood-positive';
    } else if (mood.mood === '非常消极' || mood.mood === '消极') {
      moodClass = 'mood-negative';
    }

    const moodEmoji = {
      '非常积极': '😊',
      '积极': '🙂',
      '中性': '😐',
      '消极': '😟',
      '非常消极': '😢'
    }[mood.mood] || '';

    moodEl.innerHTML = `
      <span class="mood-indicator ${moodClass}">${moodEmoji} ${mood.mood}</span>
      <span class="mood-confidence">(置信度 ${(mood.confidence * 100).toFixed(0)}%)</span>
    `;
  },

  /**
   * 更新字数统计显示
   * @private
   */
  _updateWordCount() {
    const notesEl = document.getElementById('create-rich-content');
    const wcEl = document.getElementById('assistant-wordcount');
    if (!notesEl || !wcEl) return;

    const text = notesEl.innerText || notesEl.textContent || '';
    const chineseChars = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z0-9]+/g) || []).length;
    const total = chineseChars + englishWords;

    wcEl.textContent = `${total} 字 (中文 ${chineseChars} / 英文 ${englishWords})`;
  },

  /**
   * 更新写作建议显示
   * @private
   */
  _updateWritingTips() {
    if (!window.AILiteService) return;
    const notesEl = document.getElementById('create-rich-content');
    const tipsSection = document.getElementById('assistant-tips-section');
    const tipsEl = document.getElementById('assistant-tips');
    if (!notesEl || !tipsSection || !tipsEl) return;

    const text = notesEl.innerText || notesEl.textContent || '';
    const tips = window.AILiteService.writingTips(text);

    if (tips.length === 0) {
      tipsSection.style.display = 'none';
      return;
    }

    tipsSection.style.display = 'block';
    tipsEl.innerHTML = tips.slice(0, 5).map(tip =>
      `<div class="assistant-tip-item">
        <span class="tip-type">${this._escapeHTML(tip.type)}</span>
        <span class="tip-text">${this._escapeHTML(tip.suggestion)}</span>
      </div>`
    ).join('');
  },

  /**
   * HTML 转义
   * @private
   */
  _escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  _showToast(message) {
    if (window.App && typeof App.showToast === 'function') {
      App.showToast(message);
    } else {
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
      }
    }
  }
};

// 全局暴露
window.EditorPlugin = EditorPlugin;

console.log('[EditorPlugin] 编辑器插件 v2 已定义 (富文本工具栏 + 保存处理)');
} else {
  console.log('[EditorPlugin] 已存在，跳过加载');
}
