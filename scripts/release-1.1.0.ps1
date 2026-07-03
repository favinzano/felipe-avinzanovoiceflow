#requires -Version 5.1

<#
.SYNOPSIS
Creates the official branded v1.1.0 release commit and tag.

.DESCRIPTION
Requires:
- A clean Git working tree.
- The active branch to be main.
- origin to point to GitHub.
- v1.1.0 to not already exist locally or remotely.

Uses an atomic Git push so the release commit and tag cannot be pushed
independently.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Brand = Get-Content -LiteralPath (Join-Path $ProjectRoot "src\brand-config.json") -Raw | ConvertFrom-Json

$Version = "1.1.0"
$TagName = "v$Version"
$CommitMessage = "release(v1.1.0): implement push-to-talk, taskbar overlay states, UPX compression, and parallel AVX2 pipelines"
$TagMessage = "$($Brand.displayName) v1.1.0 Production Release - AVX2 Ready Platform"

# $PackagePath = Join-Path $PSScriptRoot "package.json"
# $ChangelogPath = Join-Path $PSScriptRoot "CHANGELOG.md"

$PackagePath = Join-Path $ProjectRoot "package.json"
$ChangelogPath = Join-Path $ProjectRoot "CHANGELOG.md"


$ReleaseNotes = @"
## - 2026-06-14

- **Added:** New native Windows Taskbar status overlays and binary badge tracking for downloading, recording, and inference states. Dual-mode hotkey settings layout supporting toggle and low-level "Push-to-Talk" hardware events.
- **Optimized (DevOps Overhaul):** Matrix compilation build pipeline splits inside GitHub Actions for ``Legacy`` vs ``AVX2`` binaries. Integrated pre-release native DLL extraction compression routines using UPX binary stripping tools.

"@

$OriginalCommit = $null
$CommitCreated = $false
$TagCreated = $false
$PushCompleted = $false
$OriginalPackageText = $null
$OriginalChangelogText = $null

function Invoke-Git {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    Write-Host "> git $($Arguments -join ' ')"
    & git @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed with exit code $LASTEXITCODE`: git $($Arguments -join ' ')"
    }
}

function Restore-LocalRepository {
    if ($PushCompleted) {
        return
    }

    if ($CommitCreated -or $TagCreated) {
        Write-Warning "Release stopped after creating local Git history. No history was rewritten."
        Write-Warning "Inspect commit HEAD and tag $TagName, then retry the atomic push or recover them manually."
        return
    }

    if ($null -ne $OriginalPackageText -and $null -ne $OriginalChangelogText) {
        Write-Warning "Release failed before commit. Restoring package.json and CHANGELOG.md only."
        [IO.File]::WriteAllText($PackagePath, $OriginalPackageText, [Text.UTF8Encoding]::new($false))
        [IO.File]::WriteAllText($ChangelogPath, $OriginalChangelogText, [Text.UTF8Encoding]::new($false))
        & git restore --staged -- package.json CHANGELOG.md 2>$null
        if ($LASTEXITCODE -ne 0) { Write-Warning "Could not unstage restored release files; run git restore --staged -- package.json CHANGELOG.md." }
    }
}

try {
    # Push-Location $PSScriptRoot
    Push-Location $ProjectRoot


    Invoke-Git @("rev-parse", "--is-inside-work-tree")

    $OriginalCommit = (& git rev-parse "HEAD").Trim()
    if ($LASTEXITCODE -ne 0 -or -not $OriginalCommit) {
        throw "Unable to determine the current Git commit."
    }

    $Branch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to determine the active Git branch."
    }
    if ($Branch -ne "main") {
        throw "Release blocked: active branch '$Branch' is not 'main'."
    }

    $WorkingTree = & git status --porcelain
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect the Git working tree."
    }
    if ($WorkingTree) {
        throw "Release blocked: the Git working tree must be clean before running this script."
    }


    $OriginUrl = (& git remote get-url origin).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to resolve the origin remote."
    }
    if ($OriginUrl -notmatch "^(https://github\.com/|git@github\.com:)") {
        throw "Release blocked: origin does not point to GitHub. Current origin: $OriginUrl"
    }
    $ExpectedRepository = $Brand.repository.slug
    if ($OriginUrl -notmatch [regex]::Escape($ExpectedRepository)) {
        throw "Release blocked: origin does not match $ExpectedRepository. Current origin: $OriginUrl"
    }

    Invoke-Git @("fetch", "origin", "main", "--tags")

    & git rev-parse --verify --quiet "refs/tags/$TagName"
    if ($LASTEXITCODE -eq 0) {
        throw "Release blocked: local tag '$TagName' already exists."
    }

    & git ls-remote --exit-code --tags origin "refs/tags/$TagName"
    if ($LASTEXITCODE -eq 0) {
        throw "Release blocked: remote tag '$TagName' already exists."
    }
    if ($LASTEXITCODE -ne 2) {
        throw "Unable to verify whether remote tag '$TagName' exists."
    }

    if (-not (Test-Path -LiteralPath $PackagePath -PathType Leaf)) {
        throw "Missing required file: package.json"
    }
    if (-not (Test-Path -LiteralPath $ChangelogPath -PathType Leaf)) {
        throw "Missing required file: CHANGELOG.md"
    }
    $OriginalPackageText = [IO.File]::ReadAllText($PackagePath)
    $OriginalChangelogText = [IO.File]::ReadAllText($ChangelogPath)

    # 1. Update package.json using structured JSON parsing
    $Package = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
    $Package.version = $Version
    $PackageJson = $Package | ConvertTo-Json -Depth 100
    [IO.File]::WriteAllText($PackagePath, $PackageJson, [Text.UTF8Encoding]::new($false))

    # 2. Read the clean CHANGELOG framework
    $ExistingChangelog = Get-Content -LiteralPath $ChangelogPath -Raw
    if ($ExistingChangelog -match "(?m)^## - 2026-06-14\s*$") {
        throw "CHANGELOG.md already contains the v1.1.0 release date section."
    }

    # 3. Combine notes and trim trailing whitespaces cleanly
    $NewChangelogContent = $ReleaseNotes + $ExistingChangelog.TrimStart()
    $FinalChangelogText = $NewChangelogContent.Trim()

    # 4. Save the clean markdown text to disk
    [IO.File]::WriteAllText($ChangelogPath, $FinalChangelogText, [Text.UTF8Encoding]::new($false))

    Invoke-Git @("add", "--", "package.json", "CHANGELOG.md")
    Invoke-Git @("diff", "--cached", "--check")
    Invoke-Git @("commit", "-m", $CommitMessage)
    $CommitCreated = $true

    Invoke-Git @("tag", "-a", $TagName, "-m", $TagMessage)
    $TagCreated = $true

    # Atomic push prevents main and the release tag from being pushed separately.
    Invoke-Git @("push", "--atomic", "origin", "main", "--tags")
    $PushCompleted = $true

    Write-Host "Successfully released $($Brand.displayName) $TagName."
}
catch {
    Write-Error $_
    Restore-LocalRepository
    exit 1
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
}
