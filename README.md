# 万物手札 H5

> 记录世间万物，收藏生活点滴

![version](https://img.shields.io/badge/version-v6.3.0-blue)
![status](https://img.shields.io/badge/status-active-green)
![platform](https://img.shields.io/badge/platform-web-lightgrey)
![license](https://img.shields.io/badge/license-MIT-green)

## 项目简介

**万物手札** 是一个纯前端的个人日记/笔记管理应用，采用微内核插件架构，支持离线使用、PWA 安装、云端同步。

### 核心特性

- **记录管理** - 富文本编辑器，支持图片、格式化工具
- **多维浏览** - 时间线、日历视图、关系图谱
- **全文搜索** - IndexedDB 游标遍历，中文分词友好
- **数据安全** - AES-256-GCM 客户端加密，PBKDF2 密钥派生
- **云端同步** - GitHub Gist / Git 仓库双同步方案
- **回顾机制** - 那年今日、每周回顾、月度总结
- **离线 AI** - 本地摘要生成、标签建议、情绪检测、写作辅助
- **键盘快捷键** - 全局快捷键 + 编辑器快捷键
- **回收站** - 软删除 + 恢复机制
- **Markdown 导入导出** - YAML frontmatter 元数据
- **关系图谱** - ECharts 力导向图可视化双向链接
- **插件系统** - 微内核架构，钩子/事件/路由/Store API

## 快速开始

### 本地开发

```bash
npm install
npm run dev
```

### 构建

```bash
npm run build
# 输出到 dist/ 目录
```

### 在线使用

直接访问 GitHub Pages 部署地址，或使用 PWA 安装到桌面/手机主屏幕。

### iOS / Android 安装到主屏幕

1. Safari / Chrome 打开应用 URL
2. 点击分享按钮
3. 选择「添加到主屏幕」
4. 点击添加

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | 原生 Vanilla JS (无框架依赖) |
| 架构 | 微内核 + 插件系统 |
| 存储 | IndexedDB (IDBModule + StorageBackend) |
| 路由 | Hash Router |
| 状态 | Store (发布订阅模式) |
| 加密 | Web Crypto API (AES-256-GCM + PBKDF2) |
| 图表 | ECharts (CDN 动态加载) |
| Git | isomorphic-git (CDN 动态加载) |
| 构建 | Vite |
| PWA | Service Worker + Web App Manifest |

## 项目结构

```
universal_journal_h5/
├── index.html                  # 主页面
├── style.css                   # 全局样式
├── animations.css              # 动画系统
├── sw.js                       # Service Worker (离线缓存)
├── manifest.json               # PWA 配置
├── capacitor.config.json       # Capacitor 原生包装配置
├── src/
│   ├── main.js                 # 应用入口
│   ├── core/                   # 核心基础设施
│   │   ├── store.js            # 状态管理 (撤销/重做/快照)
│   │   ├── router.js           # 路由系统
│   │   ├── hooks.js            # 插件钩子系统
│   │   ├── plugin-loader.js    # 插件加载器 + PluginAPI
│   │   ├── kernel.js           # 微内核
│   │   └── adapter.js          # 迁移适配器
│   ├── services/               # 服务层
│   │   ├── storage.js          # IndexedDB 存储
│   │   ├── crypto.js           # 加密服务
│   │   ├── sync.js             # Gist 同步
│   │   ├── git-sync.js         # Git 同步
│   │   ├── image.js            # 图片处理
│   │   ├── metadata.js         # 元数据提取
│   │   ├── migration.js        # DB Schema 迁移
│   │   ├── block-parser.js     # 块级数据解析
│   │   ├── link-parser.js      # 双向链接解析
│   │   └── ai-lite.js          # 离线 AI 写作辅助
│   ├── plugins/                # 插件层
│   │   ├── records/            # 记录管理
│   │   ├── calendar/           # 日历视图
│   │   ├── timeline/           # 时间线
│   │   ├── editor/             # 富文本编辑器
│   │   ├── favorites/          # 收藏
│   │   ├── templates/          # 模板
│   │   ├── sync/               # 同步设置
│   │   ├── settings/           # 设置
│   │   ├── security/           # 安全 (暴力破解防护)
│   │   ├── trash/              # 回收站
│   │   ├── batch/              # 批量操作
│   │   ├── draft/              # 草稿自动保存
│   │   ├── tags/               # 标签管理
│   │   ├── visuals/            # 可视化
│   │   ├── theme/              # 主题切换
│   │   ├── search/             # 全文搜索
│   │   ├── hotkeys/            # 键盘快捷键
│   │   ├── controller/         # 控制器
│   │   ├── markdown/           # Markdown 导入导出
│   │   ├── review/             # 回顾 (那年今日/周/月)
│   │   ├── graph/              # 关系图谱
│   │   └── example/            # 示例插件 (每日灵感)
│   ├── components/             # UI 组件
│   ├── hooks/                  # 数据聚合层
│   ├── views/                  # 页面视图
│   └── styles/                 # 主题样式
```

## 插件 API

插件通过 `PluginAPI` 与内核交互，提供以下接口：

| API | 功能 |
|---|---|
| `api.store` | 状态读写 (getState/dispatch/subscribe/undo/redo) |
| `api.storage` | 持久化存储 (get/put/delete/getAll) |
| `api.router` | 路由导航 (navigate/current) |
| `api.ui` | UI 操作 (toast/modal) |
| `api.events` | 事件总线 (on/off/emit/once) |
| `api.hooks` | 生命周期钩子 (register) |
| `api.kernel` | 内核信息 (hasPlugin/getPlugin/getStatus) |

### 创建插件

```js
const MyPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  dependencies: ['records'],

  async init(api) {
    api.hooks.register('record:afterSave', (data) => {
      console.log('Record saved:', data.record.id);
      return data;
    });
  },

  async start(api) {
    api.events.on('records:created', (record) => {
      api.ui.toast('新记录已创建');
    });
  },

  stop() { /* 清理资源 */ },

  routes: [
    { path: 'my-page', title: '我的页面', component: 'my-view' }
  ],
  actions: {},
};

window.MyPlugin = MyPlugin;
```

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+N` | 新建记录 |
| `Ctrl+F` | 搜索 |
| `Ctrl+S` | 保存 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Shift+Z` | 重做 |
| `Ctrl+/` | 快捷键帮助 |
| `Escape` | 返回上一页 |
| `Alt+1` | 首页 |
| `Alt+2` | 日历 |
| `Alt+3` | 时间线 |
| `Alt+4` | 收藏 |
| `Alt+5` | 设置 |

## 打包为原生应用

项目已内置 Capacitor 配置 (`capacitor.config.json`)，可打包为 iOS/Android 应用：

```bash
npm install @capacitor/cli @capacitor/core @capacitor/ios @capacitor/android
npx cap init
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios    # Xcode
npx cap open android # Android Studio
```

## 更新日志

### v6.3.0 (2026-05-01)
- 关系图谱可视化 (ECharts 力导向图)
- 离线 AI 写作辅助 (摘要/标签/情绪/写作建议)
- 插件生态 API (钩子/事件/Store/UI 路由)
- 块级数据模型 + 双向链接解析
- 回顾机制 (那年今日/每周/每月)
- Markdown 导入导出
- 全文搜索 (中文友好)
- 键盘快捷键系统
- DB Schema 版本迁移
- 每日灵感示例插件

### v6.2.0
- Git 同步 (isomorphic-git)
- 回收站 + 软删除
- 批量操作
- 草稿自动保存
- 标签管理

### v6.1.0
- UX 全面重构 (暖色主题)
- 富文本编辑器
- PWA Service Worker 离线缓存
- 数据安全 (暴力破解防护)
- Token 设备级加密

## 许可证

MIT License

---

**最后更新**: 2026-05-01
**版本**: v6.3.0
