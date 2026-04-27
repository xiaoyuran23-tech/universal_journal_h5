@echo off
chcp 65001 >nul
echo ===================================
echo   万物手札 H5 - 本地启动
echo ===================================
echo.

:: 检查 Python 是否安装
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Python，请先安装 Python
    echo 下载地址：https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [✓] Python 已安装
echo.
echo 正在启动本地服务器...
echo.
echo 访问地址：http://localhost:8080
echo.
echo 按 Ctrl+C 停止服务器
echo.
echo ===================================
echo.

python -m http.server 8080

pause
