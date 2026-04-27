@echo off
chcp 65001 >nul
echo ========================================
echo 万物手札 H5 - 紧急推送
echo ========================================
echo.
echo 正在推送测试页面和 404 修复...
echo.

REM 尝试使用 GitHub Desktop 推送
echo 方法 1: 使用 GitHub Desktop 推送（推荐）
echo 1. 打开 GitHub Desktop
echo 2. 确认仓库：universal_journal_h5
echo 3. 点击 "Push origin"
echo.
pause

echo.
echo 方法 2: 使用 Token 推送
set /p TOKEN="输入 GitHub Token (ghp_开头): "
if "%TOKEN%"=="" (
    echo 未输入 Token，退出
    exit /b 1
)

git push https://xiaoyuran23-tech:%TOKEN%@github.com/xiaoyuran23-tech/universal_journal_h5.git main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ✅ 推送成功！
    echo ========================================
    echo.
    echo 请在 5-10 分钟后访问：
    echo.
    echo 1. 测试页面：
    echo https://xiaoyuran23-tech.github.io/universal_journal_h5/test-pages.html
    echo.
    echo 2. 主页（可能需要等待 CDN 刷新）：
    echo https://xiaoyuran23-tech.github.io/universal_journal_h5/
    echo.
    echo 3. 直接访问 index.html（立即可用）：
    echo https://xiaoyuran23-tech.github.io/universal_journal_h5/index.html
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ 推送失败
    echo ========================================
    echo.
    echo 请使用 GitHub Desktop 手动推送：
    echo 1. 打开 GitHub Desktop
    echo 2. File ^> Add Local Repository
    echo 3. 选择：D:\QwenPawOut001\universal_journal_h5
    echo 4. 点击 "Push origin"
    echo.
)

pause
