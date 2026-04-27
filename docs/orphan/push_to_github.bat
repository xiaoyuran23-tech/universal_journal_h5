@echo off
echo ========================================
echo   万物手札 H5 - 推送到 GitHub
echo ========================================
echo.

cd /d "%~dp0"

echo 正在推送到 GitHub...
echo.

REM 使用 Git 推送
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✅ 推送成功！
    echo ========================================
    echo.
    echo GitHub 仓库：https://github.com/xiaoyuran23-tech/universal_journal_h5
    echo.
) else (
    echo.
    echo ========================================
    echo   ❌ 推送失败
    echo ========================================
    echo.
    echo 可能的原因：
    echo 1. 需要配置 GitHub 凭据
    echo 2. 网络连接问题
    echo 3. 仓库权限问题
    echo.
    echo 解决方法：
    echo 1. 运行：git config --global credential.helper wincred
    echo 2. 然后重新运行此脚本
    echo 3. 输入 GitHub 用户名和密码/Token
    echo.
)

pause
