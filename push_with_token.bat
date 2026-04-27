@echo off
chcp 65001 >nul
echo ========================================
echo   万物手札 H5 - 使用 Token 推送
echo ========================================
echo.

cd /d "%~dp0"

echo 请使用 GitHub Personal Access Token
echo.
echo 获取 Token:
echo 1. 访问：https://github.com/settings/tokens
echo 2. 创建新 Token (classic)
echo 3. 勾选 repo 权限
echo 4. 复制 Token (ghp_xxxxxxxxxxxx)
echo.

set /p GITHUB_TOKEN=请输入你的 GitHub Token: 

if "%GITHUB_TOKEN%"=="" (
    echo ❌ Token 不能为空
    pause
    exit /b 1
)

echo.
echo 配置 Git 凭据...
git config --global credential.helper store

echo.
echo 设置临时凭据...
echo https://%GITHUB_TOKEN%@github.com > "%TEMP%\git-creds.txt"

echo.
echo 尝试推送...
git push https://%GITHUB_TOKEN%@github.com/xiaoyuran23-tech/universal_journal_h5.git main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   ✅ 推送成功！
    echo ========================================
    echo.
    echo 仓库：https://github.com/xiaoyuran23-tech/universal_journal_h5
    echo.
) else (
    echo.
    echo ========================================
    echo   ❌ 推送失败
    echo ========================================
    echo.
    echo 可能原因:
    echo 1. Token 无效或过期
    echo 2. Token 权限不足
    echo 3. 网络连接问题
    echo.
)

REM 清理临时文件
del "%TEMP%\git-creds.txt" 2>nul

echo.
pause
