$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')
& pnpm --dir $repoRoot exec sdkwork-app dev --runtime-target server --deployment-profile standalone @args
exit $LASTEXITCODE
