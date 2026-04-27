@echo off
chcp 65001 >nul
echo 尝试推送（大缓冲模式）...
echo.

cd /d "%~dp0"

REM 设置 Git 参数
set GIT_HTTP_LOW_SPEED_LIMIT=0
set GIT_HTTP_LOW_SPEED_TIME=300

REM 执行推送
git -c http.postBuffer=524288000 push origin main --verbose

echo.
if %errorlevel% equ 0 (
    echo ✅ 推送成功
) else (
    echo ❌ 推送失败
)

echo.
pause
