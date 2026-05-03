# 万物手札 - 设计文档

**版本**: v7.4.0
**日期**: 2026-05-03
**设计师**: 九子圆桌（囚牛 + 睚眦 + 嘲风 + 狻猊 + 霸下 + 蒲牢 + 狴犴 + 负屃 + 螭吻）

---

## v7.4.0: Auth 重构 + Sync 重构

### 问题描述

用户反馈："登录注册和同步功能非常不完善"

### 根因分析

1. **Auth 状态散落**：登录状态存在 AuthPlugin 实例 `_user` 中，未纳入 Store，其他插件通过 `window.AuthPlugin.isLoggedIn` 判断，数据源不统一
2. **同步模块混乱**：两条并行路径共存 — AutoSyncPlugin（在用，USN 合并）和 SyncService（Gist 旧同步，功能完整但正常流程不调用）；SyncMerge 的 Vector Clock 冲突解决已加载但 AutoSyncPlugin 不用
3. **缺关键用户流程**：无密码重置、无同步日志可视化、`_syncMoodToServer` 是空壳、无 JWT 自动续期

### 修改方案

**模块 A：Auth 重构**
- Auth 状态纳入 Store（`state.app.auth`），统一数据源
- 新增密码重置流程（后端 `/api/auth/request-reset` + `/api/auth/reset-password` + 前端 UI）
- 新增 JWT 静默续期机制（过期前 5 分钟自动请求 `/api/auth/refresh`）
- 保留现有登录/注册/后端安全机制不动

**模块 B：Sync 重构**
- 废弃 SyncService（Gist 同步），合并其有用能力到 AutoSyncPlugin
- 将 SyncMerge 接入 AutoSyncPlugin 的 `_mergeServerChanges`，用 Vector Clock 做精细冲突解决
- 实现 `#sync-log` 写入（同步操作可视化）
- 实现 `_syncMoodToServer`（心情数据同步到服务器）
- 新增离线变更队列 UI（显示待同步数量）

### 修改文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/plugins/auth/index.js` | 重写：Auth 状态接入 Store，新增密码重置、JWT 续期 |
| `src/plugins/profile/index.js` | 适配：从 Store 读 auth 状态，新增重置密码入口 |
| `src/plugins/auto-sync/index.js` | 重写：接入 SyncMerge，实现 sync-log，实现 mood sync |
| `src/plugins/sync/index.js` | 简化：纯 UI 层，接入新的 sync-log 显示 |
| `src/services/sync.js` | 标记 deprecated，保留但不暴露 |
| `src/services/sync-merge.js` | 保留，导出供 AutoSyncPlugin 调用 |
| `server/index.js` | 新增：密码重置 2 端点 + JWT refresh 端点 |
| `index.html` | 新增：密码重置 UI 入口、sync-log 容器更新 |

### 验收标准

- [x] 登录/注册流程不变且更稳定
- [x] 新增密码重置流程完整可用
- [x] JWT 自动续期在后台静默完成
- [x] Auth 状态可在 Store 中查询
- [x] 同步日志在 cloud-modal 中实时显示
- [x] 心情数据同步到服务器
- [x] 冲突解决使用 Vector Clock 字段级合并
- [x] Gist 同步代码标记 deprecated
- [ ] full-test-v7.mjs 100% 通过（待部署后验证）

---

## v2.5.0: 内容显示修复 & 自定义分类

### 问题描述
用户反馈："创建了不显示内容，分类要可以自定义，自定义后要保存，界面自动归类"

### 根因分析
1. `Storage.migrateItems()` 每次调用时只保留固定字段，丢失了 `photos` 等扩展字段
2. 分类写死在 HTML `<select>` 和 JS `categoryNames` 对象中，无法自定义
3. 无分类管理机制，无处存储自定义分类

### 修复清单

| # | 问题 | 优先级 | 修复方案 |
|---|------|--------|----------|
| 1 | migrateItems 丢失字段 | P0 | 使用 spread 保留所有字段 |
| 2 | 分类不能自定义 | P0 | 新增 Storage.addCategory/deleteCategory/getCategories |
| 3 | 自定义后不保存 | P0 | 持久化到 settings.customCategories |
| 4 | 界面不自动归类 | P1 | 卡片/详情页使用 Storage.getCategoryName() |
| 5 | 分类管理 UI | P1 | 新增弹窗：新增分类 + 管理分类 |

---

## v2.4.0: 图片功能恢复

### 问题描述
用户反馈："图片功能又丢失了"

### 根因分析
v2.2.0 完全重构时，图片相关 HTML/CSS/JS 全部未迁移到新架构中：
- HTML 中缺少照片上传表单元素
- CSS 中缺少照片相关样式
- JS 中缺少照片上传、预览、全屏查看逻辑
- Storage 模块中缺少 photos 字段处理

### 修复清单

| # | 问题 | 优先级 | 修复方案 |
|---|------|--------|----------|
| 1 | 无照片上传 UI | P0 | index.html 新增 photo-upload-area |
| 2 | 无照片预览 | P0 | ui.js 新增 renderPhotoPreview() |
| 3 | 无照片处理逻辑 | P0 | ui.js 新增 handlePhotoUpload() |
| 4 | 详情页无照片展示 | P0 | ui.js 新增 renderDetailPhotos() |
| 5 | 无全屏查看 | P1 | ui.js 新增 showPhotoViewer() |
| 6 | 编辑时照片丢失 | P1 | editItem() 加载已有照片 |
| 7 | 提交时不保存照片 | P0 | submitForm() 包含 photos 字段 |
| 8 | Storage 不处理 photos | P0 | addItem/updateItem 增加 photos |

### 架构决策
- 照片存储在 localStorage 中（Base64 编码）
- 受浏览器 localStorage 限制（5-10MB），建议照片数量 < 20 张/记录
- 未来可升级为 IndexedDB 或 Web Crypto API 压缩

---

## v2.3.0: 同步功能修复

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
| v2.5.0 | 2026-04-27 | 内容显示修复 + 自定义分类系统：migrateItems 保留字段、分类动态渲染、管理弹窗 |
| v2.4.0 | 2026-04-27 | 图片功能恢复：上传、预览、全屏查看、编辑保留、Storage 集成 |
| v2.3.0 | 2026-04-27 | 同步功能完整实现：弹窗 UI、事件绑定、Sync 初始化、状态显示、上传下载 |
| v2.2.1 | 2026-04-27 | Bug 修复（previousPage、搜索防抖、假加密声明） |
| v2.2.0 | 2026-04-27 | 完全重构（模块化架构） |
