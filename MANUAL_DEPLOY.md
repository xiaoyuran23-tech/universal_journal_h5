# 🚀 万物手札 H5 - 手动部署指南

**由于系统环境变量 GITHUB_TOKEN 干扰，请使用以下方法完成部署**

---

## ⚠️ 问题说明

当前系统环境中存在无效的 `GITHUB_TOKEN` 环境变量，导致所有 Git 和 GitHub CLI 操作失败。

**已尝试的解决方案：**
- ✅ 清除用户级环境变量
- ✅ 清除 gh 认证缓存
- ✅ 启动新进程认证
- ❌ 仍受当前会话环境变量影响

---

## ✅ 推荐方案：GitHub Desktop

**这是最简单、最可靠的方式**

### 步骤 1：下载并安装

访问：https://desktop.github.com/download/

下载安装 GitHub Desktop

### 步骤 2：登录 GitHub

打开 GitHub Desktop，使用账号 `xiaoyuran23-tech` 登录

### 步骤 3：克隆仓库

1. File → Clone repository
2. 选择 `xiaoyuran23-tech/universal_journal_h5`
3. 选择保存路径（如 `C:\Users\PC\Documents\GitHub\universal_journal_h5`）
4. 点击 Clone

### 步骤 4：复制项目文件

1. 打开文件资源管理器
2. 进入 `D:\QwenPawOut001\universal_journal_h5`
3. 全选所有文件和文件夹（Ctrl+A）
4. 复制（Ctrl+C）
5. 打开 GitHub Desktop 克隆的文件夹
6. 粘贴（Ctrl+V）
7. 覆盖提示选择"是"

### 步骤 5：提交并推送

1. 回到 GitHub Desktop
2. 看到变更的文件列表
3. 输入提交信息：`📦 万物手札 H5 - 5 主题系统 + 按钮优化`
4. 点击 "Commit to main"
5. 点击 "Push origin"

**完成！** 🎉

---

## 🌐 部署成功后

### 1. 查看部署状态

访问：https://github.com/xiaoyuran23-tech/universal_journal_h5/actions

等待 GitHub Actions 完成部署（约 1-2 分钟）

### 2. 访问你的网站

```
https://xiaoyuran23-tech.github.io/universal_journal_h5/
```

### 3. 在手机上使用

1. 手机浏览器访问上方链接
2. 分享 → 添加到主屏幕
3. 像 App 一样使用（支持 5 种主题切换）

---

## 📋 备选方案：手动上传文件

### 步骤 1：访问上传页面

https://github.com/xiaoyuran23-tech/universal_journal_h5/upload/main

### 步骤 2：上传文件

点击 "Choose your files" 或拖拽以下文件：

**必须上传：**
- `index.html`
- `css/style.css`
- `js/app.js`
- `js/charts.js`
- `assets/empty.png`
- `.github/workflows/deploy.yml`
- `README.md`

**可选上传：**
- `deploy.bat`
- `deploy.sh`
- `start.bat`
- `start.sh`
- 其他文档

### 步骤 3：提交更改

1. 输入提交信息：`📦 万物手札 H5 - 初始版本`
2. 点击 "Commit changes"

### 步骤 4：启用 Pages

1. 访问：https://github.com/xiaoyuran23-tech/universal_journal_h5/settings/pages
2. Source 选择 `main` 分支
3. 点击 "Save"

---

## 🔧 清除 GITHUB_TOKEN（可选）

如果你想彻底解决此问题：

### Windows 10/11

1. 按 `Win + I` 打开设置
2. 搜索 "环境变量"
3. 点击 "编辑账户的环境变量"
4. 在"用户变量"中找到 `GITHUB_TOKEN`
5. 点击"删除"
6. 点击"确定"保存
7. **重启电脑**使更改生效

### 重启后执行推送

```bash
cd D:\QwenPawOut001\universal_journal_h5
git push -u origin main
```

---

## 📞 快速链接

| 功能 | 链接 |
| :--- | :--- |
| GitHub 仓库 | https://github.com/xiaoyuran23-tech/universal_journal_h5 |
| 上传页面 | https://github.com/xiaoyuran23-tech/universal_journal_h5/upload/main |
| Actions 状态 | https://github.com/xiaoyuran23-tech/universal_journal_h5/actions |
| Pages 设置 | https://github.com/xiaoyuran23-tech/universal_journal_h5/settings/pages |
| GitHub Desktop | https://desktop.github.com |
| 你的网站 | https://xiaoyuran23-tech.github.io/universal_journal_h5/ |

---

**📦 万物手札 H5 - 等待部署完成**

**🎨 5 主题 · 艺术级设计 · 手机可用**
