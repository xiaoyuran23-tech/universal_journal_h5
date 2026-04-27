@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   万物手札 H5 - GitHub Desktop 推送
echo ========================================
echo.
echo  正在打开 GitHub Desktop...
echo.
echo  请在 GitHub Desktop 中：
echo  1. 确认仓库：universal_journal_h5
echo  2. 点击 "Push origin" 按钮
echo.
echo  推送完成后，按任意键继续...
pause >nul

echo.
echo 正在验证推送...
git fetch origin
for /f "tokens=*" %%i in ('git rev-parse HEAD') do set LOCAL_HEAD=%%i
for /f "tokens=*" %%i in ('git rev-parse origin/main') do set REMOTE_HEAD=%%i

if "%LOCAL_HEAD%"=="%REMOTE_HEAD%" (
    echo.
    echo ========================================
    echo   推送成功！
    echo ========================================
    echo.
    echo  GitHub Pages 将在 5-10 分钟后更新
    echo.
    echo  请访问：
    echo  https://xiaoyuran23-tech.github.io/universal_journal_h5/index.html
    echo.
) else (
    echo.
    echo ========================================
    echo   尚未推送
    echo ========================================
    echo.
    echo  请返回 GitHub Desktop 点击 "Push origin"
    echo.
)

pause
