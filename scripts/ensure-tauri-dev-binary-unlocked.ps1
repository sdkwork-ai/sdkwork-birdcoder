param(
  [string]$SrcTauriDir = 'src-tauri',
  [string]$BinaryName = 'sdkwork-birdcoder-desktop'
)

$ErrorActionPreference = 'Stop'

$script:WindowsTauriDevSessionMarkers = @(
  'run-tauri-cli.mjs',
  'tauri.js'
)

function Resolve-TauriDevBinaryPath {
  param(
    [string]$ResolvedSrcTauriDir,
    [string]$ResolvedBinaryName
  )

  $binaryFileName = if ($env:OS -eq 'Windows_NT') {
    "$ResolvedBinaryName.exe"
  } else {
    $ResolvedBinaryName
  }

  return [System.IO.Path]::GetFullPath((Join-Path $ResolvedSrcTauriDir (Join-Path 'target\debug' $binaryFileName)))
}

function Get-DedupedProcesses {
  param(
    [object[]]$Processes
  )

  $seen = @{}
  $deduped = New-Object System.Collections.Generic.List[object]

  foreach ($processInfo in @($Processes)) {
    if ($null -eq $processInfo) {
      continue
    }

    $processId = [int]$processInfo.Id
    if ($processId -le 0 -or $seen.ContainsKey($processId)) {
      continue
    }

    $seen[$processId] = $true
    $deduped.Add($processInfo)
  }

  return [object[]]$deduped.ToArray()
}

function Get-ExactPathProcesses {
  param(
    [string]$ExecutablePath
  )

  $processName = [System.IO.Path]::GetFileNameWithoutExtension($ExecutablePath)

  return @(Get-Process -Name $processName -ErrorAction SilentlyContinue | Where-Object {
      $_.Path -and
      ([System.IO.Path]::GetFullPath($_.Path) -ieq $ExecutablePath)
    } | Select-Object @{
      Name = 'Id'
      Expression = { $_.Id }
    }, @{
      Name = 'ProcessName'
      Expression = { $_.ProcessName }
    }, @{
      Name = 'Path'
      Expression = { $_.Path }
    })
}

function Get-NamedProcesses {
  param(
    [string]$ResolvedBinaryName
  )

  $binaryFileName = if ($ResolvedBinaryName.EndsWith('.exe', [System.StringComparison]::OrdinalIgnoreCase)) {
    $ResolvedBinaryName
  } else {
    "$ResolvedBinaryName.exe"
  }

  $processName = [System.IO.Path]::GetFileNameWithoutExtension($binaryFileName)

  return @(Get-Process -Name $processName -ErrorAction SilentlyContinue | Select-Object @{
      Name = 'Id'
      Expression = { $_.Id }
    }, @{
      Name = 'ProcessName'
      Expression = { $_.ProcessName }
    }, @{
      Name = 'Path'
      Expression = { $_.Path }
    })
}

function Get-TauriDevSessionProcesses {
  param(
    [string]$PackageDir
  )

  return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      if (-not $_.CommandLine) {
        return $false
      }

      if ($_.CommandLine.IndexOf($PackageDir, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
        return $false
      }

      foreach ($marker in $script:WindowsTauriDevSessionMarkers) {
        if ($_.CommandLine.IndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
          return $true
        }
      }

      return $false
    } | Select-Object @{
      Name = 'Id'
      Expression = { $_.ProcessId }
    }, @{
      Name = 'ProcessName'
      Expression = { $_.Name }
    }, @{
      Name = 'Path'
      Expression = { $_.ExecutablePath }
    }, ParentProcessId, CommandLine)
}

