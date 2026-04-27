@echo off
chcp 65001 >nul

:: 创建临时批处理文件
set "tempScript=%temp%\push_github_%random%.bat"

> "%tempScript%" (
    echo @echo off
    echo chcp 65001 ^>nul
    echo cd /d D:\QwenPawOut001\universal_journal_h5
    echo git push -f origin main
    echo if %%ERRORLEVEL%% EQU 0 ^(
    echo     echo SUCCESS
    echo     start https://github.com/xiaoyuran23-tech/universal_journal_h5/actions
    echo ^) else ^(
    echo     echo FAILED
    echo ^)
    echo pause
)

:: 使用 schtasks 创建一次性任务（全新环境）
set "taskName=GitHubPush_%random%"
schtasks /create /tn "%taskName%" /tr "\"%tempScript%\"" /sc once /st 00:00 /rl highest /ru "%USERNAME%" /f >nul 2>&1

:: 立即运行任务
schtasks /run /tn "%taskName%" >nul 2>&1

:: 等待任务完成
timeout /t 30 /nobreak >nul

:: 删除任务
schtasks /delete /tn "%taskName%" /f >nul 2>&1

:: 清理临时文件
del "%tempScript%" /f /q >nul 2>&1

echo.
echo 任务已执行，请检查推送结果
