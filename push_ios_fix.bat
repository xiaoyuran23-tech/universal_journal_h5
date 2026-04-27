@echo off
echo ========================================
echo 万物手札 H5 - GitHub 推送工具
echo ========================================
echo.
echo 请使用 GitHub Desktop 推送：
echo 1. 打开 GitHub Desktop
echo 2. 确认已登录 xiaoyuran23-tech 账号
echo 3. File → Add Local Repository
echo 4. 选择：D:\QwenPawOut001\universal_journal_h5
echo 5. 点击 "Push origin" 按钮
echo.
echo 或者手动输入经典 PAT Token:
set /p TOKEN="输入 Token (ghp_开头): "
if "%TOKEN%"=="" (
    echo 未输入 Token，退出
    exit /b 1
)

echo.
echo 正在推送...
git push https://xiaoyuran23-tech:%TOKEN%@github.com/xiaoyuran23-tech/universal_journal_h5.git main

if %errorlevel% equ 0 (
    echo.
    echo ✅ 推送成功！
    echo.
    echo GitHub Pages 将在 1-2 分钟内自动更新
    echo 访问：https://xiaoyuran23-tech.github.io/universal_journal_h5/
) else (
    echo.
    echo ❌ 推送失败，请检查 Token 是否正确
    echo.
    echo 建议使用 GitHub Desktop 推送
)

pause
