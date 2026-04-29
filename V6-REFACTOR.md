# 万物手札 v6.0.0 全面重构

> **重构日期：** 2026-04-29  
> **分支：** v6-refactor  
> **状态：** 进行中

---

## 🏗️ 架构变革

### 旧架构 (v5.0.0 及之前)
```
单体应用
├── app.js (1600+ 行，职责过多)
├── 各功能模块直接依赖全局变量
├── 状态分散在各模块
└── 耦合严重，难以测试
```

### 新架构 (v6.0.0)
```
微内核 + 插件化
├── Kernel (微内核)
│   ├── Store (集中状态管理)
│   ├── Router (路由系统)
│   ├── EventBus (事件总线)
│   └── PluginLoader (插件加载器)
│
├── Plugins (功能插件)
│   ├── records/ (记录管理)
│   ├── calendar/ (日历)
│   ├── timeline/ (时间线)
│   └── ...
│
├── Components (可复用组件)
│   ├── base/ (基础组件)
│   ├── list/ (列表组件)
│   └── layout/ (布局组件)
│
└── Services (服务层)
    ├── storage/ (数据服务)
    ├── sync/ (同步服务)
    └── crypto/ (加密服务)
```

---

## 📦 新增核心模块

### 1. Store - 集中状态管理
**文件：** `src/core/store.js`

**特性：**
- ✅ 单一数据源
- ✅ Action 驱动状态变更
- ✅ 订阅/发布模式
- ✅ 撤销/重做支持
- ✅ 中间件支持
- ✅ localStorage 持久化

**使用示例：**
```javascript
// 获取状态
const records = Store.getState('records.list');

// 订阅变化
Store.subscribe((newState, prevState) => {
  console.log('Records changed:', newState.records);
});

// 分发 Action
Store.dispatch({
  type: 'records/add',
  payload: newRecord
});

// 批量更新
Store.batch(dispatch => {
  dispatch({ type: 'records/add', payload: record1 });
  dispatch({ type: 'records/add', payload: record2 });
});
```

### 2. Router - 路由系统
**文件：** `src/core/router.js`

**特性：**
- ✅ 路由注册
- ✅ 参数传递
- ✅ 历史记录
- ✅ 路由守卫
- ✅ 浏览器前进/后退支持

**使用示例：**
```javascript
// 注册路由
Router.register('editor', {
  title: '编辑记录',
  component: 'record-editor',
  guard: ({ params }) => params.id !== undefined
});

// 导航
Router.navigate('editor', { id: 'rec_123' });

// 返回
Router.back();

// 订阅路由变化
Router.subscribe(route => {
  console.log('Current page:', route.path);
});
```

### 3. Kernel - 微内核
**文件：** `src/core/kernel.js`

**特性：**
- ✅ 插件注册/加载
- ✅ 启动序列管理
- ✅ 全局错误处理
- ✅ 生命周期管理

**使用示例：**
```javascript
// 注册插件
Kernel.registerPlugin('records', RecordsPlugin);

// 启动应用
await Kernel.boot({
  theme: 'light',
  language: 'zh-CN'
});

// 获取状态
const status = Kernel.getStatus();
```

### 4. PluginLoader - 插件加载器
**文件：** `src/core/plugin-loader.js`

**特性：**
- ✅ 依赖管理
- ✅ 拓扑排序加载
- ✅ 动态加载/卸载

**使用示例：**
```javascript
const loader = new PluginLoader(Kernel);

// 注册插件
loader.register('records', RecordsPlugin);
loader.register('calendar', CalendarPlugin);

// 加载所有 (自动处理依赖)
await loader.loadAll();
```

### 5. Records Plugin - 记录管理插件
**文件：** `src/plugins/records/index.js`

**特性：**
- ✅ CRUD 操作
- ✅ 筛选/搜索
- ✅ 数据标准化
- ✅ 事件触发

**Actions 支持：**
- `records/add` - 添加记录
- `records/update` - 更新记录
- `records/delete` - 删除记录
- `records/filter` - 筛选记录

---

## 🔄 迁移策略

