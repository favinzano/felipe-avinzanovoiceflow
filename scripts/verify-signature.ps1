$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$brand = Get-Content -LiteralPath (Join-Path $projectRoot "src\brand-config.json") -Raw | ConvertFrom-Json
$releaseDir = Join-Path $projectRoot "release"
$installer = Get-ChildItem -LiteralPath $releaseDir -Filter "$($brand.slug)-Setup-*.exe" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$application = Get-Item -LiteralPath (Join-Path (Join-Path $releaseDir "win-unpacked") "$($brand.displayName).exe")
$pasteHelper = Get-Item -LiteralPath (Join-Path (Join-Path $releaseDir "win-unpacked\resources\native\win32-x64") "$($brand.helperBaseName).exe")

if (-not $installer) { throw "No se encontro un instalador de $($brand.displayName) para verificar." }

foreach ($artifact in @($installer, $application, $pasteHelper)) {
  $signature = Get-AuthenticodeSignature -FilePath $artifact.FullName
  if ($signature.Status -ne "Valid") {
    throw "Firma Authenticode invalida para $($artifact.Name): $($signature.Status)"
  }
  Write-Host "Firma valida: $($artifact.Name) - $($signature.SignerCertificate.Subject)"
}
