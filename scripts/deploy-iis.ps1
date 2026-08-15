<#
.SYNOPSIS
    Publishes a validated static build to an IIS site with rollback on health-check failure.

.DESCRIPTION
    The script never clears the currently served directory. It copies the artifact to a
    release-specific directory, switches the IIS site's Physical Path, validates the site,
    and switches back automatically if validation fails. Previous releases are retained so
    an operator can perform a manual rollback later.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$SiteName,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ArtifactPath,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$DeployRoot,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-fA-F]{7,64}$')]
    [string]$ReleaseId,

    [uri]$HealthUrl = 'http://127.0.0.1/'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-DeployLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
    Write-Host "[$timestamp] $Message"
}

function Get-ExpandedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [Environment]::ExpandEnvironmentVariables($Path)
}

$resolvedArtifactPath = [IO.Path]::GetFullPath((Get-ExpandedPath -Path $ArtifactPath))
$resolvedDeployRoot = [IO.Path]::GetFullPath((Get-ExpandedPath -Path $DeployRoot))
$releaseRoot = Join-Path -Path $resolvedDeployRoot -ChildPath 'releases'
$releasePath = Join-Path -Path $releaseRoot -ChildPath $ReleaseId
$lockPath = Join-Path -Path $resolvedDeployRoot -ChildPath '.deploy.lock'
$statePath = Join-Path -Path $resolvedDeployRoot -ChildPath 'deployment-state.json'
$stateTempPath = Join-Path -Path $resolvedDeployRoot -ChildPath ('.deployment-state-{0}.tmp' -f $ReleaseId)

if (-not (Test-Path -LiteralPath $resolvedArtifactPath -PathType Container)) {
    throw "Artifact directory does not exist: $resolvedArtifactPath"
}

$artifactIndexPath = Join-Path -Path $resolvedArtifactPath -ChildPath 'index.html'
if (-not (Test-Path -LiteralPath $artifactIndexPath -PathType Leaf)) {
    throw "Static build validation failed: index.html is missing from $resolvedArtifactPath"
}

$artifactFiles = @(Get-ChildItem -LiteralPath $resolvedArtifactPath -Recurse -File -Force)
if ($artifactFiles.Count -eq 0) {
    throw "Static build validation failed: artifact contains no files: $resolvedArtifactPath"
}

New-Item -ItemType Directory -Path $resolvedDeployRoot -Force | Out-Null
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null

$lockStream = $null
$switchApplied = $false
$previousPhysicalPath = $null

try {
    try {
        $lockStream = [IO.File]::Open(
            $lockPath,
            [IO.FileMode]::OpenOrCreate,
            [IO.FileAccess]::ReadWrite,
            [IO.FileShare]::None
        )
    }
    catch {
        throw "Another deployment is already running or the deployment lock is not writable: $lockPath"
    }

    Import-Module WebAdministration -ErrorAction Stop

    $site = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
    if ($null -eq $site) {
        throw "IIS site was not found: $SiteName"
    }

    $previousPhysicalPath = Get-ExpandedPath -Path ([string]$site.PhysicalPath)
    if ([string]::IsNullOrWhiteSpace($previousPhysicalPath)) {
        throw "IIS site has no usable Physical Path: $SiteName"
    }

    Write-DeployLog "IIS site: $SiteName"
    Write-DeployLog "Current Physical Path: $previousPhysicalPath"
    Write-DeployLog "Artifact: $resolvedArtifactPath ($($artifactFiles.Count) files)"
    Write-DeployLog "Release: $releasePath"

    if (Test-Path -LiteralPath $releasePath) {
        throw "Release directory already exists; refusing to overwrite it: $releasePath"
    }

    New-Item -ItemType Directory -Path $releasePath -Force | Out-Null
    Get-ChildItem -LiteralPath $resolvedArtifactPath -Force | Copy-Item -Destination $releasePath -Recurse -Force

    $manifestPath = Join-Path -Path $releasePath -ChildPath 'deployment.json'
    [ordered]@{
        releaseId  = $ReleaseId
        deployedAt = (Get-Date).ToUniversalTime().ToString('o')
    } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

    $releaseFiles = @(Get-ChildItem -LiteralPath $releasePath -Recurse -File -Force)
    $releaseIndexPath = Join-Path -Path $releasePath -ChildPath 'index.html'
    if (-not (Test-Path -LiteralPath $releaseIndexPath -PathType Leaf) -or $releaseFiles.Count -ne ($artifactFiles.Count + 1)) {
        throw "Release copy validation failed. Expected $($artifactFiles.Count + 1) files, found $($releaseFiles.Count)."
    }

    $iisSitePath = "IIS:\Sites\$SiteName"
    Set-ItemProperty -LiteralPath $iisSitePath -Name physicalPath -Value $releasePath
    $switchApplied = $true
    Write-DeployLog "Switched IIS Physical Path to: $releasePath"

    $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 30
    if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 400) {
        throw "Health check returned HTTP $($response.StatusCode): $HealthUrl"
    }
    if ([string]::IsNullOrWhiteSpace([string]$response.Content)) {
        throw "Health check returned an empty response: $HealthUrl"
    }

    $manifestUrl = [Uri]::new($HealthUrl, 'deployment.json')
    $servedManifestResponse = Invoke-WebRequest -Uri $manifestUrl -UseBasicParsing -TimeoutSec 30
    $servedManifest = $servedManifestResponse.Content | ConvertFrom-Json
    if ([string]$servedManifest.releaseId -ne $ReleaseId) {
        throw "Served deployment marker does not match release ${ReleaseId}: $($servedManifest.releaseId)"
    }

    $effectivePath = Get-ExpandedPath -Path ([string](Get-Website -Name $SiteName).PhysicalPath)
    if ($effectivePath.TrimEnd('\') -ne $releasePath.TrimEnd('\')) {
        throw "IIS did not retain the new Physical Path. Expected $releasePath, got $effectivePath"
    }

    $deploymentState = [ordered]@{
        releaseId          = $ReleaseId
        releasePath        = $releasePath
        previousPath       = $previousPhysicalPath
        siteName           = $SiteName
        healthUrl          = $HealthUrl.AbsoluteUri
        deployedAt         = (Get-Date).ToUniversalTime().ToString('o')
        artifactFileCount  = $releaseFiles.Count
    }
    $deploymentState | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $stateTempPath -Encoding UTF8
    Move-Item -LiteralPath $stateTempPath -Destination $statePath -Force

    Write-DeployLog "Health check passed: HTTP $($response.StatusCode)"
    Write-DeployLog "Deployment completed successfully. Previous release retained at: $previousPhysicalPath"
}
catch {
    $deploymentError = $_
    if ($switchApplied -and -not [string]::IsNullOrWhiteSpace($previousPhysicalPath)) {
        try {
            Set-ItemProperty -LiteralPath "IIS:\Sites\$SiteName" -Name physicalPath -Value $previousPhysicalPath
            Write-DeployLog "Rollback completed. IIS Physical Path restored to: $previousPhysicalPath"
        }
        catch {
            Write-Error "Automatic rollback failed. Restore IIS Physical Path manually to: $previousPhysicalPath"
            Write-Error $_
        }
    }

    if (Test-Path -LiteralPath $stateTempPath) {
        Remove-Item -LiteralPath $stateTempPath -Force -ErrorAction SilentlyContinue
    }

    Write-Error "Deployment failed: $($deploymentError.Exception.Message)"
    throw $deploymentError
}
finally {
    if ($null -ne $lockStream) {
        $lockStream.Dispose()
    }
}
