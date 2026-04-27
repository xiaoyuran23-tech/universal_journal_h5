# 万物手札 H5

> 记录世间万物，收藏生活点滴

![version](https://img.shields.io/badge/version-v2.1.2-blue)
![status](https://img.shields.io/badge/status-ready-green)
![platform](https://img.shields.io/badge/platform-web-lightgrey)

## 🎯 项目简介

**万物手札 H5** 是一个纯前端的物品记录管理应用，支持本地存储和云端同步。

### 核心特性

- 📦 **物品管理** - 创建、编辑、查看、搜索物品
- 🎨 **5 套主题** - 无界原白 / 模数框架 / 单色墨影 / 暖光纸本 / 深空墨色
- 📸 **照片上传** - 支持多张照片，IndexedDB 存储
- ☁️ **云端同步** - GitHub Gist 同步，AES-256-GCM 加密
- 📱 **完美适配** - iOS/Android/PC，PWA 支持
- 🔒 **隐私保护** - 客户端加密，零知识架构

## 🚀 快速开始

### 在线使用

**推荐 URL**（立即可用）:
```
https://xiaoyuran23-tech.github.io/universal_journal_h5/index.html
```

> ⚠️ 注意：根路径可能显示 404，请使用完整 `/index.html` 路径

### 本地运行

```bash
# 方法 1: 直接打开文件
在浏览器中打开 index.html

# 方法 2: 使用本地服务器
npx http-server -p 8080
# 访问 http://localhost:8080
```

### iOS 添加到主屏幕

1. Safari 打开应用 URL
2. 点击 **分享** 按钮
3. 选择 **"添加到主屏幕"**
4. 点击 **"添加"**

## 📊 功能完成度

### ✅ 已完成 (95%)

- [x] 物品 CRUD（创建/读取/更新）
- [x] 搜索与筛选
- [x] 5 套完整主题
- [x] 照片上传与管理
- [x] 云端同步（GitHub Gist）
- [x] 数据导入/导出
- [x] 密码保护
- [x] 数据统计
- [x] 收藏功能
- [x] iOS/Android 适配
- [x] PWA 支持

### ⏳ 计划中 (5%)

- [ ] 左滑删除手势
- [ ] 批量操作
- [ ] 回收站
- [ ] Service Worker 离线缓存

## 🛠️ 技术栈

- **前端**: HTML5 + CSS3 + Vanilla JavaScript
- **存储**: localStorage + IndexedDB
- **图表**: ECharts
- **云端**: GitHub Gist API
- **加密**: PBKDF2 + AES-256-GCM
- **部署**: GitHub Pages

## 📁 项目结构

```
universal_journal_h5/
├── index.html              # 主页面
├── style.css               # 主题样式（5 主题）
├── animations.css          # 动画系统
├── js/
│   ├── app.js             # 主逻辑
│   ├── idb.js             # IndexedDB 模块
│   ├── cloud-sync.js      # 云端同步模块
│   └── enhanced.js        # 增强功能
├── assets/                 # 图片资源
└── docs/                   # 文档
```

## 🧪 测试

### 功能测试

```bash
# 在浏览器中打开
file:///D:/QwenPawOut001/universal_journal_h5/index.html

# 测试清单
✅ FAB 按钮 - 点击打开创建表单
✅ 创建物品 - 填写表单并保存
✅ 编辑物品 - 详情页点击编辑按钮
✅ 主题切换 - 点击右上角太阳图标
✅ 数据持久化 - 刷新页面数据保留
```

### iOS 兼容性测试

访问诊断工具：
```
https://xiaoyuran23-tech.github.io/universal_journal_h5/ios-test.html
```

## 📖 使用指南

### 创建物品

1. 点击右下角蓝色 **+** 按钮
2. 填写名称（必填）
3. 选择品类、状态、日期（可选）
4. 添加备注和照片（可选）
5. 点击 **完成**

### 编辑物品

1. 点击物品卡片查看详情
2. 点击右上角 **编辑** 图标
3. 修改内容
4. 点击 **完成** 保存

### 切换主题

1. 点击右上角 **太阳** 图标
2. 选择喜欢的主题
3. 立即生效并自动保存

### 云端同步

1. 进入 **我** 页面
2. 点击 **云端同步**
3. 输入 GitHub Token 和加密密码
4. 点击 **测试连接**
5. 点击 **保存设置**

## 🔧 故障排查

### GitHub Pages 404

**问题**: 访问根路径显示 404  
**解决**: 使用完整路径 `/index.html`

### iOS 缓存问题

**问题**: 更新后仍显示旧版本  
**解决**: 
1. 删除主屏幕图标
2. Safari 清除缓存
3. 重新添加到主屏幕

### 数据丢失

**问题**: 刷新后数据不见  
**解决**: 
1. 检查浏览器是否禁用 localStorage
2. 尝试其他浏览器
3. 从云端同步恢复

## 📄 文档

- [项目完成度报告](PROJECT_COMPLETE_REPORT.md)
- [iOS 兼容性修复指南](IOS_FIX_GUIDE.md)
- [GitHub Pages 404 修复](GITHUB_PAGES_404_FIX.md)
- [测试报告](FINAL_TEST_REPORT.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 更新日志

### v2.1.2 (2026-04-27)
- ✅ iOS 兼容性修复
- ✅ localStorage 容错处理
- ✅ 安全区域适配
- ✅ 点击延迟优化

### v2.1.1 (2026-04-27)
- ✅ 编辑功能完善
- ✅ 日期字段显示修复
- ✅ 主题切换修复

### v2.1.0 (2026-04-26)
- ✅ 新增编辑功能
- ✅ 新增日期字段
- ✅ 云端同步模块

## 📧 联系方式

- **GitHub**: [@xiaoyuran23-tech](https://github.com/xiaoyuran23-tech)
- **项目地址**: [universal_journal_h5](https://github.com/xiaoyuran23-tech/universal_journal_h5)

## 📜 许可证

MIT License

---

**最后更新**: 2026-04-27  
**版本**: v2.1.2  
**状态**: ✅ 生产就绪
