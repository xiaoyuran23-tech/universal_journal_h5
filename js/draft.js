/**
 * 万物手札 - 草稿管理模块
 * 提供自动保存、恢复、清除草稿功能
 * 版本：v3.1.0
 */

const DraftManager = {
  DRAFT_KEY: 'universal_journal_draft',
  DRAFT_TIMESTAMP_KEY: 'universal_journal_draft_timestamp',
  AUTO_SAVE_INTERVAL: 2000, // 2 秒自动保存一次
  DRAFT_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 草稿 7 天过期
  saveTimer: null,
  
  /**
   * 初始化草稿系统
   */
  init() {
    this.bindAutoSave();
    this.checkExpiredDraft();
  },
  
  /**
   * 绑定自动保存事件
   */
  bindAutoSave() {
    const formInputs = ['create-name', 'create-notes', 'create-tags', 'create-status', 'create-date'];
    
    formInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          this.debouncedSave();
        });
      }
    });
    
    // 富文本内容监听
    const richContent = document.getElementById('create-rich-content');
    if (richContent) {
      richContent.addEventListener('input', () => {
        this.debouncedSave();
      });
    }
  },
  
  /**
   * 防抖保存
   */
  debouncedSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveDraft();
    }, this.AUTO_SAVE_INTERVAL);
  },
  
  /**
   * 保存草稿
   */
  saveDraft() {
    const draft = {
      name: document.getElementById('create-name')?.value || '',
            notes: document.getElementById('create-notes')?.value || '',
      tags: document.getElementById('create-tags')?.value || '',
      status: document.getElementById('create-status')?.value || 'in-use',
      date: document.getElementById('create-date')?.value || '',
      richContent: document.getElementById('create-rich-content')?.innerHTML || '',
      timestamp: Date.now()
    };
    
    // 如果所有内容都为空，不保存
    if (!draft.name && !draft.notes && !draft.tags && !draft.richContent) {
      this.clearDraft();
      return;
    }
    
    try {
      localStorage.setItem(this.DRAFT_KEY, JSON.stringify(draft));
      localStorage.setItem(this.DRAFT_TIMESTAMP_KEY, Date.now().toString());
    } catch (e) {
      console.warn('草稿保存失败:', e);
    }
  },
  
  /**
   * 获取草稿
   */
  getDraft() {
    try {
      const draftStr = localStorage.getItem(this.DRAFT_KEY);
      if (!draftStr) return null;
      
      const draft = JSON.parse(draftStr);
      
      // 检查是否过期
      if (Date.now() - draft.timestamp > this.DRAFT_EXPIRY) {
        this.clearDraft();
        return null;
      }
      
      return draft;
    } catch (e) {
      console.warn('草稿读取失败:', e);
      return null;
    }
  },
  
  /**
   * 恢复草稿到表单
   */
  restoreDraft() {
    const draft = this.getDraft();
    if (!draft) return false;
    
    // 检查是否有实质内容
    const hasContent = draft.name || draft.notes || draft.tags || draft.richContent;
    if (!hasContent) {
      this.clearDraft();
      return false;
    }
    
    // 填充表单
    if (document.getElementById('create-name')) document.getElementById('create-name').value = draft.name || '';
        if (document.getElementById('create-notes')) document.getElementById('create-notes').value = draft.notes || '';
    if (document.getElementById('create-tags')) document.getElementById('create-tags').value = draft.tags || '';
    if (document.getElementById('create-status')) document.getElementById('create-status').value = draft.status || 'in-use';
    if (document.getElementById('create-date')) document.getElementById('create-date').value = draft.date || '';
    if (document.getElementById('create-rich-content')) document.getElementById('create-rich-content').innerHTML = draft.richContent || '';
    
    return true;
  },
  
  /**
   * 清除草稿
   */
  clearDraft() {
    localStorage.removeItem(this.DRAFT_KEY);
    localStorage.removeItem(this.DRAFT_TIMESTAMP_KEY);
  },
  
  /**
   * 检查过期草稿
   */
  checkExpiredDraft() {
    const timestamp = localStorage.getItem(this.DRAFT_TIMESTAMP_KEY);
    if (timestamp && Date.now() - parseInt(timestamp) > this.DRAFT_EXPIRY) {
      this.clearDraft();
    }
  },
  
  /**
   * 显示草稿恢复提示
   */
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

// 全局导出
window.DraftManager = DraftManager;
