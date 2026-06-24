$ErrorActionPreference = 'Stop'
$appRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $appRoot
node ../../../scripts/run-birdcoder-server-command.mjs dev --iam-mode server-private @args
