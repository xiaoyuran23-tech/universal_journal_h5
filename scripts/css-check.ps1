# ===================================
# YAZI (CSS Syntax Check) v1.0
# ===================================

param([string]$File)

$root = Split-Path $PSScriptRoot -Parent
$errors = @()

if ($File) {
    $cssFiles = @(Get-Item (Join-Path $root $File))
} else {
    $cssFiles = Get-ChildItem $root -Filter "*.css" -Recurse | Where-Object { $_.FullName -notmatch "\\docs\\" -and $_.FullName -notmatch "\\backup_" }
}

Write-Host "`n[CSS Check] Scanning..." -ForegroundColor Cyan

foreach ($css in $cssFiles) {
    $content = Get-Content $css.FullName -Raw
    $relPath = $css.FullName.Replace($root, '').TrimStart('\')
    $fileErrors = @()
    
    $opens = ([regex]::Matches($content, '\{')).Count
    $closes = ([regex]::Matches($content, '\}')).Count
    if ($opens -ne $closes) {
        $fileErrors += "Brace mismatch (open=$opens, close=$closes)"
    }
    
    if ($content -match '[#.\w-]+\s*\{[\s\n]*\}') {
        $fileErrors += "Empty selector found"
    }
    
    if ($fileErrors.Count -gt 0) {
        $errors += "$relPath :"
        $fileErrors | ForEach-Object { $errors += "    $_" }
    } else {
        Write-Host "  [OK] $relPath" -ForegroundColor Green
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`n[CSS Check] FAILED:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
} else {
    Write-Host "`n[CSS Check] ALL PASSED" -ForegroundColor Green
}
