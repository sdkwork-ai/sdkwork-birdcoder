# Fix Script References Script
# This script updates all script references to use new PC package names

$ErrorActionPreference = "Stop"

$rootDir = "E:\sdkwork-space\sdkwork-birdcoder"

# PC packages to update in scripts
$pcPackages = @(
    "birdcoder-web",
    "birdcoder-desktop",
    "birdcoder-code",
    "birdcoder-studio",
    "birdcoder-chat",
    "birdcoder-chat-claude",
    "birdcoder-chat-codex",
    "birdcoder-chat-gemini",
    "birdcoder-chat-opencode",
    "birdcoder-codeengine",
    "birdcoder-host-core",
    "birdcoder-host-studio",
    "birdcoder-shell-runtime",
    "birdcoder-infrastructure-runtime",
    "birdcoder-multiwindow",
    "birdcoder-server",
    "birdcoder-ui",
    "birdcoder-ui-shell",
    "birdcoder-workbench-state",
    "birdcoder-workbench-storage",
    "birdcoder-git"
)

# Get all script files
$scriptFiles = Get-ChildItem -Path "$rootDir\scripts" -Filter "*.mjs" -ErrorAction SilentlyContinue

$totalUpdates = 0

foreach ($file in $scriptFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $updated = $false
    
    foreach ($pkg in $pcPackages) {
        $oldName = "sdkwork-birdcoder-$($pkg -replace 'birdcoder-', '')"
        $newName = "sdkwork-birdcoder-pc-$($pkg -replace 'birdcoder-', '')"
        
        if ($content -match [regex]::Escape($oldName)) {
            $content = $content -replace [regex]::Escape($oldName), $newName
            $updated = $true
            $totalUpdates++
        }
    }
    
    if ($updated) {
        [System.IO.File]::WriteAllText($file.FullName, $content)
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "Script reference fix completed. Total updates: $totalUpdates" -ForegroundColor Green
