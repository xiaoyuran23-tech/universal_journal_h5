@echo off
chcp 65001 >nul
echo ===================================
echo   万物手札 H5 - GitHub 认证并推送
echo ===================================
echo.

:: 清除 GITHUB_TOKEN 环境变量（临时）
set GITHUB_TOKEN=

echo [1/3] 清除旧认证...
gh auth logout -h github.com 2>nul

echo.
echo [2/3] 请登录 GitHub
echo.
echo 即将打开浏览器，请在浏览器中完成登录
echo.
echo 按任意键继续...
pause >nul

gh auth login -h github.com -p https -w

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [错误] 登录失败，请重试
    pause
    exit /b 1
)

echo.
echo [3/3] 推送代码到 GitHub...
echo.

cd /d "%~dp0"

git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ===================================
    echo   推送失败，请检查网络连接
    echo ===================================
    pause
    exit /b 1
)

echo.
echo ===================================
echo   部署成功！✓
echo ===================================
echo.
echo 你的网站将在以下地址可用：
echo https://xiaoyuran23-tech.github.io/universal_journal_h5/
echo.
echo GitHub 仓库：
echo https://github.com/xiaoyuran23-tech/universal_journal_h5
echo.
echo 部署可能需要 1-2 分钟，请刷新页面查看
echo.

pause
