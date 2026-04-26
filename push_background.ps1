# 万物手札 H5 - 后台持续推送脚本

param(
    [int]$maxAttempts = 100,
    [int]$waitSeconds = 10
)

$token = "ghp_sn4KzJ0yXQl8K0j9z5xG8vN2mB7wP1qR4tY6"
$repoUrl = "https://$token@github.com/xiaoyuran23-tech/universal_journal_h5.git"
$attempt = 0

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  万物手札 H5 - 后台持续推送" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "配置:" -ForegroundColor Yellow
Write-Host "  最大尝试次数：$maxAttempts"
Write-Host "  每次间隔：${waitSeconds}秒"
Write-Host "  目标：xiaoyuran23-tech/universal_journal_h5"
Write-Host ""
Write-Host "开始持续推送..." -ForegroundColor Green
Write-Host ""

while ($attempt -lt $maxAttempts) {
    $attempt++
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    Write-Host "[$attempt/$maxAttempts] $timestamp" -ForegroundColor Cyan
    Write-Host "----------------------------------------"
    
    # 执行推送
    $output = git -c http.postBuffer=524288000 push $repoUrl main 2>&1
    $exitCode = $LASTEXITCODE
    
    # 显示输出
    if ($output) {
        $output | Out-String | Write-Host
    }
    
    # 检查结果
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  ✅ 推送成功！[尝试 $attempt]" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "时间：$(Get-Date)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "仓库：https://github.com/xiaoyuran23-tech/universal_journal_h5" -ForegroundColor Cyan
        Write-Host ""
        
        # 创建成功标记文件
        $successFile = "PUSH_SUCCESS_MARKER.txt"
        @"
推送成功！
时间：$(Get-Date)
尝试次数：$attempt
提交：$(git rev-parse HEAD)
"@ | Out-File -FilePath $successFile -Encoding utf8
        
        exit 0
    }
    
    Write-Host ""
    Write-Host "❌ 失败，等待 ${waitSeconds}秒后重试..." -ForegroundColor Yellow
    Write-Host ""
    
    # 等待
    Start-Sleep -Seconds $waitSeconds
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  ❌ 已达到最大尝试次数 ($maxAttempts)" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "建议:" -ForegroundColor Yellow
Write-Host "1. 检查网络连接" -ForegroundColor White
Write-Host "2. 使用 GitHub Desktop" -ForegroundColor White
Write-Host "3. 等待网络恢复后手动推送" -ForegroundColor White
Write-Host ""

# 创建失败标记文件
$failFile = "PUSH_FAILED_MARKER.txt"
@"
推送失败
时间：$(Get-Date)
尝试次数：$attempt
原因：网络连接 GitHub 失败
"@ | Out-File -FilePath $failFile -Encoding utf8

exit 1
