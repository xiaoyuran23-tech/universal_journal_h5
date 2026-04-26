# 📦 万物手札 H5

**5 主题系统 · 艺术级设计 · 一键部署**

纯前端 H5 网页应用，无需后端，数据存储在本地 localStorage。支持 5 种精美主题，一键部署到 GitHub Pages。

---

## 🎨 5 种主题

| 主题 | 名称 | 风格 | 配色 |
| :--- | :--- | :--- | :--- |
| **void** | 无界原白 | 纯白极简 | 白 + 灰 + 黑 |
| **grid** | 模数框架 | 理性网格 | 浅灰 + 蓝 |
| **ink** | 单色墨影 | 艺术水墨 | 米白 + 墨黑 |
| **warm** | 暖光纸本 | 温暖纸质 | 暖白 + 棕 |
| **dark** | 深空墨色 | 深邃暗黑 | 深黑 + 蓝 |

### 主题预览

#### 1. 无界原白 (The Void)
纯白背景与深灰文字，大面积留白构建秩序，营造最纯粹的书写体验。

```
背景：#ffffff  文字：#2c2c2c  强调：#1a1a1a
```

#### 2. 模数框架 (Grid System)
严谨的网格化布局，极细线条区分内容块，强调理性的逻辑与归纳。

```
背景：#f5f5f7  文字：#1d1d1f  强调：#0071e3 (苹果蓝)
```

#### 3. 单色墨影 (Monochrome Ink)
极具艺术感的黑白单色风格，非对称构图，让每条记录如艺术品般呈现。

```
背景：#faf9f7  文字：#1a1a1a  强调：#2c2c2c (墨黑)
```

#### 4. 暖光纸本 (Warm Paper)
温暖纸质质感，适合长时间阅读与书写，如翻阅旧手札。

```
背景：#f8f5f0  文字：#3d342b  强调：#8b7355 (暖棕)
```

#### 5. 深空墨色 (Deep Space)
深邃暗黑主题，护眼且富有科技感，适合夜间使用。

```
背景：#0d0d0f  文字：#f5f5f7  强调：#0a84ff (深蓝)
```

---

##  快速开始

### 方式 1: 本地运行

```bash
# Windows
双击 start.bat

# macOS/Linux
chmod +x start.sh
./start.sh

# Python 手动
python -m http.server 8080
```

访问：http://localhost:8080

### 方式 2: 部署到 GitHub Pages (推荐)

```bash
# Windows
双击 deploy.bat

# macOS/Linux
chmod +x deploy.sh
./deploy.sh
```

按提示输入 GitHub 用户名，自动完成部署。

访问：`https://你的用户名.github.io/universal_journal_h5/`

---

## 📱 手机使用指南

### 部署后在手机上访问

1. **完成 GitHub 部署**
   ```bash
   ./deploy.bat  # 或 ./deploy.sh
   ```

2. **获取你的网站地址**
   ```
   https://你的用户名.github.io/universal_journal_h5/
   ```

3. **在手机上打开链接**
   - Safari (iOS) 或 Chrome (Android)
   - 可添加到主屏幕，像 App 一样使用

4. **添加到主屏幕**
   - iOS Safari: 分享 → 添加到主屏幕
   - Android Chrome: 菜单 → 添加到主屏幕

---

## 📁 项目结构

```
universal_journal_h5/
├── index.html              # 主页面 (含主题选择器)
├── css/
│   └── style.css           # 5 主题样式 (23.4 KB)
├── js/
│   ├── app.js              # 主应用逻辑 (含主题管理)
│   └── charts.js           # ECharts 图表
├── assets/
│   └── empty.png           # 单色墨影图标
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions 自动部署
├── deploy.bat / .sh        # 一键部署脚本
├── start.bat / .sh         # 本地启动脚本
└── README.md               # 本文件
```

---

## ✨ 核心功能

