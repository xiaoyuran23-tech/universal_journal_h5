/**
 * Batch Plugin - 批量操作
 * 替代 js/batch.js
 * @version 6.1.0
 */

if (!window.BatchPlugin) {
const BatchPlugin = {
  name: 'batch',
  version: '1.0.0',
  dependencies: ['records'],

  isBatchMode: false,
  selectedIds: new Set(),
  longPressTimer: null,
  LONG_PRESS_DURATION: 500,

  _eventsBound: false,

  async init() {
    console.log('[BatchPlugin] Initializing...');
  },

  async start() {
    console.log('[BatchPlugin] Starting...');
    this._bindEvents();
  },

  stop() {
    this._eventsBound = false;
  },

  enterBatchMode(firstId) {
    this.isBatchMode = true;
    this.selectedIds.clear();
    this.selectedIds.add(firstId);
    this._showBatchToolbar();
    this._updateCardSelection();
  },

  exitBatchMode() {
    this.isBatchMode = false;
    this.selectedIds.clear();
    this._hideBatchToolbar();
    this._updateCardSelection();
  },

  toggleSelect(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this._updateCardSelection();
    this._updateBatchToolbar();
  },

  toggleSelectAll() {
    const records = window.Store ? window.Store.getState('records.list') : [];
    if (this.selectedIds.size === records.length) {
      this.selectedIds.clear();
    } else {
      records.forEach(item => this.selectedIds.add(item.id));
    }
    this._updateCardSelection();
    this._updateBatchToolbar();
  },

  _updateCardSelection() {
    document.querySelectorAll('.item-card').forEach(card => {
      if (this.selectedIds.has(card.dataset.id)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  },

  _showBatchToolbar() {
    let toolbar = document.getElementById('batch-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'batch-toolbar';
      toolbar.className = 'batch-toolbar';
      toolbar.innerHTML = `
        <div class="batch-toolbar-content">
          <span class="batch-count" id="batch-count">已选 0 项</span>
          <div class="batch-actions">
            <button class="btn btn-small" id="batch-select-all">全选</button>
            <button class="btn btn-small btn-danger" id="batch-delete">删除</button>
            <button class="btn btn-small" id="batch-cancel">取消</button>
          </div>
        </div>
      `;
      document.body.appendChild(toolbar);

      document.getElementById('batch-select-all').addEventListener('click', () => this.toggleSelectAll());
      document.getElementById('batch-delete').addEventListener('click', () => this._batchDelete());
      document.getElementById('batch-cancel').addEventListener('click', () => this.exitBatchMode());
    }
    toolbar.classList.add('show');
    this._updateBatchToolbar();
  },

  _hideBatchToolbar() {
    const toolbar = document.getElementById('batch-toolbar');
    if (toolbar) toolbar.classList.remove('show');
  },

  _updateBatchToolbar() {
    const countEl = document.getElementById('batch-count');
    if (countEl) countEl.textContent = `已选 ${this.selectedIds.size} 项`;
  },

  async _batchDelete() {
    if (this.selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${this.selectedIds.size} 条记录吗？`)) return;

    const records = window.Store ? window.Store.getState('records.list') : [];
    const itemsToDelete = records.filter(item => this.selectedIds.has(item.id));

    // 移入回收站
    if (window.TrashPlugin) {
      TrashPlugin.addManyToTrash(itemsToDelete);
    }

    // 从 Store 删除
    for (const id of this.selectedIds) {
      if (window.RecordsPlugin) {
        await RecordsPlugin.deleteRecord(id);
      }
    }

    this._showToast(`已删除 ${this.selectedIds.size} 条记录`);
    this.exitBatchMode();
  },

  _bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const container = document.getElementById('items-container');
    if (!container) return;

    container.addEventListener('touchstart', (e) => {
      const card = e.target.closest('.item-card');
      if (!card) return;
      this.longPressTimer = setTimeout(() => {
        this.enterBatchMode(card.dataset.id);
        if (navigator.vibrate) navigator.vibrate(50);
      }, this.LONG_PRESS_DURATION);
    });

    container.addEventListener('touchend', () => clearTimeout(this.longPressTimer));
    container.addEventListener('touchmove', () => clearTimeout(this.longPressTimer));

    container.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.item-card');
      if (!card) return;
      e.preventDefault();
      this.enterBatchMode(card.dataset.id);
    });

    // 批量模式下点击卡片
    container.addEventListener('click', (e) => {
      if (!this.isBatchMode) return;
      const card = e.target.closest('.item-card');
      if (card) {
        e.stopPropagation();
        this.toggleSelect(card.dataset.id);
      }
    });
  },

  handleCardClick(id) {
    if (this.isBatchMode) {
      this.toggleSelect(id);
      return true;
    }
    return false;
  },

  _showToast(message) {
    if (window.UIComponents && UIComponents.Toast) {
      UIComponents.Toast.show(message, { duration: 2000 });
    } else if (window.App) {
      App.showToast(message);
    }
  }
};

window.BatchPlugin = BatchPlugin;
console.log('[BatchPlugin] 批量操作插件已定义');
}
