# 🚀 万物手札 H5 - 部署指南

**5 分钟完成 GitHub Pages 部署，手机随时访问**

---

## 📋 部署前准备

### 1. 安装 Git

**Windows:**
- 下载：https://git-scm.com/download/win
- 安装后重启终端

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt install git  # Ubuntu/Debian
sudo yum install git  # CentOS/RHEL
```

### 2. 创建 GitHub 账号

- 访问：https://github.com
- 注册免费账号
- 记住你的用户名

---

## 🚀 一键部署 (推荐)

### Windows 用户

1. **双击运行** `deploy.bat`

2. **输入 GitHub 用户名**
   ```
   请输入你的 GitHub 用户名：your-username
   ```

3. **输入 GitHub 凭证**
   - 用户名：你的 GitHub 用户名
   - 密码：GitHub 密码或个人访问 Token
   
   **使用 Token (推荐):**
   - 访问：https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 勾选 `repo` 权限
   - 复制生成的 Token 作为密码

4. **等待推送完成**
   ```
   [5/5] 提交并推送到 GitHub...
   部署成功！✓
   ```

5. **访问你的网站**
   ```
   https://your-username.github.io/universal_journal_h5/
   ```

### macOS/Linux 用户

1. **打开终端**，进入项目目录
   ```bash
   cd /path/to/universal_journal_h5
   ```

2. **赋予执行权限**
   ```bash
   chmod +x deploy.sh
   ```

3. **运行部署脚本**
   ```bash
   ./deploy.sh
   ```

4. **按提示输入 GitHub 用户名和凭证**

5. **访问你的网站**
   ```
   https://your-username.github.io/universal_journal_h5/
   ```

---

## 📱 在手机中使用

### 1. 获取网站链接

部署成功后，你的网站地址是：
```
https://你的用户名.github.io/universal_journal_h5/
```

### 2. 在手机上打开

**iOS (Safari):**
1. 打开 Safari
2. 访问你的网站链接
3. 点击底部「分享」按钮
4. 选择「添加到主屏幕」
5. 点击「添加」

**Android (Chrome):**
1. 打开 Chrome
2. 访问你的网站链接
3. 点击右上角「⋮」菜单
4. 选择「添加到主屏幕」
5. 点击「添加」

### 3. 像 App 一样使用

- 从主屏幕点击图标打开
- 全屏显示，无浏览器地址栏
- 支持离线访问 (部分功能)

---

## 🔧 手动部署 (备用方案)

如果自动脚本失败，可以手动部署：

### 1. 初始化 Git
```bash
git init
git checkout -b main
```

### 2. 添加所有文件
```bash
git add .
```

### 3. 提交
```bash
git commit -m "📦 万物手札 H5 - 初始版本"
```

### 4. 创建 GitHub 仓库

1. 访问：https://github.com/new
2. 仓库名：`universal_journal_h5`
3. 公开 (Public)
4. 点击「Create repository」

### 5. 添加远程仓库
```bash
git remote add origin https://github.com/你的用户名/universal_journal_h5.git
```

### 6. 推送
```bash
git push -u origin main
```

输入 GitHub 用户名和密码/Token

---

## ⚙️ GitHub Pages 配置

### 自动部署 (推荐)

项目已包含 `.github/workflows/deploy.yml`，推送到 `main` 分支后自动部署。

### 手动配置

1. 访问你的 GitHub 仓库
2. 点击「Settings」→「Pages」
3. Source 选择 `main` 分支
4. 点击「Save」

---

## 🔍 故障排查

### 问题 1: 推送失败

**错误信息:**
```
remote: Repository not found.
```

**解决方案:**
1. 确认 GitHub 仓库已创建
2. 确认用户名正确
3. 检查 Token 权限 (需要 `repo` 权限)

### 问题 2: 404 错误

**现象:** 访问网站显示 404

**解决方案:**
1. 等待 1-2 分钟 (GitHub Pages 需要构建时间)
2. 确认仓库是公开的 (Public)
3. 检查 Settings → Pages 配置

### 问题 3: 样式不加载

**现象:** 页面显示但无样式

**解决方案:**
1. 清除浏览器缓存
2. 强制刷新 (Ctrl+F5 或 Cmd+Shift+R)
3. 检查 CSS 文件路径是否正确

### 问题 4: 图片无法上传

**现象:** 上传图片失败

**解决方案:**
1. 检查图片大小 (建议 < 2MB)
2. 使用 JPG/PNG 格式
3. 清除浏览器 localStorage 重试

---

## 📊 部署后检查清单

- [ ] 网站可以正常访问
- [ ] 5 种主题可以切换
- [ ] 可以添加/编辑/删除物品
- [ ] 图片可以上传和显示
- [ ] 搜索和筛选功能正常
- [ ] 数据统计图表显示正常
- [ ] 手机上可以正常访问
- [ ] 添加到主屏幕后全屏显示

---

## 🎯 后续更新

### 更新代码

```bash
# 拉取最新代码 (如果有更新)
git pull origin main

# 修改后重新部署
git add .
git commit -m "更新说明"
git push
```

### 查看部署状态

1. 访问你的 GitHub 仓库
2. 点击「Actions」标签
3. 查看部署工作流状态
4. 绿色 ✓ 表示成功

---

## 📞 获取帮助

### GitHub 文档

- Git 基础：https://docs.github.com/en/get-started
- GitHub Pages: https://docs.github.com/en/pages
- Token 创建：https://docs.github.com/en/authentication

### 项目问题

- 查看 README.md
- 检查本部署指南
- 查看 GitHub Issues

---

**📦 万物手札 H5 - 部署完成**

**🎨 5 主题 · 一键部署 · 手机可用**

**🌐 你的网站：https://你的用户名.github.io/universal_journal_h5/**