| 功能 | 说明 |
| :--- | :--- |
| 🎨 **5 主题切换** | 无界原白/模数框架/单色墨影/暖光纸本/深空墨色 |
| 📝 **物品录入** | 名称/品类/状态/备注/多图上传 |
| 📋 **物品列表** | 网格布局 + 黑白封面悬停变色 |
| 🔍 **搜索筛选** | 关键词搜索 + 品类横向筛选 |
| 📊 **数据统计** | ECharts 图表 + 主题适配 |
| 📱 **响应式** | 适配手机/平板/桌面端 |
| 💾 **本地存储** | localStorage 持久化 |
|  **一键部署** | 自动推送到 GitHub Pages |

---

## 🎯 按钮系统优化

### 按钮类型

| 类型 | 类名 | 用途 |
| :--- | :--- | :--- |
| 主按钮 | `btn-primary` | 主要操作 (提交/保存) |
| 次按钮 | `btn-secondary` | 次要操作 (取消/返回) |
| 幽灵按钮 | `btn-ghost` | 弱化操作 (删除/更多) |
| 危险按钮 | `btn-danger` | 危险操作 (删除确认) |

### 按钮尺寸

| 尺寸 | 类名 | 用途 |
| :--- | :--- | :--- |
| 小 | `btn-sm` | 紧凑操作 |
| 默认 | - | 标准操作 |
| 大 | `btn-lg` | 强调操作 |
| 图标 | `btn-icon` | 圆形图标按钮 |

### 按钮特效

- ✅ 渐变光泽悬停效果
- ✅ 点击缩放反馈
- ✅ 阴影深度变化
- ✅ 禁用状态灰度
- ✅ 主题色自适应

---

## 🎨 设计细节

### 图片处理 - 单色墨影

```css
/* 默认黑白 */
.item-image {
  filter: grayscale(100%);
  transition: filter 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

/* 悬停复彩 */
.item-card:hover .item-image {
  filter: grayscale(0%);
}
```

### 淡入淡出 - 浮动焦点

```css
.page {
  opacity: 0;
  transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.page.active {
  opacity: 1;
}
```

### 主题切换

```css
[data-theme="void"] { /* 无界原白 */ }
[data-theme="grid"] { /* 模数框架 */ }
[data-theme="ink"] { /* 单色墨影 */ }
[data-theme="warm"] { /* 暖光纸本 */ }
[data-theme="dark"] { /* 深空墨色 */ }
```

---

## 🌐 浏览器兼容性

| 浏览器 | 最低版本 |
| :--- | :--- |
| Chrome | 60+ |
| Safari | 12+ |
| Firefox | 60+ |
| Edge | 79+ |
| 微信内置浏览器 | ✅ 支持 |

---

## ⚠️ 注意事项

1. **数据备份**: 数据存储在浏览器 localStorage，清除浏览器数据会丢失
2. **图片大小**: Base64 存储会膨胀约 33%，建议上传前压缩
3. **跨设备**: 当前版本不支持跨设备同步
4. **GitHub 部署**: 需要 GitHub 账号，仓库必须公开才能使用免费 Pages

---

## 🚀 扩展方向

### P1 (高优先级)
- [ ] 数据导出/导入 (JSON)
- [ ] 批量删除/编辑
- [ ] 更多主题 (靛蓝/赭石/墨绿)

### P2 (中优先级)
- [ ] PWA 支持 (离线访问)
- [ ] 云同步 (Firebase/LeanCloud)
- [ ] 主题自定义 (颜色选择器)

### P3 (低优先级)
- [ ] 分享海报生成
- [ ] 物品时间线
- [ ] 书法字体支持

---

## 📄 开源协议

MIT License

---

## 🙏 致谢

- **ECharts**: 数据可视化库
- **无印良品**: 极简设计灵感
- **原研哉**: 《设计中的设计》
- **GitHub Pages**: 免费静态网站托管

---

**📦 记录世间万物，收藏生活点滴**

**🎨 5 主题 · 一键部署 · 手机可用**
