$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$brand = Get-Content -LiteralPath (Join-Path $projectRoot "src\brand-config.json") -Raw | ConvertFrom-Json
$application = (Resolve-Path (Join-Path (Join-Path $projectRoot "release\win-unpacked") "$($brand.displayName).exe")).Path
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeWindow {
  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
}
"@

function Stop-TestProcessTree($process) {
  if (-not $process) { return }
  $process.Refresh()
  if (-not $process.HasExited) {
    & taskkill.exe /PID $process.Id /T /F | Out-Null
    Wait-Process -Id $process.Id -Timeout 10 -ErrorAction SilentlyContinue
  }
}

function Remove-TestRoot($root) {
  for ($attempt = 1; $attempt -le 5; $attempt++) {
    if (-not (Test-Path -LiteralPath $root)) { return }
    try { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction Stop } catch {
      if ($attempt -eq 5) { throw "Tray QA failed to clean isolated root: $root" }
      Start-Sleep -Milliseconds 500
    }
  }
}

$hiddenProfile = Join-Path $env:TEMP ("$($brand.slug)-hidden-tray-test-" + [Guid]::NewGuid())
$hiddenUserData = Join-Path $hiddenProfile "userData"
$hiddenProcess = $null
try {
  New-Item -ItemType Directory -Path $hiddenUserData -Force | Out-Null
  '{"autoStartEnabled":false,"closeBehavior":"tray"}' | Set-Content -Path (Join-Path $hiddenUserData "app-preferences.json") -Encoding utf8
  $hiddenProcess = Start-Process -FilePath $application -ArgumentList "--hidden", "--disable-gpu", "--allow-test-instance", "--test-user-data=`"$hiddenProfile`"" -PassThru
  Start-Sleep -Seconds 5
  $hiddenProcess.Refresh()
  if ($hiddenProcess.HasExited) {
    throw "El arranque oculto termino el proceso."
  }
  if ($hiddenProcess.MainWindowHandle -ne 0 -and [NativeWindow]::IsWindowVisible($hiddenProcess.MainWindowHandle)) {
    throw "El arranque con --hidden mostro una ventana en lugar de iniciar en la bandeja."
  }
  Write-Host "Hidden tray startup passed."
}
finally {
  Stop-TestProcessTree $hiddenProcess
  Remove-TestRoot $hiddenProfile
}

$profile = Join-Path $env:TEMP ("$($brand.slug)-tray-test-" + [Guid]::NewGuid())
$userData = Join-Path $profile "userData"
$process = $null
try {
  New-Item -ItemType Directory -Path $userData -Force | Out-Null
  '{"autoStartEnabled":false,"closeBehavior":"tray"}' | Set-Content -Path (Join-Path $userData "app-preferences.json") -Encoding utf8
  $process = Start-Process -FilePath $application -ArgumentList "--disable-gpu", "--allow-test-instance", "--test-user-data=`"$profile`"" -PassThru
  Start-Sleep -Seconds 5
  $process.Refresh()
  if ($process.HasExited -or $process.MainWindowHandle -eq 0 -or -not [NativeWindow]::IsWindowVisible($process.MainWindowHandle)) {
    throw "La aplicacion empaquetada no abrio una ventana."
  }

  [NativeWindow]::PostMessage($process.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
  Start-Sleep -Seconds 3
  $process.Refresh()
  if ($process.HasExited) {
    throw "Cerrar la ventana termino el proceso en lugar de ocultarlo en la bandeja."
  }
  Write-Host "Tray close behavior passed."
}
finally {
  Stop-TestProcessTree $process
  Remove-TestRoot $profile
}
