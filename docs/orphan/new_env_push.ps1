# 全新环境推送脚本
$ErrorActionPreference = "Stop"

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  万物手札 H5 - 全新环境推送" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# 清除所有可能的环境变量
$env:GITHUB_TOKEN = ""
Remove-Item Env:\GITHUB_TOKEN -ErrorAction SilentlyContinue

# 设置 Git 不使用任何 credential helper
$env:GIT_ASKPASS = ""
$env:SSH_AUTH_SOCK = ""

# 获取 gh 存储的 token
Write-Host "[1/4] 获取 GitHub CLI 存储的 token..." -ForegroundColor Yellow
$ghConfigPath = "$env:APPDATA\GitHub CLI\config.yml"
if (Test-Path $ghConfigPath) {
    $config = Get-Content $ghConfigPath -Raw
    Write-Host "      配置文件存在" -ForegroundColor Green
} else {
    Write-Host "      需要重新认证" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "      打开浏览器进行认证..." -ForegroundColor Cyan
    gh auth login -h github.com -p https -w
    if ($LASTEXITCODE -ne 0) {
        Write-Host "      认证失败" -ForegroundColor Red
        pause
        exit 1
    }
}
Write-Host ""

# 验证认证
Write-Host "[2/4] 验证 GitHub 认证..." -ForegroundColor Yellow
$token = gh auth token 2>$null
if ($token) {
    Write-Host "      Token 获取成功" -ForegroundColor Green
} else {
    Write-Host "      Token 获取失败" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# 设置 Git 使用 token
Write-Host "[3/4] 配置 Git 凭证..." -ForegroundColor Yellow
$repoUrl = "https://$($token):x-oauth-basic@github.com/xiaoyuran23-tech/universal_journal_h5.git"
git remote set-url origin $repoUrl
Write-Host "      凭证已配置" -ForegroundColor Green
Write-Host ""

# 推送
Write-Host "[4/4] 推送代码..." -ForegroundColor Yellow
Write-Host ""

Set-Location "D:\QwenPawOut001\universal_journal_h5"

git push -f origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "===================================" -ForegroundColor Green
    Write-Host "  推送成功！" -ForegroundColor Green
    Write-Host "===================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "网站将在 1-2 分钟后可用:" -ForegroundColor Cyan
    Write-Host "https://xiaoyuran23-tech.github.io/universal_journal_h5/" -ForegroundColor Blue
    Write-Host ""
    Start-Process "https://github.com/xiaoyuran23-tech/universal_journal_h5/actions"
} else {
    Write-Host ""
    Write-Host "===================================" -ForegroundColor Red
    Write-Host "  推送失败" -ForegroundColor Red
    Write-Host "===================================" -ForegroundColor Red
}

Write-Host ""
pause
