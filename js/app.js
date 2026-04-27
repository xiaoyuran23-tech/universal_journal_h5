/**
 * 万物手札 - 主应用模块
 * 负责应用初始化、全局事件处理、模块协调
 * 版本：v2.2.1
 */

const App = {
  // 应用版本
  version: '2.2.1',
  
  // 初始化
  init() {
    console.log(`万物手札 v${this.version} 启动中...`);
    
    // 检查模块是否已加载
    if (typeof Storage === 'undefined') {
      console.error('Storage module not loaded');
      return;
    }
    if (typeof UI === 'undefined') {
      console.error('UI module not loaded');
      return;
    }
    if (typeof Sync === 'undefined') {
      console.error('Sync module not loaded');
      return;
    }
    
    // 初始化各模块
    Storage.init();
    UI.init();
    Sync.init();
    
    // 绑定全局事件
    this.bindGlobalEvents();
    
    // 显示启动提示
    setTimeout(() => {
      UI.showToast(`万物手札 v${this.version} 已就绪`);
    }, 500);
    
    console.log('万物手札启动完成');
  },
  
  // 绑定全局事件
  bindGlobalEvents() {
    // 防止 iOS 双击缩放
    document.addEventListener('touchend', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // 监听网络状态变化
    window.addEventListener('online', () => {
      UI.showToast('网络已连接');
    });
    
    window.addEventListener('offline', () => {
      UI.showToast('网络已断开');
    });
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (UI.currentPage === 'form') {
          UI.submitForm();
        }
      }
      
      // Esc 返回
      if (e.key === 'Escape') {
        if (UI.currentPage === 'detail' || UI.currentPage === 'form') {
          UI.switchPage('home');
        }
      }
    });
    
    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // 页面重新可见时刷新数据
        if (UI.currentPage === 'home') {
          UI.renderItems();
        } else if (UI.currentPage === 'favorites') {
          UI.renderFavorites();
        }
      }
    });
  },
  
  // 显示关于信息
  showAbout() {
    const aboutContent = `
      <h2>万物手札</h2>
      <p>版本：${this.version}</p>
      <p>一个简洁优雅的 H5 记录应用</p>
      <p>支持本地存储、云同步、多主题切换</p>
      <p>© 2026 万物手札团队</p>
    `;
    
    // 创建模态框显示
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        ${aboutContent}
        <button class="modal-close" onclick="this.parentElement.parentElement.remove()">关闭</button>
      </div>
    `;
    document.body.appendChild(modal);
  },
  
  // 清除所有数据（危险操作）
  clearAllData() {
    if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
      if (confirm('再次确认：清除所有数据？')) {
        localStorage.removeItem(Storage.STORAGE_KEY);
        localStorage.removeItem(Storage.SETTINGS_KEY);
        UI.showToast('所有数据已清除');
        UI.renderItems();
        UI.renderFavorites();
      }
    }
  },
  
  // 生成测试数据
  generateTestData() {
    const testItems = [
      {
        name: '测试记录 1',
        category: 'general',
        date: '2026-04-27',
        notes: '这是一条测试记录，用于验证功能是否正常。'
      },
      {
        name: '学习笔记',
        category: 'study',
        date: '2026-04-26',
        notes: '今天学习了 JavaScript 模块化编程。'
      },
      {
        name: '工作安排',
        category: 'work',
        date: '2026-04-25',
        notes: '完成项目重构，修复 CSS 编码问题。'
      }
    ];
    
    testItems.forEach(item => {
      Storage.addItem(item);
    });
    
    UI.renderItems();
    UI.showToast('已生成测试数据');
  }
};

// 页面加载完成后启动应用
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
