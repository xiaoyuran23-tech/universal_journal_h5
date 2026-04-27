# ===================================
# PULAO (Loop Detection) v1.0
# Detects if files are being modified repeatedly in a short time
# ===================================

param(
    [string]$File,
    [int]$Minutes = 30,
    [int]$Threshold = 5
)

$root = Split-Path $PSScriptRoot -Parent
$warnings = @()

if ($File) {
    $targets = @(Get-Item (Join-Path $root $File))
} else {
    $targets = Get-ChildItem $root -Filter "*.md" -Recurse | Where-Object {
        $_.FullName -notmatch "\\docs\\" -and $_.FullName -notmatch "\\backup_" -and $_.Name -ne "README.md"
    }
}

Write-Host "`n[Loop Detection] Last $Minutes minutes..." -ForegroundColor Cyan

foreach ($target in $targets) {
    $gitCount = 0
    
    try {
        $commits = git -C $root log --oneline --since="$Minutes minutes ago" -- $target.Name 2>$null
        if ($commits) {
            $gitCount = ($commits | Measure-Object -Line).Lines
        }
    } catch {}
    
    if ($gitCount -ge $Threshold) {
        $warnings += "$($target.Name) changed $gitCount times in $Minutes min (threshold: $Threshold)"
        Write-Host "  [WARN] $($target.Name): $gitCount changes" -ForegroundColor Yellow
    }
}

if ($warnings.Count -gt 0) {
    Write-Host "`n[Loop Detection] WARNINGS (consider pausing):" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "  -> $_" -ForegroundColor Yellow }
} else {
    Write-Host "[Loop Detection] OK - no loops detected" -ForegroundColor Green
}
