param([switch]$FailAfterInstall)

$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$brand = Get-Content -LiteralPath (Join-Path $workspace "src\brand-config.json") -Raw | ConvertFrom-Json
$packageJson = Get-Content -LiteralPath (Join-Path $workspace "package.json") -Raw | ConvertFrom-Json
$version = $packageJson.version
$target = [IO.Path]::GetFullPath((Join-Path $workspace ".tmp\installer-certification"))
$installer = Join-Path (Join-Path $workspace "release") "$($brand.slug)-Setup-$version-x64.exe"
$isolatedRoot = [IO.Path]::GetFullPath((Join-Path $env:TEMP ("$($brand.slug)-installer-test-" + [Guid]::NewGuid())))
$isolatedUserData = Join-Path $isolatedRoot "userData"
$isolatedSessionData = Join-Path $isolatedRoot "sessionData"
$marker = Join-Path $isolatedUserData "process-lifecycle.marker"
$uninstaller = Join-Path $target "Uninstall $($brand.displayName).exe"
$appProcess = $null
$installOccurred = $false
$primaryFailure = $null
$cleanupFailures = [Collections.Generic.List[string]]::new()

$workspaceWithSeparator = $workspace.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$tempRootWithSeparator = [IO.Path]::GetFullPath($env:TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

function Stop-TestProcessTree($process) {
  if (-not $process) { return }
  $process.Refresh()
  if (-not $process.HasExited) {
    & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null
    Wait-Process -Id $process.Id -Timeout 10 -ErrorAction SilentlyContinue
    $process.Refresh()
    if (-not $process.HasExited) { throw "Application process tree did not exit for PID $($process.Id)." }
  }
}

function Remove-TestPath($testPath) {
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    if (-not (Test-Path -LiteralPath $testPath)) { return }
    try {
      Remove-Item -LiteralPath $testPath -Recurse -Force -ErrorAction Stop
    }
    catch {
      if ($attempt -eq 5) { throw "Failed to clean disposable path: $testPath. $($_.Exception.Message)" }
      Start-Sleep -Milliseconds 500
    }
  }
}

try {
  if (-not $target.StartsWith($workspaceWithSeparator, [StringComparison]::OrdinalIgnoreCase)) { throw "Installer test target is outside the workspace." }
  if (-not $isolatedRoot.StartsWith($tempRootWithSeparator, [StringComparison]::OrdinalIgnoreCase)) { throw "Installer test data root is outside TEMP." }
  if ($packageJson.build.nsis.deleteAppDataOnUninstall -ne $false) {
    throw "NSIS deleteAppDataOnUninstall must remain false."
  }
  Remove-TestPath $target
  New-Item -ItemType Directory -Path $isolatedUserData -Force | Out-Null
  '{"autoStartEnabled":false,"closeBehavior":"exit"}' | Set-Content -LiteralPath (Join-Path $isolatedUserData "app-preferences.json") -Encoding utf8
  Set-Content -LiteralPath $marker -Value "preserve-across-process-lifecycle"

  # NSIS requires /D=<path> to be the final argument and consumes the remainder, including spaces.
  $install = Start-Process -FilePath $installer -ArgumentList @("/S", ("/D=" + $target)) -Wait -PassThru
  $installOccurred = Test-Path -LiteralPath $uninstaller -PathType Leaf
  if ($install.ExitCode -ne 0) { throw "Installer failed with exit code $($install.ExitCode)." }
  if ($FailAfterInstall) { throw "Injected failure after install." }

  $executable = Join-Path $target "$($brand.displayName).exe"
  if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { throw "Installed executable is missing." }

  $appProcess = Start-Process -FilePath $executable -ArgumentList "--disable-gpu", "--allow-test-instance", "--test-user-data=`"$isolatedRoot`"" -PassThru
  Start-Sleep -Seconds 8
  $appProcess.Refresh()
  if ($appProcess.HasExited) { throw "Installed application did not start." }
  if (-not (Test-Path -LiteralPath $isolatedSessionData -PathType Container)) { throw "Installed application did not create isolated session data." }
  if (-not (Get-ChildItem -LiteralPath $isolatedSessionData -Force | Select-Object -First 1)) { throw "Installed application did not populate isolated session data." }

  Stop-TestProcessTree $appProcess
  if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) { throw "Isolated marker did not survive the app process lifecycle." }
  Write-Output "Installed runtime used isolated userData/sessionData and preserved its marker across the app process lifecycle."
}
catch {
  $primaryFailure = $_
}
finally {
  try { Stop-TestProcessTree $appProcess } catch { $cleanupFailures.Add("process tree cleanup: $($_.Exception.Message)") }

  if (-not $installOccurred -and (Test-Path -LiteralPath $uninstaller -PathType Leaf)) { $installOccurred = $true }
  if ($installOccurred) {
    try {
      if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw "Exact generated uninstaller is missing: $uninstaller" }
      $uninstall = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
      if ($uninstall.ExitCode -ne 0) { throw "Uninstaller failed with exit code $($uninstall.ExitCode)." }
    }
    catch { $cleanupFailures.Add("uninstall cleanup: $($_.Exception.Message)") }
  }

  try { Remove-TestPath $isolatedRoot } catch { $cleanupFailures.Add("isolated root cleanup: $($_.Exception.Message)") }
  try { Remove-TestPath $target } catch { $cleanupFailures.Add("install target cleanup: $($_.Exception.Message)") }
}

$cleanupSummary = if ($cleanupFailures.Count) { " Cleanup failures: " + ($cleanupFailures -join " | ") } else { "" }
if ($primaryFailure) {
  throw [InvalidOperationException]::new("Installer QA failed: $($primaryFailure.Exception.Message)$cleanupSummary", $primaryFailure.Exception)
}
if ($cleanupFailures.Count) { throw "Installer QA cleanup failed: $($cleanupFailures -join ' | ')" }

Write-Output "Installer certification passed; NSIS AppData preservation is enforced by deleteAppDataOnUninstall=false."
