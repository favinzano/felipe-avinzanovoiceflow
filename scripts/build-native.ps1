$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $projectRoot "tools\FelipeAvinzano.VoiceFlow.PasteHelper\FelipeAvinzano.VoiceFlow.PasteHelper.csproj"
$output = Join-Path $projectRoot "native\win32-x64"

dotnet publish $project -c Release -r win-x64 --self-contained true -o $output
if ($LASTEXITCODE -ne 0) { throw "dotnet publish fallo con codigo $LASTEXITCODE" }

$helper = Join-Path $output "FelipeAvinzano.VoiceFlow.PasteHelper.exe"
if (-not (Test-Path -LiteralPath $helper)) { throw "No se genero el helper nativo: $helper" }
Write-Host "Helper nativo generado: $helper"
