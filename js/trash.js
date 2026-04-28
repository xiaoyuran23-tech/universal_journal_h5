/**
 * 万物手札 - 回收站模块
 * 提供误删恢复、自动清理功能
 * 版本：v3.1.0
 */

const TrashManager = {
  TRASH_KEY: 'universal_journal_trash',
  RETENTION_DAYS: 30, // 保留 30 天
  
  /**
   * 初始化回收站
   */
  init() {
    this.cleanExpired();
  },
  
  /**
   * 获取回收站数据
   */
  getTrash() {
    try {
      const data = localStorage.getItem(this.TRASH_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('回收站读取失败:', e);
      return [];
    }
  },
  
  /**
   * 保存回收站数据
   */
  saveTrash(items) {
    try {
      localStorage.setItem(this.TRASH_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('回收站保存失败:', e);
    }
  },
  
  /**
   * 添加项目到回收站
   */
  addToTrash(item) {
    const trash = this.getTrash();
    
    const trashItem = {
      ...item,
      deletedAt: Date.now(),
      originalCategory: item.category,
      originalTags: item.tags
    };
    
    trash.unshift(trashItem);
    this.saveTrash(trash);
  },
  
  /**
   * 批量添加到回收站
   */
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
  
  /**
   * 从回收站恢复项目
   */
  restore(id) {
    const trash = this.getTrash();
    const index = trash.findIndex(item => item.id === id);
    
    if (index === -1) return false;
    
    const item = trash[index];
    trash.splice(index, 1);
    this.saveTrash(trash);
    
    // 恢复原始数据结构
    const restoredItem = {
      id: item.id,
      name: item.name,
      category: item.originalCategory || item.category,
      notes: item.notes,
      tags: item.originalTags || item.tags || [],
      status: item.status,
      date: item.date,
      photos: item.photos || [],
      favorite: item.favorite || false,
      createdAt: item.createdAt,
      updatedAt: new Date().toISOString()
    };
    
    return restoredItem;
  },
  
  /**
   * 彻底删除（从回收站移除）
   */
  permanentDelete(id) {
    const trash = this.getTrash();
    const filtered = trash.filter(item => item.id !== id);
    this.saveTrash(filtered);
  },
  
  /**
   * 清空回收站
   */
  emptyTrash() {
    this.saveTrash([]);
  },
  
  /**
   * 清理过期项目
   */
  cleanExpired() {
    const trash = this.getTrash();
    const now = Date.now();
    const retentionMs = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    
    const valid = trash.filter(item => {
      return now - item.deletedAt < retentionMs;
    });
    
    if (valid.length !== trash.length) {
      this.saveTrash(valid);

    }
    
    return valid;
  },
  
  /**
   * 获取剩余天数
   */
  getDaysRemaining(deletedAt) {
    const now = Date.now();
    const retentionMs = this.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const remaining = retentionMs - (now - deletedAt);
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  },
  
  /**
   * 渲染回收站列表
   */
  renderTrashList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const trash = this.cleanExpired();
    
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
              <h4>${this.escapeHtml(item.name || '未命名')}</h4>
              <p class="trash-meta">
                删除时间：${new Date(item.deletedAt).toLocaleDateString('zh-CN')} | 
                剩余 ${this.getDaysRemaining(item.deletedAt)} 天
              </p>
            </div>
            <div class="trash-item-actions">
              <button class="btn btn-small btn-restore" data-id="${item.id}">恢复</button>
              <button class="btn btn-small btn-delete-permanent" data-id="${item.id}">彻底删除</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // 绑定事件
    container.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleRestore(btn.dataset.id, containerId);
      });
    });
    
    container.querySelectorAll('.btn-delete-permanent').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handlePermanentDelete(btn.dataset.id, containerId);
      });
    });
    
    const emptyBtn = document.getElementById('empty-trash-btn');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => {
        if (confirm('确定要清空回收站吗？所有记录将永久删除！')) {
          this.emptyTrash();
          this.renderTrashList(containerId);
          window.App.showToast('回收站已清空');
        }
      });
    }
  },
  
  /**
   * 处理恢复
   */
  async handleRestore(id, containerId) {
    const restoredItem = this.restore(id);
    if (!restoredItem) return;
    
    // 保存回主存储
    if (window.StorageBackend) {
      await StorageBackend.put(restoredItem);
    }
    
    this.renderTrashList(containerId);
    window.App.showToast('记录已恢复');
    
    // 刷新主列表
    if (window.App && window.App.loadItems) {
      await window.App.loadItems();
      window.App.renderItems();
    }
  },
  
  /**
   * 处理彻底删除
   */
  handlePermanentDelete(id, containerId) {
    if (confirm('确定要彻底删除这条记录吗？此操作不可恢复！')) {
      this.permanentDelete(id);
      this.renderTrashList(containerId);
      window.App.showToast('记录已永久删除');
    }
  },
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// 全局导出
window.TrashManager = TrashManager;
