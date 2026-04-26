Set WshShell = CreateObject("WScript.Shell")
Set objEnv = WshShell.Environment("PROCESS")

' 清除 GITHUB_TOKEN
objEnv("GITHUB_TOKEN") = ""

' 执行推送命令
strCommand = "cmd /c ""cd /d D:\QwenPawOut001\universal_journal_h5 && git push -u origin main"""
intReturn = WshShell.Run(strCommand, 1, True)

WScript.Echo "Push completed with exit code: " & intReturn
If intReturn = 0 Then
    WScript.Echo "Success!"
Else
    WScript.Echo "Failed. Please try again."
End If
