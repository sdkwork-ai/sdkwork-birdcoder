# Package Rename Script for SDKWork Birdcoder
# This script renames PC-specific packages from sdkwork-birdcoder-* to sdkwork-birdcoder-pc-*

$ErrorActionPreference = "Stop"

$packagesDir = "E:\sdkwork-space\sdkwork-birdcoder\packages"

# PC-specific packages to rename
$pcPackages = @(
    "sdkwork-birdcoder-web",
    "sdkwork-birdcoder-desktop",
    "sdkwork-birdcoder-code",
    "sdkwork-birdcoder-studio",
    "sdkwork-birdcoder-chat",
    "sdkwork-birdcoder-chat-claude",
    "sdkwork-birdcoder-chat-codex",
    "sdkwork-birdcoder-chat-gemini",
    "sdkwork-birdcoder-chat-opencode",
    "sdkwork-birdcoder-codeengine",
    "sdkwork-birdcoder-host-core",
    "sdkwork-birdcoder-host-studio",
    "sdkwork-birdcoder-shell-runtime",
    "sdkwork-birdcoder-infrastructure-runtime",
    "sdkwork-birdcoder-multiwindow",
    "sdkwork-birdcoder-server",
    "sdkwork-birdcoder-ui",
    "sdkwork-birdcoder-ui-shell",
    "sdkwork-birdcoder-workbench-state",
    "sdkwork-birdcoder-workbench-storage",
    "sdkwork-birdcoder-git"
)

Write-Host "Starting package rename process..."

foreach ($pkg in $pcPackages) {
    $oldDir = Join-Path $packagesDir $pkg
    $newDir = Join-Path $packagesDir ($pkg -replace "sdkwork-birdcoder-", "sdkwork-birdcoder-pc-")
    
    if (Test-Path $oldDir) {
        Write-Host "Renaming directory: $pkg -> $($pkg -replace 'sdkwork-birdcoder-', 'sdkwork-birdcoder-pc-')"
        Rename-Item -Path $oldDir -NewName ($pkg -replace "sdkwork-birdcoder-", "sdkwork-birdcoder-pc-")
        
        # Update package.json name field
        $packageJsonPath = Join-Path $newDir "package.json"
        if (Test-Path $packageJsonPath) {
            $content = Get-Content $packageJsonPath -Raw
            $oldName = "@sdkwork/$($pkg -replace 'sdkwork-birdcoder-', 'birdcoder-')"
            $newName = "@sdkwork/$($pkg -replace 'sdkwork-birdcoder-', 'birdcoder-pc-')"
            $content = $content -replace [regex]::Escape($oldName), $newName
            Set-Content -Path $packageJsonPath -Value $content
            Write-Host "  Updated package.json: $oldName -> $newName"
        }
    } else {
        Write-Host "Directory not found: $pkg" -ForegroundColor Yellow
    }
}

Write-Host "Package rename completed." -ForegroundColor Green
