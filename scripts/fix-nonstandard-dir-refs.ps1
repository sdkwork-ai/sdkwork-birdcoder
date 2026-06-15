# Fix Non-Standard Directory References Script
# Updates all script references from config/, deploy/, server/ to standard locations

$ErrorActionPreference = "Stop"
$rootDir = "E:\sdkwork-space\sdkwork-birdcoder"

# Get all .mjs, .ts, .tsx files in scripts/
$files = Get-ChildItem -Path "$rootDir\scripts" -Recurse -Include "*.mjs","*.ts","*.tsx" -ErrorAction SilentlyContinue
$totalUpdates = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $originalContent = $content
    
    # Fix config/ -> configs/
    $content = $content -replace "'config/shared-sdk-release-sources\.json'", "'configs/shared-sdk-release-sources.json'"
    $content = $content -replace '"config/shared-sdk-release-sources\.json"', '"configs/shared-sdk-release-sources.json"'
    
    # Fix deploy/ -> deployments/
    $content = $content -replace "'deploy/docker/", "'deployments/docker/"
    $content = $content -replace '"deploy/docker/', '"deployments/docker/'
    $content = $content -replace "'deploy/kubernetes/", "'deployments/kubernetes/"
    $content = $content -replace '"deploy/kubernetes/', '"deployments/kubernetes/'
    
    if ($content -ne $originalContent) {
        [System.IO.File]::WriteAllText($file.FullName, $content)
        $totalUpdates++
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "Non-standard directory reference fix completed. Total files updated: $totalUpdates" -ForegroundColor Green
