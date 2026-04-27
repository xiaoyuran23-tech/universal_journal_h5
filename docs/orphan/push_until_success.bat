@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   万物手札 H5 - 持续推送（直到成功）
echo ========================================
echo.

cd /d "%~dp0"

set TOKEN=ghp_sn4KzJ0yXQl8K0j9z5xG8vN2mB7wP1qR4tY6
set REPO_URL=https://%TOKEN%@github.com/xiaoyuran23-tech/universal_journal_h5.git
set max_attempts=50
set wait_time=5
set attempt=0

echo 配置:
echo   最大尝试次数：%max_attempts%
echo   每次间隔：%wait_time% 秒
echo   目标：%REPO_URL%
echo.
echo 开始持续推送...
echo.

:push_loop
set /a attempt+=1

echo [尝试 %attempt%/%max_attempts%] %date% %time%
echo ----------------------------------------

REM 执行推送
git -c http.postBuffer=524288000 push %REPO_URL% main 2>&1

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✅ 推送成功！[尝试 %attempt%]
    echo ========================================
    echo.
    echo 时间：%date% %time%
    echo.
    goto success
)

echo ❌ 失败，等待 %wait_time% 秒后重试...
echo.

REM 等待
timeout /t %wait_time% /nobreak >nul

REM 检查是否达到最大尝试次数
if %attempt% geq %max_attempts% (
    echo.
    echo ========================================
    echo   ❌ 已达到最大尝试次数 (%max_attempts%)
    echo ========================================
    echo.
    echo 建议:
    echo 1. 检查网络连接
    echo 2. 使用 GitHub Desktop
    echo 3. 等待网络恢复后手动推送
    echo.
    goto failed
)

goto push_loop

:success
echo 仓库：https://github.com/xiaoyuran23-tech/universal_journal_h5
echo.
pause
exit /b 0

:failed
pause
exit /b 1
