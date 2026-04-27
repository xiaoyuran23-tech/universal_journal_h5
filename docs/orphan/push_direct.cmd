@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo   万物手札 H5 - 直接推送（绕过 Bash）
echo ========================================
echo.

cd /d "%~dp0"

REM 清除所有可能触发 Bash 的环境变量
set GIT_ASKPASS=
set SSH_ASKPASS=
set GIT_SSH=
set GIT_SSH_COMMAND=

REM 强制使用 Windows 凭据管理器
set GIT_CREDENTIAL_HELPER=wincred

REM 设置 Token
set GITHUB_TOKEN=ghp_sn4KzJ0yXQl8K0j9z5xG8vN2mB7wP1qR4tY6

REM 配置 Git 使用 Windows 凭据
git config --global credential.helper wincred

echo 正在推送...
echo.

REM 使用环境变量传递 Token，避免 URL 中包含
setx GITHUB_TOKEN %GITHUB_TOKEN% /M 2>nul

REM 直接推送
git -c http.postBuffer=524288000 -c credential.helper=store push https://github.com/xiaoyuran23-tech/universal_journal_h5.git main

set EXIT_CODE=%ERRORLEVEL%

REM 清理环境变量
setx GITHUB_TOKEN "" /M 2>nul

echo.
if %EXIT_CODE% equ 0 (
    echo ========================================
    echo   ✅ 推送成功！
    echo ========================================
) else (
    echo ========================================
    echo   ❌ 推送失败
    echo ========================================
    echo.
    echo 错误码：%EXIT_CODE%
)

echo.
pause
exit /b %EXIT_CODE%
