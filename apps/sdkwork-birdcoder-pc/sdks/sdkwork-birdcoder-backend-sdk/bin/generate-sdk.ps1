param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$scriptPath = Join-Path $repoRoot 'scripts\generate-birdcoder-sdkgen-family.mjs'
$arguments = @($scriptPath, '--surface', 'backend')
if ($DryRun) {
  $arguments += '--dry-run'
}

# sdkgen via @sdkwork/sdk-generator, sdkwork-v3:
# node scripts/generate-birdcoder-sdkgen-family.mjs --surface backend --standard-profile sdkwork-v3
& node @arguments
exit $LASTEXITCODE
