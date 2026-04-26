@echo off
chcp 65001 >nul
echo ===================================
echo   万物手札 H5 - GitHub 推送
echo ===================================
echo.

cd /d "%~dp0"

echo [1/2] 推送代码到 GitHub...
echo.

:: 使用 start /B 启动新窗口，不继承当前会话环境变量
start /B /WAIT cmd /c "git push -u origin main"

echo.
echo [2/2] 检查推送结果...
echo.

:: 检查远程仓库
git ls-remote origin main >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ===================================
    echo   推送成功！
    echo ===================================
    echo.
    echo 网站地址：
    echo https://xiaoyuran23-tech.github.io/universal_journal_h5/
    echo.
    echo 查看部署状态：
    echo https://github.com/xiaoyuran23-tech/universal_journal_h5/actions
    echo.
    start https://github.com/xiaoyuran23-tech/universal_journal_h5/actions
) else (
    echo ===================================
    echo   推送失败
    echo ===================================
    echo.
    echo 请尝试以下方式：
    echo 1. 重启命令行窗口
    echo 2. 运行：gh auth login
    echo 3. 重新推送
    echo.
)

pause
