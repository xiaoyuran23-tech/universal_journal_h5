@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: 使用 setlocal 创建独立环境，清除 GITHUB_TOKEN
setlocal
set GITHUB_TOKEN=

:: 在独立环境中执行推送
git push -u origin main

endlocal
pause