function Wait-ExecutableUnlock {
  param(
    [string]$ExecutablePath,
    [int]$RetryCount = 40,
    [int]$RetryDelayMs = 100
  )

  for ($attempt = 1; $attempt -le $RetryCount; $attempt += 1) {
    if (-not (Test-Path -LiteralPath $ExecutablePath)) {
      return
    }

    $stream = $null

    try {
      $stream = [System.IO.File]::Open(
        $ExecutablePath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
      )
      return
    } catch [System.UnauthorizedAccessException] {
    } catch [System.IO.IOException] {
    } finally {
      if ($null -ne $stream) {
        $stream.Dispose()
      }
    }

    if ($attempt -lt $RetryCount) {
      Start-Sleep -Milliseconds ($RetryDelayMs * $attempt)
    }
  }

  throw "Timed out waiting for Tauri dev binary to unlock: $ExecutablePath"
}

function Wait-ForProcessExit {
  param(
    [int]$ProcessId,
    [int]$TimeoutMs = 15000
  )

  $deadline = (Get-Date).AddMilliseconds($TimeoutMs)

  while ((Get-Date) -lt $deadline) {
    if ($null -eq (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
      return $true
    }

    Start-Sleep -Milliseconds 100
  }

  return $null -eq (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Stop-MatchedProcesses {
  param(
    [object[]]$ProcessesToStop
  )

  $terminated = New-Object System.Collections.Generic.List[object]

  foreach ($processInfo in @(Get-DedupedProcesses $ProcessesToStop)) {
    try {
      Stop-Process -Id ([int]$processInfo.Id) -Force -ErrorAction Stop
    } catch {
      $runningProcess = Get-Process -Id ([int]$processInfo.Id) -ErrorAction SilentlyContinue
      if ($null -eq $runningProcess) {
        $terminated.Add($processInfo)
        continue
      }

      if ($runningProcess.MainWindowHandle -ne 0) {
        $closeRequested = $runningProcess.CloseMainWindow()
        if ($closeRequested -and (Wait-ForProcessExit -ProcessId ([int]$processInfo.Id))) {
          $terminated.Add($processInfo)
          continue
        }
      }

      throw
    }

    $terminated.Add($processInfo)
  }

  return [object[]]$terminated.ToArray()
}

if ($env:OS -ne 'Windows_NT') {
  Write-Output "Skipping Tauri dev binary unlock on unsupported platform $($PSVersionTable.Platform)."
  exit 0
}

$executablePath = Resolve-TauriDevBinaryPath -ResolvedSrcTauriDir $SrcTauriDir -ResolvedBinaryName $BinaryName
$packageDir = [System.IO.Path]::GetFullPath((Join-Path $SrcTauriDir '..'))

if (-not (Test-Path -LiteralPath $executablePath)) {
  Write-Output "No built Tauri dev binary found at $executablePath; continuing."
  exit 0
}

$inspectionMode = 'exact-path'
$exactPathInspectionError = $null
$runningProcesses = @()

try {
  $runningProcesses = Get-ExactPathProcesses -ExecutablePath $executablePath
} catch {
  $exactPathInspectionError = $_.Exception.Message
}

if (@($runningProcesses).Count -eq 0) {
  $runningProcesses = Get-NamedProcesses -ResolvedBinaryName $BinaryName
  $inspectionMode = 'image-name'
}

$devSessionProcesses = Get-TauriDevSessionProcesses -PackageDir $packageDir
$terminatedProcesses = Stop-MatchedProcesses -ProcessesToStop (@($runningProcesses) + @($devSessionProcesses))

if (@($terminatedProcesses).Count -gt 0) {
  Wait-ExecutableUnlock -ExecutablePath $executablePath

  if ($exactPathInspectionError) {
    Write-Warning "Exact-path Tauri dev binary inspection failed; fell back to image-name matching: $exactPathInspectionError"
  }

  Write-Output "Stopped $(@($terminatedProcesses).Count) locked Tauri dev process(es) for $executablePath."
  exit 0
}

if ($exactPathInspectionError) {
  Write-Warning "Exact-path Tauri dev binary inspection failed; image-name fallback found no remaining process: $exactPathInspectionError"
}

Write-Output "No running Tauri dev binary lock detected for $executablePath."
