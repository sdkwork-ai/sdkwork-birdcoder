# Fix Relative Path References Script
# This script fixes relative path references that point to renamed directories

$ErrorActionPreference = "Stop"

$rootDir = "E:\sdkwork-space\sdkwork-birdcoder"

# Mapping of old directory names to new directory names
$directoryMapping = @{
    "sdkwork-birdcoder-web" = "sdkwork-birdcoder-pc-web"
    "sdkwork-birdcoder-desktop" = "sdkwork-birdcoder-pc-desktop"
    "sdkwork-birdcoder-code" = "sdkwork-birdcoder-pc-code"
    "sdkwork-birdcoder-studio" = "sdkwork-birdcoder-pc-studio"
    "sdkwork-birdcoder-chat" = "sdkwork-birdcoder-pc-chat"
    "sdkwork-birdcoder-chat-claude" = "sdkwork-birdcoder-pc-chat-claude"
    "sdkwork-birdcoder-chat-codex" = "sdkwork-birdcoder-pc-chat-codex"
    "sdkwork-birdcoder-chat-gemini" = "sdkwork-birdcoder-pc-chat-gemini"
    "sdkwork-birdcoder-chat-opencode" = "sdkwork-birdcoder-pc-chat-opencode"
    "sdkwork-birdcoder-codeengine" = "sdkwork-birdcoder-pc-codeengine"
    "sdkwork-birdcoder-host-core" = "sdkwork-birdcoder-pc-host-core"
    "sdkwork-birdcoder-host-studio" = "sdkwork-birdcoder-pc-host-studio"
    "sdkwork-birdcoder-shell-runtime" = "sdkwork-birdcoder-pc-shell-runtime"
    "sdkwork-birdcoder-infrastructure-runtime" = "sdkwork-birdcoder-pc-infrastructure-runtime"
    "sdkwork-birdcoder-multiwindow" = "sdkwork-birdcoder-pc-multiwindow"
    "sdkwork-birdcoder-server" = "sdkwork-birdcoder-pc-server"
    "sdkwork-birdcoder-ui" = "sdkwork-birdcoder-pc-ui"
    "sdkwork-birdcoder-ui-shell" = "sdkwork-birdcoder-pc-ui-shell"
    "sdkwork-birdcoder-workbench-state" = "sdkwork-birdcoder-pc-workbench-state"
    "sdkwork-birdcoder-workbench-storage" = "sdkwork-birdcoder-pc-workbench-storage"
    "sdkwork-birdcoder-git" = "sdkwork-birdcoder-pc-git"
}

# Get all TypeScript and JavaScript files
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
    
    foreach ($oldDir in $directoryMapping.Keys) {
        $newDir = $directoryMapping[$oldDir]
        
        # Fix relative path references
        $oldPath = "../../../$oldDir/"
        $newPath = "../../../$newDir/"
        
        if ($content -match [regex]::Escape($oldPath)) {
            $content = $content -replace [regex]::Escape($oldPath), $newPath
            $updated = $true
            $totalUpdates++
        }
        
        # Also fix two-level up references
        $oldPath2 = "../../$oldDir/"
        $newPath2 = "../../$newDir/"
        
        if ($content -match [regex]::Escape($oldPath2)) {
            $content = $content -replace [regex]::Escape($oldPath2), $newPath2
            $updated = $true
            $totalUpdates++
        }
    }
    
    if ($updated) {
        [System.IO.File]::WriteAllText($file.FullName, $content)
        Write-Host "Updated: $($file.FullName)"
    }
}

Write-Host "Relative path fix completed. Total updates: $totalUpdates" -ForegroundColor Green
