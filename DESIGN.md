# 万物手札 - 同步功能修复设计文档

**版本**: v2.3.0  
**日期**: 2026-04-27  
**设计师**: 九子圆桌（狴犴 + 睚眦 + 猊）

---

## 问题清单

| # | 问题 | 优先级 | 根因 |
|---|------|--------|------|
| 1 | "同步设置"按钮点击无反应 | P0 | 无事件绑定 |
| 2 | 无同步设置界面（Modal） | P0 | HTML 中未定义 |
| 3 | Sync 模块未初始化 | P0 | app.js 中未调用 Sync.init() |
| 4 | "关于"显示 v2.2.0 而非 v2.2.1 | P1 | HTML 硬编码版本号 |
| 5 | 无同步状态显示 | P1 | Profile 页面无状态提示 |
| 6 | 无同步操作按钮（上传/下载） | P1 | 未实现同步 UI |

---

## 修复方案

### 修复 1: 同步设置 Modal HTML

**位置**: `index.html`，在 `<main>` 之后添加

**内容**:
```html
<!-- 同步设置弹窗 -->
<div id="sync-modal" class="modal">
  <div class="modal-content sync-modal">
    <div class="modal-header">
      <h3>云同步设置</h3>
      <button class="modal-close" id="sync-modal-close">×</button>
    </div>
    <div class="modal-body">
      <!-- 同步状态 -->
      <div id="sync-status" class="sync-status"></div>
      
      <!-- 配置表单 -->
      <div class="sync-config-form">
        <div class="form-group">
          <label for="sync-gist-id">Gist ID</label>
          <input type="text" id="sync-gist-id" placeholder="输入 Gist ID">
        </div>
        <div class="form-group">
          <label for="sync-token">Gist Token</label>
          <input type="password" id="sync-token" placeholder="输入 GitHub Token">
        </div>
        <div class="form-group">
          <label for="sync-key">加密密钥</label>
          <input type="password" id="sync-key" placeholder="设置加密密钥">
        </div>
        <button id="sync-save-config" class="btn-primary">保存配置</button>
      </div>
      
      <!-- 同步操作 -->
      <div id="sync-actions" class="sync-actions">
        <button id="sync-upload" class="btn-sync">上传</button>
        <button id="sync-download" class="btn-sync">下载</button>
      </div>
      
      <!-- 同步日志 -->
      <div id="sync-log" class="sync-log"></div>
    </div>
  </div>
</div>
```

### 修复 2: 同步设置 CSS

**位置**: `style.css` 末尾添加

**内容**:
```css
/* ===================================
   Sync Modal
   =================================== */
.modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal.active {
  display: flex;
}

.modal-content {
  background: var(--bg-color, #fff);
  border-radius: 16px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-color, #666);
}

.sync-status {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.sync-status.configured {
  background: #e8f5e9;
  color: #2e7d32;
}

.sync-status.not-configured {
  background: #fff3e0;
  color: #e65100;
}

.sync-config-form .form-group {
  margin-bottom: 12px;
}

.sync-config-form label {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
  color: var(--text-color, #666);
}

.sync-config-form input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: #007AFF;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 8px;
}

.sync-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.btn-sync {
  flex: 1;
  padding: 12px;
  border: 1px solid #007AFF;
  background: white;
  color: #007AFF;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn-sync:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sync-log {
  margin-top: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 12px;
  max-height: 120px;
  overflow-y: auto;
  font-family: monospace;
}

.sync-log-item {
  margin-bottom: 4px;
  color: #666;
}

.sync-log-item.success {
  color: #2e7d32;
}

.sync-log-item.error {
  color: #c62828;
}
```

### 修复 3: 版本号修复

**位置**: `index.html`，"关于" section

**修改**:
```html
<!-- 修改前 -->
<span>万物手札 v2.2.0</span>
<span class="about-version">重构版</span>

<!-- 修改后 -->
<span>万物手札 v2.3.0</span>
<span class="about-version">同步增强版</span>
```

### 修复 4: UI 事件绑定

**位置**: `js/ui.js`，`bindEvents()` 函数

**新增绑定**:
```javascript
// 同步设置按钮
const syncBtn = document.getElementById('cloud-sync-btn');
if (syncBtn) {
  syncBtn.addEventListener('click', () => {
    this.openSyncModal();
  });
}

// 同步弹窗关闭
const syncModalClose = document.getElementById('sync-modal-close');
if (syncModalClose) {
  syncModalClose.addEventListener('click', () => {
    this.closeSyncModal();
  });
}

// 点击遮罩关闭同步弹窗
const syncModal = document.getElementById('sync-modal');
if (syncModal) {
  syncModal.addEventListener('click', (e) => {
    if (e.target === syncModal) {
      this.closeSyncModal();
    }
  });
}

// 保存同步配置
const syncSaveBtn = document.getElementById('sync-save-config');
if (syncSaveBtn) {
  syncSaveBtn.addEventListener('click', () => {
    this.saveSyncConfig();
  });
}

// 同步上传
const syncUploadBtn = document.getElementById('sync-upload');
if (syncUploadBtn) {
  syncUploadBtn.addEventListener('click', () => {
    this.uploadSync();
  });
}

// 同步下载
const syncDownloadBtn = document.getElementById('sync-download');
if (syncDownloadBtn) {
  syncDownloadBtn.addEventListener('click', () => {
    this.downloadSync();
  });
}
```