### Phase 1: 核心架构 (已完成 ✅)
- [x] Store 实现
- [x] Router 实现
- [x] Kernel 实现
- [x] PluginLoader 实现
- [x] Records Plugin 实现
- [x] 主入口整合

### Phase 1.5: 风险修复 (已完成 ✅)
- [x] **IndexedDB 存储升级**：`src/services/storage.js` 替代 localStorage，解决性能瓶颈
- [x] **双向同步适配器**：`src/core/adapter.js` 解决新旧状态冲突
- [x] **Store 持久化更新**：支持异步 IndexedDB 读写

### Phase 2: 插件迁移 (已完成 ✅)
- [x] Calendar Plugin (日历视图)
- [x] Timeline Plugin (时间线/故事)
- [x] Editor Plugin (编辑器)
- [x] Favorites Plugin (收藏)
- [x] Templates Plugin (模板)
- [x] Sync Plugin (同步)
- [x] Settings Plugin (设置)

### Phase 3: UI 组件库 (已完成 ✅)
- [x] Base Components (Button, Input, Modal, Toast)
- [x] List Components (VirtualList, ItemCard)
- [x] Layout Components (TabBar, FAB, EmptyState)
- [x] 组件样式文件 (components.css)
- [x] 所有插件集成 UI 组件

### Phase 4: 服务层 (已完成 ✅)
- [x] Storage Service (原生 IndexedDB 重写，零依赖)
- [x] Sync Service (云端同步、冲突解决、状态管理)
- [x] Crypto Service (AES-GCM 加密、PBKDF2 密钥派生、SHA-256 Hash)
- [x] Image Service (压缩、缩略图、EXIF 旋转、Base64 转换)

### Phase 5: 测试与优化
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 代码分割

---

## 📊 代码统计

| 指标 | v5.0.0 | v6.0.0 (当前) | 变化 |
|:--|:--|:--|:--|
| 核心模块 | 3 | 5 | +2 |
| 插件 | 0 | 1 | +1 |
| 新增代码 | - | 1500+ 行 | - |
| app.js 行数 | 1662 | 1662 (兼容) | 待迁移 |

---

## 🧪 测试验证

### 语法检查
```bash
✅ src/core/store.js - 通过
✅ src/core/router.js - 通过
✅ src/core/kernel.js - 通过
✅ src/core/plugin-loader.js - 通过
✅ src/plugins/records/index.js - 通过
✅ src/main.js - 通过
```

### 功能测试 (待执行)
- [ ] Store 状态管理
- [ ] Router 路由切换
- [ ] Kernel 启动流程
- [ ] Records Plugin CRUD
- [ ] 与旧模块兼容性

---

## 🚀 部署

### 分支策略
- `main` - 稳定版 (v5.0.0)
- `v6-refactor` - 重构开发分支

### 合并流程
1. 在 `v6-refactor` 完成所有 Phase
2. 全面测试验证
3. 创建 Pull Request
4. Code Review
5. 合并到 `main`
6. 发布 v6.0.0

---

## 📝 开发指南

### 添加新插件
```javascript
// 1. 创建插件目录
mkdir src/plugins/my-plugin

// 2. 定义插件
const MyPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  dependencies: ['records'], // 可选依赖
  
  async init() { ... },
  async start() { ... },
  stop() { ... },
  
  routes: [ ... ],
  actions: { ... }
};

// 3. 注册插件
PluginLoader.register('my-plugin', MyPlugin);
```

### 状态管理最佳实践
```javascript
// ✅ 正确：通过 Action 变更状态
Store.dispatch({ type: 'records/add', payload: record });

// ❌ 错误：直接修改状态
Store.getState('records').list.push(record);

// ✅ 正确：订阅状态变化
Store.subscribe(state => {
  render(state.records.filtered);
});
```

---

## ️ 注意事项

1. **兼容性**：v6.0.0 保留旧模块以确保平滑迁移
2. **渐进式**：功能逐步从旧模块迁移到新插件
3. **测试**：每个模块迁移后必须运行测试
4. **文档**：所有公共 API 必须添加注释

---

*维护者：001 (餮) - 九子圆桌架构师*
