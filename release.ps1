<#
.SYNOPSIS
  Build a LOCKER Zarf package and deploy it to the current Kubernetes cluster.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\release.ps1 0.1.1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\release.ps1 0.1.1 -PackageOnly
  Builds the package file to carry to another environment. Does not need a cluster.
#>
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,

  [switch]$PackageOnly
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$manifest = Join-Path $root 'k8s\app.yaml'
$package = "zarf-package-locker-amd64-$Version.tar.zst"

function Find-Tool([string]$Name) {
  $found = Get-Command $Name -ErrorAction SilentlyContinue
  if ($found) { return $found.Source }
  $local = Join-Path $env:USERPROFILE "bin\$Name.exe"
  if (Test-Path $local) { return $local }
  throw "$Name was not found. Install it first (see Deploy.md)."
}

# Tools log to stderr, which must not count as a failure. The exit code decides.
function Invoke-Tool([string]$Tool, [string[]]$ToolArgs) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Tool @ToolArgs } finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) { throw "Failed ($LASTEXITCODE): $(Split-Path $Tool -Leaf) $($ToolArgs -join ' ')" }
}

Push-Location $root
try {
  $zarf = Find-Tool 'zarf'
  Invoke-Tool (Find-Tool 'docker') @('version', '--format', 'Docker engine {{.Server.Version}}')

  if (-not $PackageOnly) {
    $kubectl = Find-Tool 'kubectl'
    Write-Host "Cluster: $(& $kubectl config current-context)"

    # A reused tag can leave the cluster running the cached old image.
    $deployed = & $kubectl -n locker get deployment locker --ignore-not-found --request-timeout=15s -o 'jsonpath={.spec.template.spec.containers[0].image}'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot reach the cluster. Is Docker Desktop running and the cluster started?' }
    if ($deployed -match (':' + [regex]::Escape($Version) + '(-zarf-\d+)?$')) {
      throw "Version $Version is already deployed ($deployed). Use a new version number."
    }
  }

  # Package templates are not applied to manifest files, so the tag is set here.
  # Edit the raw text and write it without a BOM so the line endings and encoding stay as they were.
  $text = [IO.File]::ReadAllText($manifest)
  $pattern = 'zarf\.internal/locker:\S+'
  $matchCount = [regex]::Matches($text, $pattern).Count
  if ($matchCount -ne 1) { throw "Expected one locker image line in k8s\app.yaml, found $matchCount." }
  $text = [regex]::Replace($text, $pattern, "zarf.internal/locker:$Version")
  [IO.File]::WriteAllText($manifest, $text, (New-Object Text.UTF8Encoding($false)))
  Write-Host "k8s\app.yaml now uses zarf.internal/locker:$Version"

  Invoke-Tool $zarf @('package', 'create', '.', '--set', "VERSION=$Version", '-a', 'amd64', '--confirm')

  if ($PackageOnly) {
    Write-Host "Package ready: $package"
    return
  }

  Invoke-Tool $zarf @('package', 'deploy', ".\$package", '--confirm')
  Invoke-Tool $kubectl @('-n', 'locker', 'get', 'pods')

  Write-Host "Released $Version. Open it with: kubectl -n locker port-forward service/locker 8080:8000"
}
catch {
  Write-Host "Release failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
finally {
  Pop-Location
}
