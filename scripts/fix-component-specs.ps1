# Fix All Component Specs Script
# Updates package names, root paths, and adds missing required fields per COMPONENT_SPEC.md

$ErrorActionPreference = "Stop"
$rootDir = "E:\sdkwork-space\sdkwork-birdcoder"
$packagesDir = Join-Path $rootDir "packages"

# PC packages mapping: old dir name segment -> new dir name segment
$pcPackageMap = @{
    "birdcoder-web" = "birdcoder-pc-web"
    "birdcoder-desktop" = "birdcoder-pc-desktop"
    "birdcoder-code" = "birdcoder-pc-code"
    "birdcoder-studio" = "birdcoder-pc-studio"
    "birdcoder-chat" = "birdcoder-pc-chat"
    "birdcoder-chat-claude" = "birdcoder-pc-chat-claude"
    "birdcoder-chat-codex" = "birdcoder-pc-chat-codex"
    "birdcoder-chat-gemini" = "birdcoder-pc-chat-gemini"
    "birdcoder-chat-opencode" = "birdcoder-pc-chat-opencode"
    "birdcoder-codeengine" = "birdcoder-pc-codeengine"
    "birdcoder-host-core" = "birdcoder-pc-host-core"
    "birdcoder-host-studio" = "birdcoder-pc-host-studio"
    "birdcoder-shell-runtime" = "birdcoder-pc-shell-runtime"
    "birdcoder-infrastructure-runtime" = "birdcoder-pc-infrastructure-runtime"
    "birdcoder-multiwindow" = "birdcoder-pc-multiwindow"
    "birdcoder-server" = "birdcoder-pc-server"
    "birdcoder-ui" = "birdcoder-pc-ui"
    "birdcoder-ui-shell" = "birdcoder-pc-ui-shell"
    "birdcoder-workbench-state" = "birdcoder-pc-workbench-state"
    "birdcoder-workbench-storage" = "birdcoder-pc-workbench-storage"
    "birdcoder-git" = "birdcoder-pc-git"
}

$specFiles = Get-ChildItem -Path $packagesDir -Recurse -Filter "component.spec.json" -Depth 2
$totalUpdates = 0

foreach ($specFile in $specFiles) {
    $content = [System.IO.File]::ReadAllText($specFile.FullName)
    $json = $content | ConvertFrom-Json
    $updated = $false

    $dirName = $specFile.Directory.Parent.Name
    $isPcPackage = $dirName.StartsWith("sdkwork-birdcoder-pc-")

    # Fix component.name
    $oldName = $json.component.name
    if ($isPcPackage) {
        $expectedName = "@sdkwork/$dirName"
    } else {
        $expectedName = "@sdkwork/$dirName"
    }
    if ($oldName -ne $expectedName) {
        $json.component.name = $expectedName
        $updated = $true
    }

    # Fix component.root
    $oldRoot = $json.component.root
    $expectedRoot = "sdkwork-birdcoder/packages/$dirName"
    if ($oldRoot -ne $expectedRoot) {
        $json.component.root = $expectedRoot
        $updated = $true
    }

    # Add surface field for PC packages
    if ($isPcPackage -and -not $json.component.surface) {
        $json.component | Add-Member -NotePropertyName "surface" -NotePropertyValue "app" -Force
        $updated = $true
    }

    # Add sdkDependencies if missing
    if (-not $json.contracts.sdkDependencies) {
        $json.contracts | Add-Member -NotePropertyName "sdkDependencies" -NotePropertyValue @() -Force
        $updated = $true
    }

    # Add dependencyApiExports if missing
    if (-not $json.contracts.dependencyApiExports) {
        $json.contracts | Add-Member -NotePropertyName "dependencyApiExports" -NotePropertyValue @() -Force
        $updated = $true
    }

    # Add dependencyApiSurfaces if missing
    if (-not $json.contracts.dependencyApiSurfaces) {
        $json.contracts | Add-Member -NotePropertyName "dependencyApiSurfaces" -NotePropertyValue @() -Force
        $updated = $true
    }

    # Fix verification commands
    $expectedFilter = $expectedName
    if ($json.verification.commands.Count -gt 0) {
        $oldCmd = $json.verification.commands[0]
        if ($oldCmd -match "@sdkwork/birdcoder-" -and -not $oldCmd.Contains($expectedName)) {
            $json.verification.commands = @("pnpm --filter $expectedFilter typecheck")
            $updated = $true
        }
    }

    if ($updated) {
        $newContent = $json | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($specFile.FullName, $newContent)
        $totalUpdates++
        Write-Host "Updated: $($specFile.FullName)"
    }
}

Write-Host "Component spec fix completed. Total updates: $totalUpdates" -ForegroundColor Green
