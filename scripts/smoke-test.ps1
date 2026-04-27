# ===================================
# CHAOFENG (Smoke Test) v1.0
# Run before delivery to verify basics work
# ===================================

param(
    [string]$BaseUrl = "http://127.0.0.1:8080",
    [switch]$FileMode
)

$root = Split-Path $PSScriptRoot -Parent
$passed = 0
$failed = 0

function Write-Result {
    param($desc, $ok, $msg = "")
    if ($ok) {
        Write-Host "  [OK] $desc" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "  [FAIL] $desc" -ForegroundColor Red
        if ($msg) { Write-Host "     $msg" -ForegroundColor Red }
        $script:failed++
    }
}

Write-Host "`n[Smoke Test] Starting..." -ForegroundColor Cyan

if ($FileMode) {
    $checks = @(
        @{ name = "index.html"; path = "$root\index.html" },
        @{ name = "style.css"; path = "$root\style.css" },
        @{ name = "animations.css"; path = "$root\animations.css" },
        @{ name = "js/storage.js"; path = "$root\js\storage.js" },
        @{ name = "js/ui.js"; path = "$root\js\ui.js" },
        @{ name = "js/sync.js"; path = "$root\js\sync.js" },
        @{ name = "js/app.js"; path = "$root\js\app.js" },
        @{ name = "DESIGN.md"; path = "$root\DESIGN.md" },
        @{ name = "AGENTS.md"; path = "$root\AGENTS.md" }
    )
    
    foreach ($c in $checks) {
        $exists = Test-Path $c.path
        Write-Result -desc $c.name -ok $exists -msg "File not found"
    }
    
    # Encoding check
    $html = Get-Content "$root\index.html" -Encoding UTF8 -Raw
    $hasUtf8 = $html -match 'charset.*UTF-8'
    Write-Result -desc "UTF-8 encoding" -ok $hasUtf8
    
    # CSS brace check
    $css = Get-Content "$root\style.css" -Raw
    $openBraces = ([regex]::Matches($css, '\{')).Count
    $closeBraces = ([regex]::Matches($css, '\}')).Count
    Write-Result -desc "CSS braces balanced ($openBraces)" -ok ($openBraces -eq $closeBraces)
    
    # JS syntax check via node
    $jsFiles = Get-ChildItem "$root\js" -Filter "*.js"
    foreach ($js in $jsFiles) {
        $jsPath = $js.FullName.Replace('\', '/')
        $result = & node -e "try { require('fs').readFileSync('$jsPath', 'utf8'); console.log('ok') } catch(e) { console.log('fail') }" 2>$null
        $ok = ($result -eq 'ok')
        Write-Result -desc "$($js.Name) syntax" -ok $ok -msg $(if (-not $ok) { $result } else { "" })
    }
    
} else {
    function Test-Url {
        param($url, $desc)
        try {
            $resp = Invoke-WebRequest -Uri $url -TimeoutSec 5 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                Write-Result -desc "$desc (HTTP $($resp.StatusCode))" -ok $true
            } else {
                Write-Result -desc $desc -ok $false -msg "HTTP $($resp.StatusCode)"
            }
        } catch {
            Write-Result -desc $desc -ok $false -msg $_.Exception.Message
        }
    }
    
    Test-Url "$BaseUrl/index.html" "Home page"
    Test-Url "$BaseUrl/style.css" "CSS loaded"
    Test-Url "$BaseUrl/animations.css" "Animations loaded"
    Test-Url "$BaseUrl/js/storage.js" "Storage module"
    Test-Url "$BaseUrl/js/ui.js" "UI module"
    Test-Url "$BaseUrl/js/sync.js" "Sync module"
    Test-Url "$BaseUrl/js/app.js" "App module"
}

Write-Host "`n[Smoke Test] passed=$passed failed=$failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
if ($failed -gt 0) {
    Write-Host "[Smoke Test] FAILED - fix before deploying." -ForegroundColor Red
    exit 1
} else {
    Write-Host "[Smoke Test] ALL PASSED" -ForegroundColor Green
}
