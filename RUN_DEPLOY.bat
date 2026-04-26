@echo off
chcp 65001 >nul
echo ===================================
echo   万物手札 H5 - 启动部署
echo ===================================
echo.
echo 正在打开新的 PowerShell 窗口...
echo.
echo 请在新窗口中完成 GitHub 认证和推送
echo.

start "万物手札部署" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_final.ps1"

echo 新窗口已打开，请在新窗口中操作
echo.
pause
