# Automated verification check for SEO fixes
# Run: powershell -ExecutionPolicy Bypass -File tests/verify_seo_fixes.ps1

$baseDir = Split-Path -Parent $PSScriptRoot
Write-Host "Running SEO verification in: $baseDir" -ForegroundColor Cyan

$failures = 0

function Assert-Condition($condition, $message) {
    if (-not $condition) {
        Write-Host "  [FAIL] $message" -ForegroundColor Red
        $script:failures++
    } else {
        Write-Host "  [PASS] $message" -ForegroundColor Green
    }
}

# 1. Check sitemap.xml
$sitemapPath = Join-Path $baseDir "sitemap.xml"
$sitemapText = [System.IO.File]::ReadAllText($sitemapPath)
Assert-Condition (-not $sitemapText.Contains("https://shader7.com/")) "sitemap.xml has no bare domain links"
Assert-Condition ($sitemapText.Contains("https://www.shader7.com/")) "sitemap.xml has www domain links"
Assert-Condition (-not $sitemapText.Contains("cvbanao/template")) "sitemap.xml does not contain noindexed resume templates"

# 2. Check robots.txt
$robotsPath = Join-Path $baseDir "robots.txt"
$robotsText = [System.IO.File]::ReadAllText($robotsPath)
Assert-Condition ($robotsText.Contains("Sitemap: https://www.shader7.com/sitemap.xml")) "robots.txt points to www sitemap"

# 3. Check HTML canonicals
$htmlFiles = Get-ChildItem -Path $baseDir -Filter "*.html" -Recurse | Where-Object {
    $_.FullName -notmatch "\\.git|scratch|tests|index-backup|seo-audit-report\.html"
}
$bareDomainMatches = 0
foreach ($f in $htmlFiles) {
    $txt = [System.IO.File]::ReadAllText($f.FullName)
    if ($txt -match 'https://shader7\.com(?![a-zA-Z0-9])') {
        $bareDomainMatches++
        Write-Host "    Found bare domain in: $($f.Name)" -ForegroundColor Yellow
    }
}
Assert-Condition ($bareDomainMatches -eq 0) "All active HTML files use https://www.shader7.com ($bareDomainMatches found)"

# 4. Check millingcalculation metadata
$millingPath = Join-Path $baseDir "cnc-machinist\millingcalculation\index.html"
$millingText = [System.IO.File]::ReadAllText($millingPath)
Assert-Condition ($millingText.Contains('name="description"')) "millingcalculation has meta description"
Assert-Condition ($millingText.Contains('rel="canonical" href="https://www.shader7.com/cnc-machinist/millingcalculation/"')) "millingcalculation has canonical tag"

# 5. Check Triangle H1
$trianglePath = Join-Path $baseDir "cnc-machinist\Triangle\index.html"
$triangleText = [System.IO.File]::ReadAllText($trianglePath)
$h1Count = ([regex]::Matches($triangleText, '<h1[\s>]')).Count
Assert-Condition ($h1Count -eq 1) "Triangle page has exactly 1 H1 tag (found $h1Count)"

# 6. Check MediaFire nofollow
$passportPath = Join-Path $baseDir "photopassportsizepro\index.html"
$passportText = [System.IO.File]::ReadAllText($passportPath)
Assert-Condition ($passportText -match 'mediafire\.com.*rel="nofollow noopener noreferrer"') "MediaFire APK link carries rel=nofollow"

# 7. Check homepage tool banner alt text
$indexPath = Join-Path $baseDir "index.html"
$indexText = [System.IO.File]::ReadAllText($indexPath)
$emptyAltCount = ([regex]::Matches($indexText, 'class="tool-card-banner"><img alt=""')).Count
Assert-Condition ($emptyAltCount -eq 0) "Homepage tool banner images have non-empty alt text"

# 8. Check ad script deferring
$adMatches = 0
$unDeferredAdMatches = 0
foreach ($f in $htmlFiles) {
    $txt = [System.IO.File]::ReadAllText($f.FullName)
    if ($txt.Contains("249911a0bb6cd7ff11a49086b8f131e7.js")) {
        $adMatches++
        if ($txt -match '<script src="https://emotionallytonightintelligent\.com/24/99/11/249911a0bb6cd7ff11a49086b8f131e7\.js">') {
            $unDeferredAdMatches++
        }
    }
}
Assert-Condition ($adMatches -gt 0 -and $unDeferredAdMatches -eq 0) "All ad scripts carry defer attribute ($adMatches verified)"

Write-Host ""
if ($failures -eq 0) {
    Write-Host "ALL SEO VERIFICATIONS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failures VERIFICATION CHECKS FAILED!" -ForegroundColor Red
    exit 1
}
