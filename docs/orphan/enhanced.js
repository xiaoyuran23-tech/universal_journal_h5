/**
 * 万物手札 - 增强功能模块
 * 包含：冲突解决、同步日志、分享功能
 */

const EnhancedFeatures = {
  // 当前待解决的冲突
  pendingConflicts: [],
  
  // 当前分享的记录
  currentShareItem: null,

  /**
   * 初始化
   */
  init() {
    this.bindConflictEvents();
    this.bindSyncLogEvents();
    this.bindShareEvents();
  },

  // ==================== 冲突解决 ====================

  bindConflictEvents() {
    // 全部保留本地
    document.getElementById('conflict-keep-local-btn')?.addEventListener('click', () => {
      this.resolveAllConflicts('local');
    });

    // 全部保留云端
    document.getElementById('conflict-keep-remote-btn')?.addEventListener('click', () => {
      this.resolveAllConflicts('remote');
    });

    // 完成
    document.getElementById('conflict-resolve-btn')?.addEventListener('click', () => {
      this.finishConflictResolution();
    });
  },

  /**
   * 显示冲突解决弹窗
   */
  showConflicts(conflicts) {
    this.pendingConflicts = conflicts.map(c => ({
      ...c,
      selected: 'local' // 默认选择本地
    }));

    const list = document.getElementById('conflict-list');
    list.innerHTML = conflicts.map((conflict, index) => `
      <div class="conflict-item" data-index="${index}">
        <div class="conflict-item-header">
          <div class="conflict-item-name">${this.escapeHtml(conflict.name || '未命名')}</div>
          <div class="conflict-item-time">
            本地：${this.formatDate(conflict.localModified)} | 
            云端：${this.formatDate(conflict.remoteModified)}
          </div>
        </div>
        <div class="conflict-item-versions">
          <div class="conflict-version selected" data-choice="local" data-index="${index}">
            <div class="conflict-version-label">📱 本地版本</div>
            <div class="conflict-version-date">${this.formatDate(conflict.localModified)}</div>
          </div>
          <div class="conflict-version" data-choice="remote" data-index="${index}">
            <div class="conflict-version-label">☁️ 云端版本</div>
            <div class="conflict-version-date">${this.formatDate(conflict.remoteModified)}</div>
          </div>
        </div>
      </div>
    `).join('');

    // 绑定版本选择事件
    list.querySelectorAll('.conflict-version').forEach(version => {
      version.addEventListener('click', (e) => {
        const item = e.currentTarget.closest('.conflict-item');
        item.querySelectorAll('.conflict-version').forEach(v => v.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        
        const index = parseInt(e.currentTarget.dataset.index);
        this.pendingConflicts[index].selected = e.currentTarget.dataset.choice;
      });
    });

    document.getElementById('conflict-modal').style.display = 'flex';
  },

  /**
   * 解决所有冲突
   */
  resolveAllConflicts(choice) {
    this.pendingConflicts = this.pendingConflicts.map(c => ({
      ...c,
      selected: choice
    }));

    const modal = document.getElementById('conflict-modal');
    modal.style.display = 'none';
    
    this.finishConflictResolution();
  },

  /**
   * 完成冲突解决
   */
  async finishConflictResolution() {
    document.getElementById('conflict-modal').style.display = 'none';
    
    // 应用选择
    const resolvedItems = this.pendingConflicts.map(c => {
      return c.selected === 'local' ? c.local : c.remote;
    });

    // 保存到存储
    if (window.IDB && IDB.db) {
      await IDB.putMany(resolvedItems);
      App.items = await IDB.getAll();
    } else {
      // 降级到 localStorage
      const existing = App.items.filter(item => 
        !this.pendingConflicts.some(c => c.id === item._id)
      );
      App.items = [...existing, ...resolvedItems];
      Storage.save(App.items);
    }

    App.filterItems();
    App.renderItems();
    App.renderFavorites();
    
    App.showToast(`✅ 已解决 ${this.pendingConflicts.length} 个冲突`);
    this.pendingConflicts = [];
  },

  // ==================== 同步日志 ====================

  bindSyncLogEvents() {
    // 查看日志
    document.getElementById('settings-cloud-logs')?.addEventListener('click', () => {
      this.showSyncLogs();
    });

    // 关闭
    document.getElementById('sync-log-close-btn')?.addEventListener('click', () => {
      document.getElementById('sync-log-modal').style.display = 'none';
    });

    // 清空
    document.getElementById('sync-log-clear-btn')?.addEventListener('click', async () => {
      if (confirm('确定要清空所有同步日志吗？')) {
        if (window.IDB) {
          await IDB.clearLogs();
          this.showSyncLogs();
          App.showToast('✅ 日志已清空');
        }
      }
    });
  },

  /**
   * 显示同步日志
   */
  async showSyncLogs() {
    if (!window.IDB) {
      App.showToast('❌ 未启用 IndexedDB');
      return;
    }

    const logs = await IDB.getLogs(50);
    const list = document.getElementById('sync-log-list');
    const count = document.getElementById('sync-log-count');

    if (count) count.textContent = `共 ${logs.length} 条记录`;

    if (logs.length === 0) {
      list.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">暂无同步记录</div>';
    } else {
      list.innerHTML = logs.map(log => `
        <div class="sync-log-item">
          <div class="sync-log-icon ${log.success ? 'success' : 'error'}">
            ${log.success ? '✅' : '❌'}
          </div>
          <div class="sync-log-content">
            <div class="sync-log-type">${this.getSyncTypeLabel(log.type)}</div>
            <div class="sync-log-message">${this.escapeHtml(log.message)}</div>
          </div>
          <div class="sync-log-time">${this.formatDate(log.timestamp)}</div>
        </div>
      `).join('');
    }

    document.getElementById('sync-log-modal').style.display = 'flex';
  },

  getSyncTypeLabel(type) {
    const labels = {
      'upload': '📤 上传',
      'download': '📥 下载',
      'sync': '🔄 双向同步',
      'upload_incremental': '⚡ 增量上传',
      'error': '❌ 错误'
    };
    return labels[type] || type;
  },

  // ==================== 分享功能 ====================

  bindShareEvents() {
    // 取消
    document.getElementById('share-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('share-modal').style.display = 'none';
    });

    // 生成图片
    document.getElementById('share-generate-btn')?.addEventListener('click', () => {
      this.generateShareImage();
    });

    // 下载图片
    document.getElementById('share-download-btn')?.addEventListener('click', () => {
      this.downloadShareImage();
    });
  },

  /**
   * 显示分享弹窗
   */
  showShare(item) {
    this.currentShareItem = item;

    const preview = document.getElementById('share-preview');
    const photo = item.photos && item.photos.length > 0 ? item.photos[0] : null;

    preview.innerHTML = `
      <div class="share-preview-card">
        ${photo ? `<img src="${photo}" class="share-preview-photo" alt="照片" />` : ''}
        <div class="share-preview-title">${this.escapeHtml(item.name || '未命名')}</div>
        <div class="share-preview-category">${this.escapeHtml(item.category || '未分类')}</div>
        <div class="share-preview-notes">${this.escapeHtml(item.notes || '无备注')}</div>
        <div class="share-preview-qr"></div>
      </div>
    `;

    // 生成二维码
    if (document.getElementById('share-include-qr').checked) {
      this.generateQRCode(preview.querySelector('.share-preview-qr'), item._id);
    }

    document.getElementById('share-modal').style.display = 'flex';
    document.getElementById('share-download-btn').style.display = 'none';
  },

  /**
   * 生成二维码
   */
  generateQRCode(container, data) {
    // 使用简单的二维码生成（实际项目可用 qrcode.js 库）
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(JSON.stringify({
      id: data,
      app: 'universal_journal',
      ts: Date.now()
    }))}`;

    container.innerHTML = `<img src="${url}" style="width: 100px; height: 100px;" alt="二维码" />`;
  },

  /**
   * 生成分享图片
   */
  async generateShareImage() {
    App.showToast('🎨 正在生成图片...');

    // 简单方案：直接使用 html2canvas（需要引入库）
    // 这里用简单实现，实际应引入 html2canvas 库
    const preview = document.querySelector('.share-preview-card');
    
    if (window.html2canvas) {
      try {
        const canvas = await html2canvas(preview, {
          backgroundColor: '#ffffff',
          scale: 2
        });

        // 显示下载按钮
        const downloadBtn = document.getElementById('share-download-btn');
        downloadBtn.style.display = 'inline-block';
        downloadBtn.onclick = () => {
          const link = document.createElement('a');
          link.download = `分享-${this.currentShareItem.name || '记录'}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        };

        App.showToast('✅ 图片已生成，点击下载');
      } catch (e) {
        App.showToast('❌ 生成失败：' + e.message);
      }
    } else {
      // 降级方案：提示用户截图
      App.showToast('📸 请手动截图分享区域');
    }
  },

  /**
   * 下载分享图片
   */
  downloadShareImage() {
    App.showToast('💾 图片已保存');
  },

  // ==================== 工具函数 ====================

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

// 导出到全局
window.EnhancedFeatures = EnhancedFeatures;
