# ☁️ 万物手札 H5 - 云端同步指南

##  两种同步方式

### 1️⃣ 数据同步（推荐用户）
**用途**: 将你的记录数据同步到云端，多设备共享
**方式**: GitHub Gist（免费、安全、加密）

### 2️ 代码同步（推荐开发者）
**用途**: 将代码部署到 GitHub，用于版本控制和部署
**方式**: Git 推送

---

## 📊 方案 1: 数据同步（GitHub Gist）

### 步骤 1: 获取 GitHub Token

1. 访问：https://github.com/settings/tokens
2. 点击 **"Generate new token (classic)"**
3. 填写说明：`Universal Journal Sync`
4. 勾选权限：**`gist`** ✅
5. 点击 **"Generate token"**
6. **复制 Token**（格式：`ghp_xxxxxxxxxxxx`）
   - ⚠️ **重要**: Token 只显示一次，请妥善保存！

### 步骤 2: 配置应用

1. 打开应用：http://localhost:8080
2. 点击底部导航：**我**
3. 找到 **云端同步** 部分
4. 点击 **☁️ 同步设置**

5. 填写配置：
   ```
   GitHub Token: ghp_xxxxxxxxxxxx
   加密密码：****** (至少 6 位，用于加密数据)
   Gist 描述：Universal Journal Backup
   ```

6. 点击 **测试连接**
   - ✅ 连接成功 → 继续
   - ❌ 连接失败 → 检查 Token 是否正确

7. 点击 **保存设置**

### 步骤 3: 执行同步

#### 首次同步（上传）
```
我 → 云端同步 → 📤 上传到云端
```
- 将本地所有数据加密后上传到 GitHub Gist
- 创建私密 Gist（仅你可见）

#### 后续同步
```
🔄 双向同步（推荐）
```
- 自动合并本地和云端数据
- 智能解决冲突
- 仅同步变更部分（增量同步）

### 安全说明

🔒 **零知识加密**:
- 数据在本地加密后才上传
- GitHub 无法查看你的数据内容
- 只有你知道解密密码

 **加密算法**:
- PBKDF2 密钥派生
- AES-256-GCM 加密
- 每次同步使用不同随机数

### 查看云端数据

1. 访问你的 Gist: https://gist.github.com/
2. 登录后找到 `Universal Journal Backup`
3. 看到加密的数据文件（不可读）
   - `journal_data_encrypted.json` - 加密的数据
   - `journal_metadata.json` - 同步元数据

---

## 💻 方案 2: 代码同步（Git 推送）

### 前置条件

1. **Git 已安装**
   ```bash
   git --version
   ```

2. **GitHub 账号**
   - 访问：https://github.com

3. **仓库已创建**
   - 当前仓库：https://github.com/xiaoyuran23-tech/universal_journal_h5

### 方法 A: 使用推送脚本（推荐）

1. 双击运行：
   ```
   push_to_github.bat
   ```

2. 首次需要输入凭据：
   ```
   Username: 你的 GitHub 用户名
   Password: 你的 GitHub Token（推荐）或密码
   ```

3. 看到 ✅ 推送成功 即完成

### 方法 B: 手动推送

```bash
cd universal_journal_h5

# 查看状态
git status

# 添加所有更改
git add -A

# 提交更改
git commit -m "feat: 你的更新说明"

# 推送到 GitHub
git push origin main
```

### 配置 Git 凭据（避免重复输入）

```bash
# Windows 使用凭据管理器
git config --global credential.helper wincred

# 或使用 Token
git config --global credential.helper store
```

### 使用 SSH（可选，更安全）

1. 生成 SSH 密钥：
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. 添加公钥到 GitHub：
   - 访问：https://github.com/settings/keys
   - 点击 "New SSH key"
   - 粘贴 `~/.ssh/id_ed25519.pub` 内容

3. 更改远程仓库为 SSH：
   ```bash
   git remote set-url origin git@github.com:xiaoyuran23-tech/universal_journal_h5.git
   ```

4. 推送：
   ```bash
   git push origin main
   ```

---

## 🔄 同步策略建议

### 个人用户
```
✅ 使用 GitHub Gist 数据同步
✅ 每天自动同步一次
✅ 重要修改后手动同步
```

### 开发者
```
✅ 代码使用 Git 推送
✅ 数据使用 Gist 同步
✅ 每次功能完成后推送代码
```

### 团队协作
```
✅ 代码：Git + Pull Request
✅ 数据：各自使用自己的 Gist
✅ 不共享数据，只共享代码
```

---

## ⚠️ 常见问题

### Q1: Token 无效？
**A**: 检查：
- Token 是否正确复制（无空格）
- 是否勾选了 `gist` 权限
- Token 是否过期（建议设置永不过期）

### Q2: 同步冲突？
**A**: 应用会自动解决：
- 本地和云端都修改 → 显示冲突解决界面
- 仅一端修改 → 自动合并
- 建议：定期同步，避免长期不同步

### Q3: 数据丢失？
**A**: 不会丢失：
- 同步前自动备份
- 冲突时可手动选择保留哪个版本
- 云端和本地都有完整数据

### Q4: 推送失败？
**A**: 检查：
- 网络连接
- GitHub 凭据
- 仓库权限（是否私有）
- 使用 Token 代替密码

### Q5: 如何取消同步？
**A**: 
```
我 → 云端同步 → 同步设置 → 清除配置
```
- 清除后不再自动同步
- 已上传的数据可手动删除 Gist

---

## 📞 获取帮助

### 文档
- 应用内：我 → ️ 关于手札
- GitHub: https://github.com/xiaoyuran23-tech/universal_journal_h5

### 技术支持
- 提交 Issue: https://github.com/xiaoyuran23-tech/universal_journal_h5/issues
- 邮件联系（如有）

---

## 🎯 最佳实践

### ✅ 推荐
- 每天同步一次数据
- 重要修改后立即同步
- 使用强加密密码（12 位以上）
- 定期备份到多个位置
- 使用 Token 而非密码

### ❌ 避免
- 在公共电脑配置同步
- 分享你的 Token 和密码
- 长期不同步（超过 1 个月）
- 在多个设备同时修改同一数据
- 使用弱密码（少于 6 位）

---

## 📊 同步状态说明

| 状态 | 说明 | 操作 |
|------|------|------|
| 未配置 | 未设置云端同步 | 配置 Token 和密码 |
| 已连接 | Token 有效，可同步 | 执行同步 |
| 同步中 | 正在上传/下载 | 等待完成 |
| 同步完成 | 上次同步成功 | 查看同步时间 |
| 同步失败 | 网络或配置问题 | 检查并重试 |
| 冲突 | 两端数据不一致 | 手动解决冲突 |

---

**版本**: v2.1.0  
**更新**: 2025-04-26  
**文档**: 云端同步完整指南
