$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$brand = Get-Content -LiteralPath (Join-Path $workspace "src\brand-config.json") -Raw | ConvertFrom-Json
$version = (Get-Content -LiteralPath (Join-Path $workspace "package.json") -Raw | ConvertFrom-Json).version
$target = Join-Path $workspace ".tmp\installer-certification"
$installer = Join-Path (Join-Path $workspace "release") "$($brand.slug)-Setup-$version-x64.exe"
$isolatedRoot = [IO.Path]::GetFullPath((Join-Path $env:TEMP ("$($brand.slug)-installer-test-" + [Guid]::NewGuid())))
$isolatedUserData = Join-Path $isolatedRoot "userData"
$isolatedSessionData = Join-Path $isolatedRoot "sessionData"
$appProcess = $null

if (-not $target.StartsWith($workspace)) { throw "Installer test target is outside the workspace." }
$tempRootWithSeparator = [IO.Path]::GetFullPath($env:TEMP).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $isolatedRoot.StartsWith($tempRootWithSeparator, [StringComparison]::OrdinalIgnoreCase)) { throw "Installer test data root is outside TEMP." }

try {
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  New-Item -ItemType Directory -Path $isolatedUserData -Force | Out-Null
  '{"autoStartEnabled":false,"closeBehavior":"exit"}' | Set-Content -LiteralPath (Join-Path $isolatedUserData "app-preferences.json") -Encoding utf8

  $install = Start-Process -FilePath $installer -ArgumentList @("/S", ("/D=" + $target)) -Wait -PassThru
  if ($install.ExitCode -ne 0) { throw "Installer failed with exit code $($install.ExitCode)." }

  $executable = Join-Path $target "$($brand.displayName).exe"
  if (-not (Test-Path -LiteralPath $executable)) { throw "Installed executable is missing." }

  $appProcess = Start-Process -FilePath $executable -ArgumentList "--disable-gpu", "--allow-test-instance", "--test-user-data=`"$isolatedRoot`"" -PassThru
  Start-Sleep -Seconds 8
  $appProcess.Refresh()
  if ($appProcess.HasExited) { throw "Installed application did not start." }
  if (-not (Test-Path -LiteralPath $isolatedSessionData -PathType Container)) { throw "Installed application did not create isolated session data." }
  if (-not (Get-ChildItem -LiteralPath $isolatedSessionData -Force | Select-Object -First 1)) { throw "Installed application did not populate isolated session data." }
  Stop-Process -Id $appProcess.Id -Force
  Wait-Process -Id $appProcess.Id -Timeout 10 -ErrorAction SilentlyContinue

  $marker = Join-Path $isolatedUserData "release-preservation-test.marker"
  Set-Content -LiteralPath $marker -Value "preserve"
  $uninstaller = Join-Path $target "Uninstall $($brand.displayName).exe"
  $uninstall = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
  Start-Sleep -Seconds 3
  if ($uninstall.ExitCode -ne 0) { throw "Uninstaller failed with exit code $($uninstall.ExitCode)." }
  if (Test-Path -LiteralPath $target) { throw "Installation directory remains after uninstall." }
  if (-not (Test-Path -LiteralPath $marker)) { throw "Isolated user data was removed during uninstall." }
  Write-Output "Installer certification passed for $($brand.displayName) with isolated user data."
}
finally {
  if ($appProcess -and -not $appProcess.HasExited) { Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $isolatedRoot) { Remove-Item -LiteralPath $isolatedRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
