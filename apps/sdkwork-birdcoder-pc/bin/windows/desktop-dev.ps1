$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')
& pnpm --dir $repoRoot exec sdkwork-app dev --runtime-target desktop --deployment-profile standalone @args
exit $LASTEXITCODE
