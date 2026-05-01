/**
 * Trash Plugin - 回收站
 * 替代 js/trash.js，迁移至 IndexedDB 存储
 * @version 6.1.0
 */

if (!window.TrashPlugin) {
const TrashPlugin = {
  name: 'trash',
  version: '1.0.0',
  dependencies: [],

  _eventsBound: false,
  TRASH_KEY: 'universal_journal_trash',
  RETENTION_DAYS: 30,

  async init() {
    console.log('[TrashPlugin] Initializing...');
    this._cleanExpired();

    this.routes = [
      { path: 'trash', title: '回收站', component: 'trash-view' }
    ];
  },

  async start() {
    console.log('[TrashPlugin] Starting...');
    this._bindEvents();
    this._renderTrashList();
  },

  stop() {
    this._eventsBound = false;
  },

  getTrash() {
    try {
      const data = localStorage.getItem(this.TRASH_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[TrashPlugin] 读取失败:', e);
      return [];
    }
  },

  saveTrash(items) {
    try {
      localStorage.setItem(this.TRASH_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('[TrashPlugin] 保存失败:', e);
    }
  },

  addToTrash(item) {
    const trash = this.getTrash();
    trash.unshift({
      ...item,
      deletedAt: Date.now(),
      originalCategory: item.category,
      originalTags: item.tags
    });
    this.saveTrash(trash);
  },

  addManyToTrash(items) {
    const trash = this.getTrash();
    items.forEach(item => {
      trash.unshift({
        ...item,
        deletedAt: Date.now(),
        originalCategory: item.category,
        originalTags: item.tags
      });
    });
    this.saveTrash(trash);
  },

  restore(id) {
    const trash = this.getTrash();
    const index = trash.findIndex(item => item.id === id);
    if (index === -1) return null;

    const item = trash[index];
    trash.splice(index, 1);
    this.saveTrash(trash);

    return {
      id: item.id,
      name: item.name,
      notes: item.notes,
      tags: item.originalTags || item.tags || [],
      status: item.status,
      date: item.date,
      photos: item.photos || [],
      favorite: item.favorite || false,
      createdAt: item.createdAt,
      updatedAt: new Date().toISOString()
    };
  },

  permanentDelete(id) {
    const trash = this.getTrash();
    const filtered = trash.filter(item => item.id !== id);
    this.saveTrash(filtered);
  },

  emptyTrash() {
    this.saveTrash([]);
  },

  _cleanExpired() {
    const trash = this.getTrash();
    const now = Date.now();
    const retentionMs = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const valid = trash.filter(item => now - item.deletedAt < retentionMs);
    if (valid.length !== trash.length) {
      this.saveTrash(valid);
    }
    return valid;
  },

  getDaysRemaining(deletedAt) {
    const now = Date.now();
    const retentionMs = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const remaining = retentionMs - (now - deletedAt);
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  },

  _renderTrashList() {
    const container = document.getElementById('trash-container');
    if (!container) return;

    const trash = this._cleanExpired();

    if (trash.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <p class="empty-title">回收站为空</p>
          <p class="empty-desc">删除的记录将在这里保留 30 天</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="trash-header">
        <span class="trash-count">共 ${trash.length} 条记录</span>
        <button class="btn btn-danger btn-small" id="empty-trash-btn">清空回收站</button>
      </div>
      <div class="trash-list">
        ${trash.map(item => `
          <div class="trash-item" data-id="${item.id}">
            <div class="trash-item-info">
              <h4>${this._escapeHtml(item.name || '未命名')}</h4>
              <p class="trash-meta">删除时间：${new Date(item.deletedAt).toLocaleDateString('zh-CN')} | 剩余 ${this.getDaysRemaining(item.deletedAt)} 天</p>
            </div>
            <div class="trash-item-actions">
              <button class="btn btn-small btn-restore" data-id="${item.id}">恢复</button>
              <button class="btn btn-small btn-delete-permanent" data-id="${item.id}">彻底删除</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async _handleRestore(id) {
    const restored = this.restore(id);
    if (!restored) return;

    if (window.StorageService) {
      await StorageService.put(restored);
    }
    this._renderTrashList();
    this._showToast('记录已恢复');
  },

  _handlePermanentDelete(id) {
    if (confirm('确定要彻底删除这条记录吗？此操作不可恢复！')) {
      this.permanentDelete(id);
      this._renderTrashList();
      this._showToast('记录已永久删除');
    }
  },

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const container = document.getElementById('trash-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const restoreBtn = e.target.closest('.btn-restore');
      if (restoreBtn) {
        e.stopPropagation();
        this._handleRestore(restoreBtn.dataset.id);
        return;
      }
      const deleteBtn = e.target.closest('.btn-delete-permanent');
      if (deleteBtn) {
        e.stopPropagation();
        this._handlePermanentDelete(deleteBtn.dataset.id);
      }
    });

    const emptyBtn = document.getElementById('empty-trash-btn');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => {
        if (confirm('确定要清空回收站吗？所有记录将永久删除！')) {
          this.emptyTrash();
          this._renderTrashList();
          this._showToast('回收站已清空');
        }
      });
    }
  },

  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  _showToast(message) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(message, { duration: 2000 });
    } else if (window.App) {
      App.showToast(message);
    }
  }
};

window.TrashPlugin = TrashPlugin;
console.log('[TrashPlugin] 回收站插件已定义');
}
