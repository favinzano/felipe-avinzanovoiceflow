$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$brand = Get-Content -LiteralPath (Join-Path $projectRoot "src\brand-config.json") -Raw | ConvertFrom-Json
$application = (Resolve-Path (Join-Path (Join-Path $projectRoot "release\win-unpacked") "$($brand.displayName).exe")).Path
$hiddenProfile = Join-Path $env:TEMP ("$($brand.slug)-hidden-tray-test-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $hiddenProfile | Out-Null
'{"autoStartEnabled":false,"closeBehavior":"tray"}' | Set-Content -Path (Join-Path $hiddenProfile "app-preferences.json") -Encoding utf8

$hiddenProcess = Start-Process -FilePath $application -ArgumentList "--hidden", "--disable-gpu", "--allow-test-instance", "--user-data-dir=$hiddenProfile" -PassThru
try {
  Start-Sleep -Seconds 5
  $hiddenProcess.Refresh()
  if ($hiddenProcess.HasExited) {
    throw "El arranque oculto termino el proceso."
  }
  if ($hiddenProcess.MainWindowHandle -ne 0) {
    throw "El arranque con --hidden mostro una ventana en lugar de iniciar en la bandeja."
  }
  Write-Host "Hidden tray startup passed."
}
finally {
  if (-not $hiddenProcess.HasExited) {
    Stop-Process -Id $hiddenProcess.Id -Force
    Wait-Process -Id $hiddenProcess.Id -Timeout 10 -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $hiddenProfile -Recurse -Force -ErrorAction SilentlyContinue
}

$profile = Join-Path $env:TEMP ("$($brand.slug)-tray-test-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $profile | Out-Null
'{"autoStartEnabled":false,"closeBehavior":"tray"}' | Set-Content -Path (Join-Path $profile "app-preferences.json") -Encoding utf8

$process = Start-Process -FilePath $application -ArgumentList "--disable-gpu", "--allow-test-instance", "--user-data-dir=$profile" -PassThru
try {
  Start-Sleep -Seconds 5
  $process.Refresh()
  if ($process.HasExited -or $process.MainWindowHandle -eq 0) {
    throw "La aplicacion empaquetada no abrio una ventana."
  }

  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WindowClose {
  [DllImport("user32.dll")]
  public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
}
"@
  [WindowClose]::PostMessage($process.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
  Start-Sleep -Seconds 3
  $process.Refresh()
  if ($process.HasExited) {
    throw "Cerrar la ventana termino el proceso en lugar de ocultarlo en la bandeja."
  }
  Write-Host "Tray close behavior passed."
}
finally {
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
  Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
}
