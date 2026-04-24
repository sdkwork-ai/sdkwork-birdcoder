param()

$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
  Write-Output 'ok - tauri dev binary unlock guard is only required on Windows.'
  exit 0
}

$rootDir = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $PSScriptRoot 'ensure-tauri-dev-binary-unlocked.ps1'
$powerShellExecutable = Join-Path $PSHOME 'powershell.exe'
$desktopPackageJsonPath = Join-Path $rootDir 'packages\sdkwork-birdcoder-desktop\package.json'
$desktopPackageJson = Get-Content -LiteralPath $desktopPackageJsonPath -Raw | ConvertFrom-Json
$scriptSource = Get-Content -LiteralPath $scriptPath -Raw

if ($scriptSource -notmatch 'run-tauri-cli\.mjs' -or $scriptSource -notmatch 'tauri\.js') {
  throw 'unlock guard markers must include run-tauri-cli.mjs and tauri.js.'
}

if ($scriptSource -notmatch 'CloseMainWindow') {
  throw 'unlock guard must fall back to CloseMainWindow() when force-stopping a stale desktop process is denied.'
}

if ($scriptSource -match 'run-desktop-vite-host\.mjs') {
  throw 'unlock guard must not target the reusable desktop Vite host process.'
}

if ($desktopPackageJson.scripts.'tauri:dev:base' -notmatch 'run-tauri-dev-binary-unlock\.mjs') {
  throw 'desktop tauri:dev:base script must invoke the tauri dev binary unlock runner.'
}

function Test-ProcessExists {
  param(
    [int]$ProcessId
  )

  return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Wait-ForCondition {
  param(
    [scriptblock]$Condition,
    [int]$TimeoutMs = 5000
  )

  $deadline = (Get-Date).AddMilliseconds($TimeoutMs)

  while ((Get-Date) -lt $deadline) {
    if (& $Condition) {
      return
    }

    Start-Sleep -Milliseconds 50
  }

  throw "Timed out after ${TimeoutMs}ms waiting for condition."
}

function Remove-DirectoryWithRetries {
  param(
    [string]$TargetDirectory,
    [int]$RetryCount = 5,
    [int]$RetryDelayMs = 100
  )

  for ($attempt = 1; $attempt -le $RetryCount; $attempt += 1) {
    try {
      Remove-Item -LiteralPath $TargetDirectory -Recurse -Force -ErrorAction Stop
      return
    } catch {
      if ($attempt -ge $RetryCount) {
        throw
      }

      Start-Sleep -Milliseconds ($RetryDelayMs * $attempt)
    }
  }
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
  $srcTauriDir = Join-Path $tempDir 'src-tauri'
  $debugDir = Join-Path $srcTauriDir 'target\debug'
  $binaryName = 'birdcoder-tauri-lock-test'
  $binaryPath = Join-Path $debugDir "${binaryName}.exe"

  New-Item -ItemType Directory -Path $debugDir -Force | Out-Null
  Copy-Item -LiteralPath $PSHOME\powershell.exe -Destination $binaryPath -Force

  & $powerShellExecutable -NoProfile -ExecutionPolicy Bypass -File $scriptPath -SrcTauriDir $srcTauriDir -BinaryName $binaryName | Out-Null

  $child = Start-Process -FilePath $binaryPath -ArgumentList '-NoProfile', '-NonInteractive', '-Command', 'Start-Sleep -Seconds 300' -PassThru -WindowStyle Hidden

  try {
    Wait-ForCondition -Condition { Test-ProcessExists -ProcessId $child.Id }

    & $powerShellExecutable -NoProfile -ExecutionPolicy Bypass -File $scriptPath -SrcTauriDir $srcTauriDir -BinaryName $binaryName | Out-Null

    Wait-ForCondition -Condition { -not (Test-ProcessExists -ProcessId $child.Id) }

    $lockProbe = $null

    try {
      $lockProbe = [System.IO.File]::Open(
        $binaryPath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
      )
    } finally {
      if ($null -ne $lockProbe) {
        $lockProbe.Dispose()
      }
    }
  } finally {
    if (Test-ProcessExists -ProcessId $child.Id) {
      Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
    }
  }
} finally {
  if (Test-Path -LiteralPath $tempDir) {
    Remove-DirectoryWithRetries -TargetDirectory $tempDir
  }
}

Write-Output 'ok - tauri dev binary unlock guard clears locked BirdCoder desktop executables.'
