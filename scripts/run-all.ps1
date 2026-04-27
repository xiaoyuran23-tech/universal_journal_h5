# ===================================
# Nine Sons Defense - Full Check
# Run before every commit
# ===================================

$projectRoot = Split-Path $PSScriptRoot -Parent
$errors = 0

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "  Nine Sons Defense - Full Check" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# 1. Loop Detection
Write-Host "--- [1/5] Loop Detection ---" -ForegroundColor Magenta
try {
    & "$PSScriptRoot\loop-detect.ps1" -Minutes 60 -Threshold 10
} catch { $errors++ }

# 2. Structure Check
Write-Host "`n--- [2/5] Structure Check ---" -ForegroundColor Magenta
$mdCount = (Get-ChildItem $projectRoot -File -Filter "*.md" | Where-Object { $_.Name -notin @('README.md', 'DESIGN.md', 'AGENTS.md') }).Count
if ($mdCount -gt 0) {
    Write-Host "  [WARN] $mdCount temp .md files in root. Run cleanup-root.ps1" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Root directory is clean" -ForegroundColor Green
}

# 3. CSS Check
Write-Host "`n--- [3/5] CSS Syntax ---" -ForegroundColor Magenta
try {
    & "$PSScriptRoot\css-check.ps1"
} catch { $errors++ }

# 4. Quality Gate
Write-Host "`n--- [4/5] Quality Gate ---" -ForegroundColor Magenta
try {
    & "$PSScriptRoot\quality-gate.ps1"
} catch { $errors++ }

# 5. Smoke Test
Write-Host "`n--- [5/5] Smoke Test ---" -ForegroundColor Magenta
try {
    & "$PSScriptRoot\smoke-test.ps1" -FileMode
} catch { $errors++ }

# Summary
Write-Host "`n======================================`n" -ForegroundColor Cyan
if ($errors -gt 0) {
    Write-Host "[Defense] $errors check(s) FAILED" -ForegroundColor Red
    Write-Host "Please fix before committing." -ForegroundColor Red
    exit 1
} else {
    Write-Host "[Defense] ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host "Safe to commit." -ForegroundColor Green
}