### 修复 5: UI 同步方法

**位置**: `js/ui.js`，UI 对象

**新增方法**:
```javascript
// 打开同步弹窗
openSyncModal() {
  const modal = document.getElementById('sync-modal');
  if (modal) {
    modal.classList.add('active');
    this.updateSyncStatus();
  }
},

// 关闭同步弹窗
closeSyncModal() {
  const modal = document.getElementById('sync-modal');
  if (modal) {
    modal.classList.remove('active');
  }
},

// 更新同步状态显示
updateSyncStatus() {
  const statusEl = document.getElementById('sync-status');
  const configForm = document.querySelector('.sync-config-form');
  const actionsEl = document.getElementById('sync-actions');
  
  if (!Sync.isConfigured()) {
    statusEl.className = 'sync-status not-configured';
    statusEl.textContent = '未配置同步，请先设置 Gist 信息';
    configForm.style.display = 'block';
    actionsEl.style.display = 'none';
  } else {
    statusEl.className = 'sync-status configured';
    const lastSync = Sync.config.lastSyncTime ? 
      new Date(Sync.config.lastSyncTime).toLocaleString() : '从未同步';
    statusEl.innerHTML = `已配置 · 最后同步：${lastSync}`;
    configForm.style.display = 'none';
    actionsEl.style.display = 'flex';
  }
},

// 保存同步配置
saveSyncConfig() {
  const gistId = document.getElementById('sync-gist-id').value.trim();
  const token = document.getElementById('sync-token').value.trim();
  const key = document.getElementById('sync-key').value.trim();
  
  if (!gistId || !token || !key) {
    this.showToast('请填写所有字段');
    return;
  }
  
  Sync.setConfig(gistId, token, key);
  this.updateSyncStatus();
  this.showToast('同步配置已保存');
  this.addSyncLog('配置保存成功', 'success');
},

// 上传同步
async uploadSync() {
  const logEl = document.getElementById('sync-log');
  this.addSyncLog('开始上传...', '');
  
  try {
    await Sync.upload();
    this.addSyncLog('上传成功', 'success');
    this.showToast('同步上传成功');
    this.updateSyncStatus();
  } catch (e) {
    this.addSyncLog('上传失败：' + e.message, 'error');
    this.showToast('上传失败：' + e.message);
  }
},

// 下载同步
async downloadSync() {
  const logEl = document.getElementById('sync-log');
  this.addSyncLog('开始下载...', '');
  
  try {
    await Sync.download();
    this.addSyncLog('下载成功', 'success');
    this.showToast('同步下载成功');
    this.updateSyncStatus();
  } catch (e) {
    this.addSyncLog('下载失败：' + e.message, 'error');
    this.showToast('下载失败：' + e.message);
  }
},

// 添加同步日志
addSyncLog(message, type) {
  const logEl = document.getElementById('sync-log');
  if (!logEl) return;
  
  const time = new Date().toLocaleTimeString();
  const item = document.createElement('div');
  item.className = 'sync-log-item ' + type;
  item.textContent = `[${time}] ${message}`;
  logEl.appendChild(item);
  logEl.scrollTop = logEl.scrollHeight;
}
```

### 修复 6: Sync 模块初始化

**位置**: `js/app.js`，App.init()

**修改**:
```javascript
init() {
  // ... existing code ...
  
  // 初始化同步模块
  if (typeof Sync !== 'undefined') {
    Sync.init();
  }
  
  // ... existing code ...
}
```

---

## 验收标准

- [ ] 点击"同步设置"按钮能打开弹窗
- [ ] 弹窗显示同步状态（已配置/未配置）
- [ ] 未配置时显示配置表单
- [ ] 已配置时显示上传/下载按钮
- [ ] 保存配置后状态更新
- [ ] 上传/下载功能正常工作
- [ ] 同步日志实时显示
- [ ] 点击关闭按钮或遮罩能关闭弹窗
- [ ] "关于"显示 v2.3.0
- [ ] 所有 CSS 选择器匹配
- [ ] 所有事件绑定正确

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.3.0 | 2026-04-27 | 同步功能完整实现：弹窗 UI、事件绑定、Sync 初始化、状态显示、上传下载 |
| v2.2.1 | 2026-04-27 | Bug 修复（previousPage、搜索防抖、假加密声明） |
| v2.2.0 | 2026-04-27 | 完全重构（模块化架构） |
