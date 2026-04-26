# 万物手札 H5 - 完整部署脚本
# 请在新的 PowerShell 窗口中运行此脚本

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  万物手札 H5 - GitHub 部署" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# 1. 清除环境变量
Write-Host "[1/5] 清除 GITHUB_TOKEN 环境变量..." -ForegroundColor Yellow
$env:GITHUB_TOKEN = ""
Remove-Item Env:\GITHUB_TOKEN -ErrorAction SilentlyContinue
Write-Host "      已清除" -ForegroundColor Green
Write-Host ""

# 2. 清除 gh 缓存
Write-Host "[2/5] 清除 GitHub CLI 缓存..." -ForegroundColor Yellow
$ghConfigPath = "$env:APPDATA\GitHub CLI\hosts.yml"
if (Test-Path $ghConfigPath) {
    Remove-Item $ghConfigPath -Force
    Write-Host "      已清除" -ForegroundColor Green
} else {
    Write-Host "      无需清除" -ForegroundColor Gray
}
Write-Host ""

# 3. GitHub 认证
Write-Host "[3/5] GitHub 认证..." -ForegroundColor Yellow
Write-Host ""
Write-Host "      即将打开浏览器，请在浏览器中完成登录" -ForegroundColor Cyan
Write-Host ""

gh auth login -h github.com -p https -w

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "      认证失败" -ForegroundColor Red
    Write-Host ""
    Write-Host "      请手动运行：gh auth login -h github.com -p https -w" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "      认证成功" -ForegroundColor Green
Write-Host ""

# 4. 验证认证
Write-Host "[4/5] 验证认证状态..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      验证成功" -ForegroundColor Green
} else {
    Write-Host "      验证失败" -ForegroundColor Red
    Write-Host ""
    Write-Host $authStatus -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# 5. 推送代码
Write-Host "[5/5] 推送代码到 GitHub..." -ForegroundColor Yellow
Write-Host ""

Set-Location "D:\QwenPawOut001\universal_journal_h5"

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "===================================" -ForegroundColor Green
    Write-Host "  部署成功！" -ForegroundColor Green
    Write-Host "===================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "网站地址：" -ForegroundColor Cyan
    Write-Host "https://xiaoyuran23-tech.github.io/universal_journal_h5/" -ForegroundColor Blue
    Write-Host ""
    Write-Host "查看部署状态：" -ForegroundColor Cyan
    Start-Process "https://github.com/xiaoyuran23-tech/universal_journal_h5/actions"
} else {
    Write-Host ""
    Write-Host "===================================" -ForegroundColor Red
    Write-Host "  推送失败" -ForegroundColor Red
    Write-Host "===================================" -ForegroundColor Red
}

Write-Host ""
pause
