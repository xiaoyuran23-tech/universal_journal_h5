@echo off
chcp 65001 >nul
echo ========================================
echo   万物手札 H5 - 配置 SSH 推送
echo ========================================
echo.

cd /d "%~dp0"

echo 本脚本将帮你配置 SSH 方式推送到 GitHub
echo.
echo 优点:
echo   ✅ 稳定，不受网络波动影响
echo   ✅ 安全，使用密钥认证
echo   ✅ 方便，无需每次输入密码
echo.
echo 按任意键开始...
pause >nul

echo.
echo [1/5] 检查是否已有 SSH 密钥...
if exist "%USERPROFILE%\.ssh\id_ed25519.pub" (
    echo ✅ 已找到 SSH 密钥
    echo.
    echo 公钥文件：%USERPROFILE%\.ssh\id_ed25519.pub
    echo.
    echo 是否使用现有密钥？(Y/N)
    set /p use_existing=
    if /i "%use_existing%"=="Y" (
        goto show_pubkey
    )
)

echo 正在生成新的 SSH 密钥...
echo.

ssh-keygen -t ed25519 -C "your_email@example.com"

if %errorlevel% neq 0 (
    echo.
    echo ❌ 生成密钥失败
    echo 请确保已安装 Git 或 OpenSSH
    echo.
    pause
    exit /b 1
)

:show_pubkey
echo.
echo [2/5] 生成成功！现在需要添加公钥到 GitHub
echo.
echo 公钥内容:
echo ========================================
type "%USERPROFILE%\.ssh\id_ed25519.pub"
echo ========================================
echo.
echo [3/5] 请按以下步骤操作:
echo.
echo 1. 复制上面的公钥内容（整行，以 ssh-ed25519 开头）
echo.
echo 2. 打开浏览器访问:
echo    https://github.com/settings/keys
echo.
echo 3. 点击 "New SSH key"
echo.
echo 4. 填写:
echo    Title: Universal Journal H5
echo    Key: 粘贴刚才复制的公钥
echo.
echo 5. 点击 "Add SSH key"
echo.
echo 按任意键继续...
pause >nul

echo.
echo [4/5] 测试 GitHub SSH 连接...
echo.
ssh -T git@github.com

if %errorlevel% neq 0 (
    echo.
    echo ⚠️ SSH 连接测试失败
    echo.
    echo 可能原因:
    echo 1. 还未添加公钥到 GitHub（请返回步骤 3）
    echo 2. SSH 服务未运行
    echo 3. 防火墙阻止
    echo.
    echo 是否继续配置远程仓库？(Y/N)
    set /p continue=
    if /i not "%continue%"=="Y" (
        exit /b 1
    )
)

echo.
echo [5/5] 配置远程仓库使用 SSH...
echo.

REM 备份当前远程
git remote -v > "%~dp0\remote_backup.txt"

REM 更改为 SSH
git remote set-url origin git@github.com:xiaoyuran23-tech/universal_journal_h5.git

echo ✅ 远程仓库已更改为 SSH
echo.
echo 当前远程配置:
git remote -v
echo.

echo 测试推送...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✅ 配置成功！推送完成！
    echo ========================================
    echo.
    echo 仓库：https://github.com/xiaoyuran23-tech/universal_journal_h5
    echo.
    echo 以后推送只需运行:
    echo   git push origin main
    echo.
) else (
    echo.
    echo ========================================
    echo   ⚠️ 配置完成，但推送失败
    echo ========================================
    echo.
    echo 远程已配置为 SSH，但推送时出错
    echo 请检查:
    echo 1. SSH 密钥是否已添加到 GitHub
    echo 2. 网络连接是否正常
    echo 3. 是否有待推送的更改
    echo.
    echo 可以手动重试:
    echo   git push origin main
    echo.
)

echo 按任意键退出...
pause >nul
