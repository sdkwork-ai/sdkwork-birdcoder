$ErrorActionPreference = 'Stop'
$appRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $appRoot
node ../../../scripts/run-birdcoder-desktop-command.mjs dev:desktop --iam-mode server-private @args
