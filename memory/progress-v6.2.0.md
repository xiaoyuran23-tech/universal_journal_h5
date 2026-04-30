# 万物手札 v6.2.0 功能恢复迭代 — 进度记录

> 日期：2026-04-30
> 目标：恢复丢失的草稿/回收站/批量/可视化等功能初始化链路

---

## ✅ 已完成

### Slice 1: 修复旧模块初始化链路

**修改文件：**
- `src/main.js` — 新增 `initLegacyModules()` 函数，在 `initApp()` 中显式调用 DraftManager/TrashManager/BatchManager/TagManager/VisualsManager/TemplateManager/TimelineManager/ThemeManager 的 init 方法
- `js/app.js` — App.init() 中添加 `__legacyModulesInitialized` 标志检查，防止双重初始化

**效果：**
- 草稿自动保存：✅ 显式初始化
- 回收站系统：✅ 显式初始化
- 批量操作：✅ 显式初始化
- 标签管理：✅ 显式初始化
- 数据可视化：✅ 显式初始化
- 模板/时间线：✅ 显式初始化

### Slice 2: 统一 Store 与 App 的数据流

**修改文件：**
- `src/core/adapter.js` — 重写 `_bindOldToNew()` 为 `_interceptStorageBackend()`，拦截 StorageBackend.put/delete/save 方法实现自动同步到 v6 Store

**效果：**
- 旧 App 创建/更新记录 → 自动同步到 Store.records
- 旧 App 删除记录 → 自动从 Store 删除
- Store 变化 → 自动注入 App.items + 触发 renderItems()
- 初始数据加载 → 从 StorageBackend 加载并同步到 Store

### Slice 3: 回收站页路由 + 导航入口

**修改文件：**
- `index.html` — 在 Profile 页面"数据管理"区域后新增"回收站"设置项（`#settings-trash`）
- `src/core/router.js` — 新增 `trash` 路由注册
- `src/main.js` — `initUI()` 中绑定回收站按钮点击 → Router.navigate('trash') + TrashManager 渲染；路由订阅中监听 trash 路径自动渲染

**效果：**
- Profile 页面可点击进入回收站
- 回收站列表自动渲染
- Router 支持 `/trash` 路径导航

### Slice 4: Service Worker 缓存一致性

**验证结果：** sw.js 的 ASSETS_TO_CACHE 列表中的所有 54 个文件均存在，与 index.html 引用一致。无需修改。

---

## 🔄 下一步（v6.3.0 计划）

1. 左滑删除手势 — RecordsPlugin 中新增 touch 事件处理
2. 生物识别/密码锁 — 新插件 src/plugins/auth/
3. Markdown 编辑模式 — EditorPlugin 新增 markdown 模式
4. 文档一致性修复 — 统一所有文档版本号为 v6.1.0

---

## 📊 代码统计

| 文件 | 变更类型 | 行数变化 |
|------|---------|---------|
| src/main.js | 新增 | +70 |
| js/app.js | 修改 | ~10 行 |
| src/core/adapter.js | 重写 | ~130 |
| src/core/router.js | 新增 | +5 |
| index.html | 新增 | +11 |
