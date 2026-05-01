/**
 * Draft Plugin - 草稿自动保存
 * 替代 js/draft.js
 * @version 6.1.0
 */

if (!window.DraftPlugin) {
const DraftPlugin = {
  name: 'draft',
  version: '1.0.0',
  dependencies: [],

  saveTimer: null,
  DRAFT_KEY: 'universal_journal_draft',
  DRAFT_TIMESTAMP_KEY: 'universal_journal_draft_timestamp',
  AUTO_SAVE_INTERVAL: 2000,
  DRAFT_EXPIRY: 7 * 24 * 60 * 60 * 1000,
  _eventsBound: false,

  async init() {
    console.log('[DraftPlugin] Initializing...');
  },

  async start() {
    console.log('[DraftPlugin] Starting...');
    if (!this._eventsBound) {
      this._bindAutoSave();
      this._checkExpiredDraft();
    }
  },

  stop() {
    clearTimeout(this.saveTimer);
    this._eventsBound = false;
  },

  _bindAutoSave() {
    const formInputs = ['create-name', 'create-rich-content', 'create-tags', 'create-status', 'create-date'];

    formInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this._debouncedSave());
      }
    });
  },

  _debouncedSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveDraft(), this.AUTO_SAVE_INTERVAL);
  },

  saveDraft() {
    const draft = {
      name: document.getElementById('create-name')?.value || '',
      tags: document.getElementById('create-tags')?.value || '',
      status: document.getElementById('create-status')?.value || 'in-use',
      date: document.getElementById('create-date')?.value || '',
      richContent: document.getElementById('create-rich-content')?.innerHTML || '',
      timestamp: Date.now()
    };

    if (!draft.name && !draft.tags && !draft.richContent) {
      this.clearDraft();
      return;
    }

    try {
      localStorage.setItem(this.DRAFT_KEY, JSON.stringify(draft));
      localStorage.setItem(this.DRAFT_TIMESTAMP_KEY, Date.now().toString());
    } catch (e) {
      console.warn('[DraftPlugin] 草稿保存失败:', e);
    }
  },

  getDraft() {
    try {
      const draftStr = localStorage.getItem(this.DRAFT_KEY);
      if (!draftStr) return null;
      const draft = JSON.parse(draftStr);
      if (Date.now() - draft.timestamp > this.DRAFT_EXPIRY) {
        this.clearDraft();
        return null;
      }
      return draft;
    } catch (e) {
      console.warn('[DraftPlugin] 草稿读取失败:', e);
      return null;
    }
  },

  restoreDraft() {
    const draft = this.getDraft();
    if (!draft) return false;

    const hasContent = draft.name || draft.tags || draft.richContent;
    if (!hasContent) {
      this.clearDraft();
      return false;
    }

    if (document.getElementById('create-name')) document.getElementById('create-name').value = draft.name || '';
    if (document.getElementById('create-tags')) document.getElementById('create-tags').value = draft.tags || '';
    if (document.getElementById('create-status')) document.getElementById('create-status').value = draft.status || 'in-use';
    if (document.getElementById('create-date')) document.getElementById('create-date').value = draft.date || '';
    if (document.getElementById('create-rich-content')) document.getElementById('create-rich-content').innerHTML = draft.richContent || '';

    return true;
  },

  clearDraft() {
    localStorage.removeItem(this.DRAFT_KEY);
    localStorage.removeItem(this.DRAFT_TIMESTAMP_KEY);
  },

  _checkExpiredDraft() {
    const timestamp = localStorage.getItem(this.DRAFT_TIMESTAMP_KEY);
    if (timestamp && Date.now() - parseInt(timestamp) > this.DRAFT_EXPIRY) {
      this.clearDraft();
    }
  },

  showRestorePrompt(callback) {
    const draft = this.getDraft();
    if (!draft) return;

    const name = draft.name || '未命名草稿';
    const time = new Date(draft.timestamp).toLocaleString('zh-CN');

    if (confirm(`发现未保存的草稿：${name}\n保存时间：${time}\n\n是否恢复？`)) {
      this.restoreDraft();
      if (callback) callback();
    } else {
      this.clearDraft();
    }
  }
};

window.DraftPlugin = DraftPlugin;
console.log('[DraftPlugin] 草稿管理插件已定义');
}
