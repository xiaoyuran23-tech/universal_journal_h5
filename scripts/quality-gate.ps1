# ===================================
# Quality Gate v1.0 - Run before every commit
# ===================================

$root = Split-Path $PSScriptRoot -Parent
$errors = @()
$warnings = @()
Write-Host "`n[Quality Gate] Checking..." -ForegroundColor Cyan

# 1. CSS brace matching
$cssFiles = Get-ChildItem $root -Filter "*.css" -Recurse | Where-Object { $_.FullName -notmatch "\\docs\\" -and $_.FullName -notmatch "\\backup_" }
foreach ($css in $cssFiles) {
    $content = Get-Content $css.FullName -Raw
    $opens = ([regex]::Matches($content, '\{')).Count
    $closes = ([regex]::Matches($content, '\}')).Count
    if ($opens -ne $closes) {
        $errors += "CSS brace mismatch: $($css.Name) (open=$opens, close=$closes)"
    }
}
if ($errors.Count -eq 0 -or $errors[-1] -notmatch "CSS") {
    Write-Host "  [OK] CSS braces balanced" -ForegroundColor Green
}

# 2. UTF-8 encoding check
$html = Get-Content "$root\index.html" -Encoding UTF8 -Raw
if ($html -notmatch 'charset.*UTF-8' -and $html -notmatch 'charset.*utf-8') {
    $errors += "index.html missing UTF-8 charset declaration"
} else {
    Write-Host "  [OK] UTF-8 charset declared" -ForegroundColor Green
}

# 3. Version consistency - match v2.2.1 pattern specifically
$htmlVersion = if ($html -match 'v(\d+\.\d+\.\d+)') { $matches[1] } else { $null }
$jsVersions = @()
$jsFiles = Get-ChildItem "$root\js" -Filter "*.js"
foreach ($js in $jsFiles) {
    $content = Get-Content $js.FullName -Raw
    # Match "version: '2.2.1'" pattern in JS
    if ($content -match "version:\s*'(\d+\.\d+\.\d+)'") {
        $jsVersions += $matches[1]
    }
}
if ($htmlVersion -and $jsVersions.Count -gt 0) {
    $allMatch = $true
    foreach ($v in $jsVersions) {
        if ($v -ne $htmlVersion) { $allMatch = $false; break }
    }
    if (-not $allMatch) {
        $errors += "Version mismatch: HTML=$htmlVersion, JS=$($jsVersions -join ',')"
    } else {
        Write-Host "  [OK] Version consistent: v$htmlVersion" -ForegroundColor Green
    }
}

# 4. Debounce check for search
$hasSearch = $false
$hasDebounce = $false
foreach ($js in $jsFiles) {
    $content = Get-Content $js.FullName -Raw
    if ($content -match 'search|filter|renderItems') { $hasSearch = $true }
    if ($content -match 'debounce|setTimeout|clearTimeout') { $hasDebounce = $true }
}
if ($hasSearch -and -not $hasDebounce) {
    $errors += "Search/filter feature missing debounce"
} elseif ($hasSearch -and $hasDebounce) {
    Write-Host "  [OK] Search debounce present" -ForegroundColor Green
}

# 5. DESIGN.md existence
if (-not (Test-Path "$root\DESIGN.md")) {
    $warnings += "DESIGN.md not found (recommended for new features)"
} else {
    Write-Host "  [OK] DESIGN.md exists" -ForegroundColor Green
}

# Output
Write-Host ""
if ($warnings.Count -gt 0) {
    Write-Host "[Quality Gate] WARNINGS:" -ForegroundColor Yellow
    $warnings | ForEach-Object { Write-Host "  [!] $_" -ForegroundColor Yellow }
    Write-Host ""
}

if ($errors.Count -gt 0) {
    Write-Host "[Quality Gate] FAILED ($($errors.Count) errors):" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  [X] $_" -ForegroundColor Red }
    Write-Host "`nPlease fix before committing." -ForegroundColor Red
    exit 1
} else {
    Write-Host "[Quality Gate] ALL PASSED" -ForegroundColor Green
}
