# ===================================
# 霸下 — 根目录清理脚本 v1.0
# 将临时文档从根目录移至 docs/ 子目录
# ===================================

$root = Split-Path $PSScriptRoot -Parent
$moved = 0
$skipped = 0

$allowedNames = @('index.html', 'style.css', 'animations.css', 'DESIGN.md', 'README.md', 'LICENSE', '.gitignore', 'AGENTS.md')
$allowedDirs = @('js', 'assets', 'scripts', 'docs', '.github', '.git')
$moveExtensions = @('.md', '.bat', '.txt', '.ps1', '.py', '.sh', '.vbs', '.cmd', '.png', '.svg', '.bak', '.html')

Write-Host ""
Write-Host "[霸下] 根目录清理开始..." -ForegroundColor Cyan

$orphanFiles = Get-ChildItem $root -File | Where-Object {
    $_.Name -notin $allowedNames -and $_.Extension -in $moveExtensions
}

$orphanDirs = Get-ChildItem $root -Directory | Where-Object {
    $_.Name -notin $allowedDirs -and $_.Name -notmatch '^\.'
}

$docsOrphan = Join-Path $root "docs\orphan"
if (-not (Test-Path $docsOrphan)) {
    New-Item -ItemType Directory -Path $docsOrphan -Force | Out-Null
}

foreach ($file in $orphanFiles) {
    try {
        Move-Item $file.FullName $docsOrphan -Force
        Write-Host "  -> $($file.Name) -> docs/orphan/" -ForegroundColor Gray
        $moved++
    } catch {
        Write-Host "  X skip $($file.Name): $_" -ForegroundColor Red
        $skipped++
    }
}

foreach ($dir in $orphanDirs) {
    $dest = Join-Path $root "docs\$($dir.Name)"
    try {
        Move-Item $dir.FullName $dest -Force
        Write-Host "  -> $($dir.Name)\ -> docs/$($dir.Name)/" -ForegroundColor Gray
        $moved++
    } catch {
        Write-Host "  X skip $($dir.Name)\: $_" -ForegroundColor Red
        $skipped++
    }
}

Write-Host ""
Write-Host "[霸下] 清理完成: moved=$moved, skipped=$skipped" -ForegroundColor $(if ($skipped -eq 0) { "Green" } else { "Yellow" })
