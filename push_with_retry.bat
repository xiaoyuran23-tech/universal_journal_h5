@echo off
chcp 65001 >nul
echo ========================================
echo   万物手札 H5 - 推送（带重试）
echo ========================================
echo.

cd /d "%~dp0"

REM 测试网络连接
echo [1/4] 正在测试 GitHub 连接...
ping -n 2 github.com >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ 无法连接到 GitHub
    echo.
    echo 建议:
    echo 1. 检查网络连接
    echo 2. 关闭代理/VPN
    echo 3. 尝试切换网络（如手机热点）
    echo 4. 使用 SSH 代替 HTTPS（推荐）
    echo.
    echo 配置 SSH 方法:
    echo   git remote set-url origin git@github.com:xiaoyuran23-tech/universal_journal_h5.git
    echo.
    pause
    exit /b 1
)

echo ✅ GitHub 连接正常
echo.

REM 显示当前状态
echo [2/4] 当前 Git 状态:
git log --oneline -3
echo.

REM 尝试推送（最多 3 次）
set retry=0
:push_loop
set /a retry+=1
echo [3/4] 第 %retry% 次尝试推送...
echo.

git push origin main 2>&1

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✅ 推送成功！
    echo ========================================
    echo.
    echo 仓库：https://github.com/xiaoyuran23-tech/universal_journal_h5
    echo.
    echo 下一步:
    echo 1. 访问 GitHub 仓库验证
    echo 2. 查看 Actions 自动部署
    echo 3. 访问部署的站点测试
    echo.
    goto success
)

if %retry% lss 3 (
    echo.
    echo ⚠️ 推送失败，5 秒后重试...
    echo.
    timeout /t 5 /nobreak >nul
    goto push_loop
)

:failed
echo.
echo ========================================
echo   ❌ 推送失败（已尝试 3 次）
echo ========================================
echo.
echo 可能的原因:
echo 1. 网络连接不稳定
echo 2. 需要 GitHub 认证
echo 3. 防火墙/代理阻止
echo.
echo 解决方案:
echo.
echo 方案 1: 使用 SSH（推荐，最稳定）
echo   git remote set-url origin git@github.com:xiaoyuran23-tech/universal_journal_h5.git
echo   git push origin main
echo.
echo 方案 2: 使用 GitHub Desktop（最简单）
echo   下载：https://desktop.github.com/
echo   添加仓库后点击 Push
echo.
echo 方案 3: 检查认证配置
echo   git config --global credential.helper wincred
echo   然后重新运行此脚本
echo.
echo 方案 4: 查看详细错误
echo   git push origin main --verbose
echo.
pause
exit /b 1

:success
REM 添加到 Git 并 commit
git add PUSH_FAILED_NETWORK.md push_with_retry.bat 2>nul
if %errorlevel% equ 0 (
    git diff --cached --quiet
    if %errorlevel% neq 0 (
        echo [4/4] 提交文档...
        git commit -m "docs: 添加推送故障排查文档" 2>nul
    )
)

pause
