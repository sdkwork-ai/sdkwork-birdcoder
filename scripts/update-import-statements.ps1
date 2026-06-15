# Update Import Statements Script
# This script updates all TypeScript/JavaScript import statements to use new PC package names

$ErrorActionPreference = "Stop"

$rootDir = "E:\sdkwork-space\sdkwork-birdcoder"

# PC packages to update in imports
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

# Get all TypeScript and JavaScript files, excluding node_modules and .git
$files = @()
$directories = Get-ChildItem -Path $rootDir -Directory | 
    Where-Object { $_.Name -ne "node_modules" -and $_.Name -ne ".git" -and $_.Name -ne "target" }

foreach ($dir in $directories) {
    $files += Get-ChildItem -Path $dir.FullName -Recurse -Include "*.ts", "*.tsx", "*.js", "*.jsx" -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notmatch "node_modules" -and $_.FullName -notmatch "\.git" -and $_.FullName -notmatch "target" }
}

$totalUpdates = 0

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $updated = $false
    
    foreach ($pkg in $pcPackages) {
        $oldImport = "@sdkwork/$pkg"
        $newImport = "@sdkwork/$($pkg -replace 'birdcoder-', 'birdcoder-pc-')"
        
        if ($content -match [regex]::Escape($oldImport)) {
            $content = $content -replace [regex]::Escape($oldImport), $newImport
            $updated = $true
            $totalUpdates++
        }
    }
    
    if ($updated) {
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "Import statement update completed. Total updates: $totalUpdates" -ForegroundColor Green
