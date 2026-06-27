#!/usr/bin/env pwsh
# Scaffold all sdkwork-specs-compliant Rust crates under crates/

$ErrorActionPreference = "Stop"

$rootDir = "E:\sdkwork-space\sdkwork-birdcoder\crates"

# Route crates
$routeCrates = @(
    "sdkwork-routes-system-app-api",
    "sdkwork-routes-runtime-app-api",
    "sdkwork-routes-intelligence-app-api",
    "sdkwork-routes-platform-app-api",
    "sdkwork-routes-content-app-api",
    "sdkwork-routes-ecosystem-app-api",
    "sdkwork-routes-commerce-app-api",
    "sdkwork-routes-iam-backend-api",
    "sdkwork-routes-platform-backend-api"
)

# Service crates
$serviceCrates = @(
    "sdkwork-intelligence-coding-sessions-service",
    "sdkwork-runtime-engine-catalog-service",
    "sdkwork-runtime-native-sessions-service",
    "sdkwork-platform-workspace-service",
    "sdkwork-platform-project-service",
    "sdkwork-platform-deployment-service",
    "sdkwork-ecosystem-skill-packages-service",
    "sdkwork-ecosystem-app-templates-service",
    "sdkwork-content-document-service",
    "sdkwork-commerce-membership-service",
    "sdkwork-system-descriptor-service"
)

# Repository crates
$repoCrates = @(
    "sdkwork-intelligence-coding-sessions-repository-sqlite",
    "sdkwork-platform-workspace-repository-sqlite",
    "sdkwork-ecosystem-skill-packages-repository-sqlite",
    "sdkwork-runtime-model-config-repository-sqlite",
    "sdkwork-commerce-membership-repository-sqlite"
)

# Host/server crates
$hostCrates = @(
    "sdkwork-birdcoder-standalone-gateway",
    "sdkwork-birdcoder-service-host",
    "sdkwork-birdcoder-tauri-host"
)

# Shared crates
$sharedCrates = @(
    "sdkwork-birdcoder-errors"
)

# Relocated crates (just dirs for now, content comes later)
$relocatedCrates = @(
    "sdkwork-birdcoder-codeengine",
    "sdkwork-birdcoder-git"
)

$allCrates = $routeCrates + $serviceCrates + $repoCrates + $hostCrates + $sharedCrates + $relocatedCrates

foreach ($crate in $allCrates) {
    $crateDir = Join-Path $rootDir $crate
    $srcDir = Join-Path $crateDir "src"
    
    if (-not (Test-Path $srcDir)) {
        New-Item -ItemType Directory -Path $srcDir -Force | Out-Null
    }
    
    # Create lib.rs if it doesn't exist
    $libRs = Join-Path $srcDir "lib.rs"
    if (-not (Test-Path $libRs)) {
        Set-Content -Path $libRs -Value "// $crate`n"
    }
    
    # Create Cargo.toml if it doesn't exist
    $cargoToml = Join-Path $crateDir "Cargo.toml"
    if (-not (Test-Path $cargoToml)) {
        $libName = $crate -replace '-', '_'
        $tomlContent = @"
[package]
name = "$crate"
version.workspace = true
edition.workspace = true
license.workspace = true
authors.workspace = true

[dependencies]
"@
        Set-Content -Path $cargoToml -Value $tomlContent
    }
    
    Write-Host "Created: $crate"
}

# Create main.rs for api-server
$mainRs = Join-Path $rootDir "sdkwork-birdcoder-standalone-gateway\src\main.rs"
if (-not (Test-Path $mainRs)) {
    Set-Content -Path $mainRs -Value "fn main() {`n    println!(`"sdkwork-birdcoder-standalone-gateway`");`n}`n"
}

Write-Host "`nTotal crates scaffolded: $($allCrates.Count)"
