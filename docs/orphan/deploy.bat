@echo off
chcp 65001 >nul
echo ===================================
echo   万物手札 H5 - GitHub 部署脚本
echo ===================================
echo.

:: 检查 Git 是否安装
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Git，请先安装 Git
    echo 下载地址：https://git-scm.com/download/win
    pause
    exit /b 1
)

echo [1/5] 检查 Git 安装... ✓
echo.

:: 获取 GitHub 用户名
set /p GITHUB_USERNAME="请输入你的 GitHub 用户名："
if "%GITHUB_USERNAME%"=="" (
    echo [错误] 用户名不能为空
    pause
    exit /b 1
)

echo [2/5] GitHub 用户名：%GITHUB_USERNAME%
echo.

:: 检查是否已初始化 Git
if not exist ".git" (
    echo [3/5] 初始化 Git 仓库...
    git init
    git checkout -b main
    echo Git 仓库初始化完成
) else (
    echo [3/5] Git 仓库已存在 ✓
)
echo.

:: 添加远程仓库
echo [4/5] 配置远程仓库...
git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USERNAME%/universal_journal_h5.git
echo 远程仓库已配置
echo.

:: 提交并推送
echo [5/5] 提交并推送到 GitHub...
echo.
git add .
git commit -m "📦 万物手札 H5 - 5 主题系统 + 按钮优化"

echo.
echo ===================================
echo   推送代码到 GitHub
echo ===================================
echo.
echo 请输入你的 GitHub 凭证 (用户名和密码/Token)
echo.
echo 如果使用 Token，请确保有 repo 权限
echo Token 获取：https://github.com/settings/tokens
echo.

git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ===================================
    echo   推送失败，请检查：
    echo   1. GitHub 用户名是否正确
    echo   2. 仓库是否已创建
    echo   3. 凭证是否正确
    echo ===================================
    echo.
    echo 手动创建仓库后重试：
    echo https://github.com/new
    echo 仓库名：universal_journal_h5
    echo.
    pause
    exit /b 1
)

echo.
echo ===================================
echo   部署成功！✓
echo ===================================
echo.
echo 你的网站将在以下地址可用：
echo https://%GITHUB_USERNAME%.github.io/universal_journal_h5/
echo.
echo GitHub 仓库：
echo https://github.com/%GITHUB_USERNAME%/universal_journal_h5
echo.
echo 部署可能需要 1-2 分钟，请刷新页面查看
echo.
pause
