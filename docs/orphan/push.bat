@echo off
chcp 65001 >nul
echo ===================================
echo   万物手札 H5 - GitHub 推送
echo ===================================
echo.

cd /d "%~dp0"

echo [1/3] 清除 GITHUB_TOKEN 环境变量...
set GITHUB_TOKEN=
echo      已清除
echo.

echo [2/3] 检查 GitHub CLI 认证...
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo      未认证，正在打开浏览器...
    echo.
    echo 请在浏览器中完成认证
    echo.
    timeout /t 3 /nobreak >nul
    gh auth login -h github.com -p https -w
    if %ERRORLEVEL% NEQ 0 (
        echo      认证失败
        pause
        exit /b 1
    )
) else (
    echo      已认证
)
echo.

echo [3/3] 推送代码到 GitHub...
echo.

git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ===================================
    echo   推送失败
    echo ===================================
    echo.
    echo 请检查：
    echo 1. 网络连接
    echo 2. GitHub 账号权限
    echo 3. 仓库是否存在
    echo.
    pause
    exit /b 1
)

echo.
echo ===================================
echo   部署成功！
echo ===================================
echo.
echo 网站地址：
echo https://xiaoyuran23-tech.github.io/universal_journal_h5/
echo.
echo GitHub 仓库：
echo https://github.com/xiaoyuran23-tech/universal_journal_h5
echo.
echo 查看部署状态：
echo https://github.com/xiaoyuran23-tech/universal_journal_h5/actions
echo.

start https://github.com/xiaoyuran23-tech/universal_journal_h5

pause
