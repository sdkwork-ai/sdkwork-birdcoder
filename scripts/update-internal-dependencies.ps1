# Update Internal Dependencies Script
# This script updates all internal dependency references to use new PC package names

$ErrorActionPreference = "Stop"

$packagesDir = "E:\sdkwork-space\sdkwork-birdcoder\packages"

# Get all package.json files
$packageFiles = Get-ChildItem -Path $packagesDir -Recurse -Filter "package.json"

foreach ($file in $packageFiles) {
    $content = Get-Content $file.FullName -Raw
    $updated = $false
    
    # Update PC package references
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
    
    foreach ($pkg in $pcPackages) {
        $oldName = "@sdkwork/$pkg"
        $newName = "@sdkwork/$($pkg -replace 'birdcoder-', 'birdcoder-pc-')"
        
        if ($content -match [regex]::Escape($oldName)) {
            $content = $content -replace [regex]::Escape($oldName), $newName
            $updated = $true
            Write-Host "Updated $($file.FullName): $oldName -> $newName"
        }
    }
    
    if ($updated) {
        Set-Content -Path $file.FullName -Value $content
    }
}

Write-Host "Internal dependency update completed." -ForegroundColor Green
