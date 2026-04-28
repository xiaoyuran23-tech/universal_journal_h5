/**
 * 万物手札 - 批量操作模块 v3.3.0
 */

const BatchManager = {
  isBatchMode: false,
  selectedIds: new Set(),
  longPressTimer: null,
  LONG_PRESS_DURATION: 500,
  
  init() {
    this.bindLongPress();
  },
  
  bindLongPress() {
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
    
    container.addEventListener('touchend', () => {
      clearTimeout(this.longPressTimer);
    });
    
    container.addEventListener('touchmove', () => {
      clearTimeout(this.longPressTimer);
    });
    
    container.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.item-card');
      if (!card) return;
      
      e.preventDefault();
      this.enterBatchMode(card.dataset.id);
    });
  },
  
  enterBatchMode(firstId) {
    this.isBatchMode = true;
    this.selectedIds.clear();
    this.selectedIds.add(firstId);
    
    this.showBatchToolbar();
    this.updateCardSelection();
  },
  
  exitBatchMode() {
    this.isBatchMode = false;
    this.selectedIds.clear();
    this.hideBatchToolbar();
    this.updateCardSelection();
  },
  
  toggleSelect(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.updateCardSelection();
    this.updateBatchToolbar();
  },
  
  toggleSelectAll() {
    if (!window.App) return;
    if (this.selectedIds.size === App.items.length) {
      this.selectedIds.clear();
    } else {
      App.items.forEach(item => this.selectedIds.add(item.id));
    }
    this.updateCardSelection();
    this.updateBatchToolbar();
  },
  
  updateCardSelection() {
    document.querySelectorAll('.item-card').forEach(card => {
      if (this.selectedIds.has(card.dataset.id)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  },
  
  showBatchToolbar() {
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
      
      document.getElementById('batch-select-all').addEventListener('click', () => {
        this.toggleSelectAll();
      });
      
      document.getElementById('batch-delete').addEventListener('click', () => {
        this.batchDelete();
      });
      
      document.getElementById('batch-cancel').addEventListener('click', () => {
        this.exitBatchMode();
      });
    }
    
    toolbar.classList.add('show');
    this.updateBatchToolbar();
  },
  
  hideBatchToolbar() {
    const toolbar = document.getElementById('batch-toolbar');
    if (toolbar) {
      toolbar.classList.remove('show');
    }
  },
  
  updateBatchToolbar() {
    const countEl = document.getElementById('batch-count');
    if (countEl) {
      countEl.textContent = `已选 ${this.selectedIds.size} 项`;
    }
  },
  
  async batchDelete() {
    if (this.selectedIds.size === 0) return;
    
    if (!confirm(`确定要删除选中的 ${this.selectedIds.size} 条记录吗？`)) return;
    
    const itemsToDelete = App.items.filter(item => this.selectedIds.has(item.id));
    if (window.TrashManager) {
      TrashManager.addManyToTrash(itemsToDelete);
    }
    
    const ids = Array.from(this.selectedIds);
    await StorageBackend.deleteMany(ids);
    
    if (window.App && App.showToast) {
      App.showToast(`已删除 ${ids.length} 条记录`);
    }
    
    this.exitBatchMode();
    if (window.App) {
      await App.loadItems();
      App.renderItems();
    }
  },
  
  handleCardClick(id) {
    if (this.isBatchMode) {
      this.toggleSelect(id);
      return true;
    }
    return false;
  }
};

window.BatchManager = BatchManager;
