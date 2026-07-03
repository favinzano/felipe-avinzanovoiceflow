[CmdletBinding()]
param(
  [ValidateSet("Legacy", "AVX2")]
  [string]$ReleaseFlavor = $env:RELEASE_FLAVOR,
  [switch]$ResolveOnly
)

$ErrorActionPreference = "Stop"
if ($ReleaseFlavor -and $ReleaseFlavor -notin @("Legacy", "AVX2")) {
  throw "ReleaseFlavor no compatible: $ReleaseFlavor"
}
$projectRoot = Split-Path -Parent $PSScriptRoot
$brand = Get-Content -LiteralPath (Join-Path $projectRoot "src\brand-config.json") -Raw | ConvertFrom-Json
$package = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json
$releaseDir = Join-Path $projectRoot "release"
$flavorSuffix = if ($ReleaseFlavor) { "-$ReleaseFlavor" } else { "" }
$installerName = "$($brand.slug)-Setup-$($package.version)$flavorSuffix-x64.exe"
$paths = [ordered]@{
  installer = Join-Path $releaseDir $installerName
  application = Join-Path (Join-Path $releaseDir "win-unpacked") "$($brand.displayName).exe"
  helper = Join-Path (Join-Path $releaseDir "win-unpacked\resources\native\win32-x64") "$($brand.helperBaseName).exe"
}

if ($ResolveOnly) {
  $paths | ConvertTo-Json -Compress
  exit 0
}

$artifacts = foreach ($entry in $paths.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $entry.Value -PathType Leaf)) {
    throw "Falta el artefacto exacto para verificar: $($entry.Value)"
  }
  Get-Item -LiteralPath $entry.Value
}

foreach ($artifact in $artifacts) {
  $signature = Get-AuthenticodeSignature -FilePath $artifact.FullName
  if ($signature.Status -ne "Valid") {
    throw "Firma Authenticode invalida para $($artifact.Name): $($signature.Status)"
  }
  Write-Host "Firma valida: $($artifact.Name) - $($signature.SignerCertificate.Subject)"
}
