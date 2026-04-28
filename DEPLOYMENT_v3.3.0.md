# 万物手札 v3.3.0 部署指南

## 版本概览

| 项目 | 详情 |
|------|------|
| **版本号** | v3.3.0-stable |
| **发布日期** | 2026-04-28 |
| **架构** | 单核控制器 + 插件模块（14 个 JS 模块） |
| **存储** | IndexedDB (idb.js) |
| **同步** | cloud-sync.js（当前为 localStorage 模拟桩） |

---

## 1. 文件清单

部署时只需以下文件/目录，**缺一不可**：

```
universal_journal_h5/
├── index.html              # 入口文件
├── style.css               # 主样式表
├── animations.css          # 动画样式
├── js/                     # 核心脚本（14 个文件）
│   ├── app.js              # 主控制器（调度中心）
│   ├── security.js         # 安全模块（Crypto/加密）
│   ├── theme.js            # 主题管理器
│   ├── tag-manager.js      # 标签管理器
│   ├── batch.js            # 批量操作管理器
│   ├── idb.js              # IndexedDB 存储层
│   ├── draft.js            # 草稿系统
│   ├── trash.js            # 回收站
│   ├── calendar.js         # 日历模块
│   ├── template.js         # 模板管理系统
│   ├── timeline.js         # 时间线视图
│   ├── visuals.js          # 数据可视化（ECharts）
│   ├── image-processor.js  # 图片处理
│   └── cloud-sync.js       # 云同步模块
└── assets/                 # 静态资源（图标、图片等）
```

### ❌ 已移除的文件（不再需要）
- ~~`js/sync.js`~~ — 旧版本地同步，已被 `cloud-sync.js` 取代
- ~~`js/storage.js`~~ — 废弃存储层，已迁移至 IndexedDB
- ~~`js/ui.js`~~ — 旧版 UI 逻辑，已整合至各模块

---

## 2. 环境要求

| 要求 | 说明 |
|------|------|
| **Web 服务器** | 任何静态文件服务器（Nginx、Apache、GitHub Pages、Vercel 等） |
| **HTTPS** | 推荐（PWA 安装和 Service Worker 需要） |
| **浏览器** | Chrome 88+ / Firefox 85+ / Safari 14+ / Edge 88+ |
| **IndexedDB 支持** | 必须（数据存储核心） |
| **屏幕适配** | 320px 起（移动端优先设计） |

---

## 3. 部署方式

### 3.1 本地测试

```bash
# 方式一：Python 3
cd universal_journal_h5
python -m http.server 8899

# 方式二：Node.js (需要 npx)
cd universal_journal_h5
npx serve -p 8899

# 访问 http://localhost:8899
```

### 3.2 GitHub Pages

1. 确保仓库根目录包含 `index.html`
2. 进入仓库 **Settings → Pages**
3. Source 选择 **main branch**，文件夹选 **/(root)**
4. 保存后等待 1-2 分钟部署
5. 访问 `https://<用户名>.github.io/<仓库名>/`

### 3.3 Nginx 配置示例

```nginx
server {
    listen 80;
    server_name journal.example.com;
    root /var/www/universal_journal_h5;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 强制 HTTPS（生产环境）
    # return 301 https://$host$request_uri;
}
```

### 3.4 Vercel / Netlify

直接连接仓库即可，无需额外配置（纯静态站点自动识别）。

---

## 4. 缓存策略

### ⚠️ 升级时必须强制刷新

由于所有资源文件带有 `?v=3.3.0` 版本号，浏览器缓存策略如下：

| 场景 | 操作 |
|------|------|
| **首次部署** | 无需特殊操作 |
| **版本升级** | 用户需 **Ctrl+F5**（Windows/Linux）或 **Cmd+Shift+R**（Mac） |
| **移动端** | 清除浏览器数据 / 使用无痕模式 |
| **PWA 已安装** | 需重新安装或清除 PWA 缓存 |

### 服务端缓存头推荐

```nginx
# index.html - 不缓存
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# CSS/JS - 长期缓存（有版本号）
location ~* \.(css|js)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# 图片资源
location ~* \.(png|jpg|jpeg|gif|svg|ico|webp)$ {
    add_header Cache-Control "public, max-age=86400";
}
```

---

## 5. 部署后验证清单

- [ ] 首页正常加载，无控制台报错
- [ ] 底部导航栏可切换所有页面（首页、日历、故事、我的）
- [ ] 新建日记功能正常（文字 + 图片）
- [ ] 分类管理：增、删、改均正常
- [ ] 模板管理：列表展示、使用模板、返回均正常
- [ ] 主题切换（深色/浅色）即时生效
- [ ] 数据可视化页面（ECharts 图表）正常渲染
- [ ] 回收站功能可用
- [ ] 云同步页面可打开（当前为模拟模式）
- [ ] 移动端适配正常（320px~768px 无横向滚动）

---

## 6. 常见问题

### Q: 部署后页面空白？
1. 检查浏览器控制台是否有 404 错误
2. 确认 `js/` 目录下 14 个文件全部存在
3. 确认 CDN 资源（ECharts）可访问
4. 尝试无痕模式打开排除缓存问题

### Q: 页面切换不生效（点击导航没反应）？
这是 v3.2.x 之前的旧 bug。v3.3.0 已在 `style.css` 中修复 `.page` / `.page.active` 切换逻辑。确认加载的是最新版本。

### Q: 分类管理弹窗不显示？
确认 `index.html` 中包含分类管理器 DOM 结构（`#category-modal` 等），且 `style.css` 中有 `.modal` / `.modal.active` 样式。

### Q: 图表页面空白？
ECharts 通过 CDN 加载（`https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js`）。检查网络是否可访问 jsdelivr CDN。

### Q: 云同步不可用？
`cloud-sync.js` 当前为 localStorage 模拟桩，仅支持本地演示。真实 GitHub Gist / 后端 API 同步需后续接入。

---

## 7. 版本变更记录 (v3.3.0)

### 架构重构
- 拆分 `app.js`（82KB → 52KB），独立出 `security.js`、`theme.js`、`tag-manager.js`、`batch.js`
- 移除废弃模块 `sync.js`、`storage.js`、`ui.js`

### 功能修复
- 补充 ECharts CDN 引用，修复图表页空白
- 修复 SPA 路由切换 CSS（`.page` / `.page.active`）
- 完善模板管理系统（渲染、使用、返回完整链路）
- 补全分类管理系统（CRUD 全流程 + 动态事件委托）
- 统一全量模块版本号至 v3.3.0

### 规范改进
- 全局事件委托统一使用 `document.addEventListener` + `e.target.closest()`
- 空状态使用内联 SVG，消除外部路径失效风险
- 新增模块通过 `window.ModuleName` 全局暴露，由 `App.init()` 统一调度

---

## 8. 联系方式 & 反馈

遇到问题请提交 Issue 或联系项目维护者。

---

*部署指南 v1.0 — 适用于万物手札 v3.3.0-stable*
