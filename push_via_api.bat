@echo off
chcp 65001 >nul
echo ========================================
echo   万物手札 H5 - 使用 GitHub API 推送
echo ========================================
echo.

cd /d "%~dp0"

set TOKEN=ghp_sn4KzJ0yXQl8K0j9z5xG8vN2mB7wP1qR4tY6
set REPO=xiaoyuran23-tech/universal_journal_h5

echo 正在通过 GitHub API 推送...
echo.

REM 获取当前分支的 SHA
echo [1/3] 获取最新提交 SHA...
curl -s -H "Authorization: token %TOKEN%" ^
  -H "Accept: application/vnd.github.v3+json" ^
  https://api.github.com/repos/%REPO%/git/refs/heads/main > "%TEMP%\ref.json"

REM 解析 SHA（简单方式）
for /f "tokens=2 delims=:" %%a in ('findstr /i "sha" "%TEMP%\ref.json"') do (
    set SHA=%%a
    goto found
)

:found
echo SHA: %SHA%
echo.

echo [2/3] 创建 Git 树...
REM 这里需要复杂的 Git 树创建逻辑
echo ⚠️  API 推送复杂，建议使用其他方式
echo.

echo [3/3] 建议方案:
echo.
echo 1. 使用 GitHub Desktop（最简单）
echo    下载：https://desktop.github.com/
echo.
echo 2. 等待网络恢复后使用 git push
echo.
echo 3. 使用 WSL 或 Git Bash
echo.

del "%TEMP%\ref.json" 2>nul

pause
