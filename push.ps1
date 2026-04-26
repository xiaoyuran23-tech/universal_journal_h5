# 万物手札 H5 - GitHub 推送脚本
# 清除 GITHUB_TOKEN 环境变量并使用 gh 认证推送

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  万物手札 H5 - GitHub 推送" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# 进入项目目录
Set-Location "D:\QwenPawOut001\universal_journal_h5"

# 清除 GITHUB_TOKEN 环境变量（当前进程）
if (Test-Path Env:\GITHUB_TOKEN) {
    Write-Host "[1/4] 清除 GITHUB_TOKEN 环境变量..." -ForegroundColor Yellow
    Remove-Item Env:\GITHUB_TOKEN
    Write-Host "      已清除 ✓" -ForegroundColor Green
} else {
    Write-Host "[1/4] GITHUB_TOKEN 不存在，跳过 ✓" -ForegroundColor Green
}
Write-Host ""

# 检查 gh 是否已认证
Write-Host "[2/4] 检查 GitHub CLI 认证状态..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      已认证 ✓" -ForegroundColor Green
} else {
    Write-Host "      未认证，请登录..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "      即将打开浏览器，请在浏览器中完成认证" -ForegroundColor Cyan
    Write-Host ""
    Start-Sleep -Seconds 2
    gh auth login -h github.com -p https -w
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "      认证失败，请重试" -ForegroundColor Red
        exit 1
    }
    Write-Host "      认证成功 ✓" -ForegroundColor Green
}
Write-Host ""

# 推送代码
Write-Host "[3/4] 推送代码到 GitHub..." -ForegroundColor Yellow
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "      推送成功 ✓" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "      推送失败" -ForegroundColor Red
    Write-Host ""
    Write-Host "===================================" -ForegroundColor Red
    Write-Host "  推送失败，请检查：" -ForegroundColor Red
    Write-Host "  1. 网络连接是否正常" -ForegroundColor Yellow
    Write-Host "  2. GitHub 账号是否有权限" -ForegroundColor Yellow
    Write-Host "  3. 仓库是否存在" -ForegroundColor Yellow
    Write-Host "===================================" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 完成
Write-Host "[4/4] 部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  部署成功！✓" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "你的网站将在 1-2 分钟后可用：" -ForegroundColor Cyan
Write-Host "https://xiaoyuran23-tech.github.io/universal_journal_h5/" -ForegroundColor Blue
Write-Host ""
Write-Host "GitHub 仓库：" -ForegroundColor Cyan
Write-Host "https://github.com/xiaoyuran23-tech/universal_journal_h5" -ForegroundColor Blue
Write-Host ""
Write-Host "查看部署状态：" -ForegroundColor Cyan
Write-Host "https://github.com/xiaoyuran23-tech/universal_journal_h5/actions" -ForegroundColor Blue
Write-Host ""

# 打开浏览器
Write-Host "正在打开 GitHub 仓库页面..." -ForegroundColor Yellow
Start-Process "https://github.com/xiaoyuran23-tech/universal_journal_h5"
Write-Host ""
