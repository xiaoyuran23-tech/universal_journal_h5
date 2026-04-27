@echo off
chcp 65001 >nul
echo ========================================
echo   万物手札 H5 - SSH 配置向导
echo ========================================
echo.

cd /d "%~dp0"

echo 本向导将帮你完成 SSH 推送配置
echo.
echo 当前状态:
echo   ✅ SSH 密钥已生成
echo   ✅ 远程仓库已配置为 SSH
echo   ✅ SSH 连接测试成功
echo   ⚠️  需要将公钥添加到 GitHub
echo.

echo [1/4] 查看 SSH 公钥
echo ========================================
echo.
echo 公钥内容（请复制整行）:
echo ----------------------------------------
type "%USERPROFILE%\.ssh\id_ed25519.pub"
echo ----------------------------------------
echo.

set /p copy_done=复制完成后按 Enter 继续...

echo.
echo [2/4] 选择 GitHub 账号
echo ========================================
echo.
echo 请选择你要使用的 GitHub 账号:
echo.
echo 1. Dlume (dlume@outlook.com) - 个人账号
echo 2. xiaoyuran23 (xiaoyuran23@gmail.com) - 组织账号
echo.
echo 当前 Git 配置:
git config user.email
git config user.name
echo.

set /p account_choice=请输入选择 (1 或 2): 
if "%account_choice%"=="1" (
    set github_user=Dlume
    set github_email=dlume@outlook.com
    goto account_selected
)
if "%account_choice%"=="2" (
    set github_user=xiaoyuran23
    set github_email=xiaoyuran23@gmail.com
    goto account_selected
)

echo 无效选择，使用默认账号 (Dlume)
set github_user=Dlume
set github_email=dlume@outlook.com

:account_selected
echo.
echo 已选择：%github_user% (%github_email%)
echo.

echo [3/4] 添加公钥到 GitHub
echo ========================================
echo.
echo 请按以下步骤操作:
echo.
echo 1. 打开浏览器访问:
echo    https://github.com/settings/keys
echo.
echo 2. 使用 %github_email% 登录 GitHub
echo.
echo 3. 点击 "New SSH key"
echo.
echo 4. 填写:
echo    Title: Universal Journal H5 - %COMPUTERNAME%
echo    Key: 粘贴刚才复制的公钥
echo.
echo 5. 点击 "Add SSH key"
echo.

set /p key_added=添加完成后按 Enter 继续...

echo.
echo [4/4] 测试推送
echo ========================================
echo.
echo 正在测试 SSH 连接...
ssh -T git@github.com 2>&1 | findstr /C:"successfully authenticated"
if %errorlevel% equ 0 (
    echo ✅ SSH 连接成功
) else (
    echo ⚠️  SSH 连接可能有问题，继续尝试推送...
)

echo.
echo 尝试推送到 GitHub...
echo.

git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✅ 推送成功！
    echo ========================================
    echo.
    echo 仓库地址:
    echo https://github.com/%github_user%/universal_journal_h5
    echo.
    echo 下一步:
    echo 1. 访问 GitHub 仓库验证
    echo 2. 查看 Actions 自动部署
    echo 3. 访问部署的站点测试
    echo.
) else (
    echo.
    echo ========================================
    echo   ⚠️  推送失败
    echo ========================================
    echo.
    echo 可能原因:
    echo 1. 公钥还未添加到 GitHub
    echo 2. 添加了错误的账号
    echo 3. 没有仓库权限
    echo.
    echo 解决方案:
    echo 1. 确认已登录正确的 GitHub 账号
    echo 2. 确认公钥已添加到该账号
    echo 3. 确认有仓库的写入权限
    echo.
    echo 查看详细指南：SSH_KEY_SETUP.md
    echo.
)

echo 按任意键退出...
pause >nul
