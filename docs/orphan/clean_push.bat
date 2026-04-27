@echo off
chcp 65001 >nul
echo ===================================
echo   万物手札 H5 - 清除 Token 并推送
echo ===================================
echo.

echo [1/4] 清除用户级 GITHUB_TOKEN 环境变量...
powershell -Command "[Environment]::SetEnvironmentVariable('GITHUB_TOKEN', $null, 'User')"
echo      已清除
echo.

echo [2/4] 清除 gh 认证缓存...
del "%APPDATA%\GitHub CLI\hosts.yml" /q 2>nul
echo      已清除
echo.

echo [3/4] 启动新进程进行认证和推送...
echo.
echo 即将打开浏览器，请在浏览器中完成 GitHub 登录
echo.
pause

:: 使用全新进程执行
start "GitHub Push" powershell -NoProfile -WindowStyle Hidden -Command ^
    "$env:GITHUB_TOKEN=''; ^
     gh auth login -h github.com -p https -w; ^
     Start-Sleep -Seconds 10; ^
     Set-Location 'D:\QwenPawOut001\universal_journal_h5'; ^
     git push -u origin main; ^
     if ($LASTEXITCODE -eq 0) { ^
       Write-Host 'SUCCESS'; ^
       Start-Process 'https://github.com/xiaoyuran23-tech/universal_journal_h5/actions' ^
     } else { ^
       Write-Host 'FAILED' ^
     }"

echo.
echo [4/4] 已启动认证窗口，请在浏览器中完成登录...
echo.
echo 推送完成后会自动打开 GitHub Actions 页面
echo.

pause
