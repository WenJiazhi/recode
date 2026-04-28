[CmdletBinding()]
param(
  [string]$SourceRepoRoot = "E:\appdev\claudecode-rebuild",
  [string]$SourcePortableRoot = "E:\appdev\recode-portable",
  [string]$OutputRoot = "E:\appdev\recode-portable-release",
  [string]$ZipPath = "E:\appdev\recode-portable-release.zip",
  [switch]$SkipArchive
)

$ErrorActionPreference = "Stop"

$dependencyStampName = '.portable-deps-stamp.json'

function Resolve-FullPath {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )

  if ([string]::IsNullOrWhiteSpace($Path)) {
    throw "Path must not be empty."
  }

  if (Test-Path -LiteralPath $Path) {
    return [IO.Path]::GetFullPath((Get-Item -LiteralPath $Path -Force).FullName)
  }

  return [IO.Path]::GetFullPath($Path)
}

function Test-IsSameOrAncestorPath {
  param(
    [Parameter(Mandatory = $true)][string]$CandidatePath,
    [Parameter(Mandatory = $true)][string]$ProtectedPath
  )

  $candidate = (Resolve-FullPath -Path $CandidatePath).TrimEnd('\', '/')
  $protected = (Resolve-FullPath -Path $ProtectedPath).TrimEnd('\', '/')

  if ($candidate.Equals($protected, [StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }

  return $protected.StartsWith(
    $candidate + [IO.Path]::DirectorySeparatorChar,
    [StringComparison]::OrdinalIgnoreCase
  )
}

function Assert-SafeDestructiveDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Context,
    [string[]]$ProtectedPaths = @()
  )

  $fullPath = Resolve-FullPath -Path $Path
  $root = [IO.Path]::GetPathRoot($fullPath).TrimEnd('\', '/')
  if ($fullPath.TrimEnd('\', '/').Equals($root, [StringComparison]::OrdinalIgnoreCase)) {
    throw "$Context cannot be a drive root: $fullPath"
  }

  foreach ($protectedPath in $ProtectedPaths) {
    if ([string]::IsNullOrWhiteSpace($protectedPath)) {
      continue
    }
    if (Test-IsSameOrAncestorPath -CandidatePath $fullPath -ProtectedPath $protectedPath) {
      throw "$Context is unsafe because it would overlap or contain a protected source path: $fullPath"
    }
  }

  return $fullPath
}

function Invoke-RobocopyMirror {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [string[]]$ExtraArgs = @()
  )

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  & robocopy $Source $Destination /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /NP @ExtraArgs | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "robocopy failed: '$Source' -> '$Destination' (exit $LASTEXITCODE)"
  }
}

function Remove-IfExists {
  param([string]$LiteralPath)
  if (Test-Path $LiteralPath) {
    Remove-Item -LiteralPath $LiteralPath -Recurse -Force
  }
}

function Resolve-SourceTargetPath {
  param(
    [Parameter(Mandatory = $true)][string]$SourceItemPath
  )

  $sourceItem = Get-Item -LiteralPath $SourceItemPath -Force
  $targets = @($sourceItem.Target)
  if ($targets.Count -eq 0) {
    throw "Reparse point has no target: $SourceItemPath"
  }

  $targetPath = [string]$targets[0]
  if (-not [IO.Path]::IsPathRooted($targetPath)) {
    $targetPath = Join-Path (Split-Path -Parent $SourceItemPath) $targetPath
  }

  return [IO.Path]::GetFullPath($targetPath)
}

function Resolve-ReparseTargetForRelease {
  param(
    [Parameter(Mandatory = $true)][string]$SourceRepoRoot,
    [Parameter(Mandatory = $true)][string]$SourcePortableRoot,
    [Parameter(Mandatory = $true)][string]$SourceItemPath
  )

  $targetPath = Resolve-SourceTargetPath -SourceItemPath $SourceItemPath
  $portablePackagesRoot = Join-Path $SourcePortableRoot "packages"
  $repoPackagesRoot = Join-Path $SourceRepoRoot "packages"
  $normalizedTarget = Resolve-FullPath -Path $targetPath
  $normalizedPortablePackages = Resolve-FullPath -Path $portablePackagesRoot

  if (Test-IsSameOrAncestorPath -CandidatePath $normalizedPortablePackages -ProtectedPath $normalizedTarget) {
    $relativePackagePath = Get-RelativePathCompat -BasePath $portablePackagesRoot -ChildPath $targetPath
    $repoPackageTarget = Join-Path $repoPackagesRoot $relativePackagePath
    if (-not (Test-Path $repoPackageTarget)) {
      throw "Could not resolve repo-owned workspace package target for '$SourceItemPath': $repoPackageTarget"
    }
    return [IO.Path]::GetFullPath($repoPackageTarget)
  }

  return $normalizedTarget
}

function Get-RelativePathCompat {
  param(
    [Parameter(Mandatory = $true)][string]$BasePath,
    [Parameter(Mandatory = $true)][string]$ChildPath
  )

  $base = [IO.Path]::GetFullPath($BasePath)
  if (-not $base.EndsWith([IO.Path]::DirectorySeparatorChar)) {
    $base += [IO.Path]::DirectorySeparatorChar
  }

  $baseUri = [Uri]$base
  $childUri = [Uri]([IO.Path]::GetFullPath($ChildPath))
  return [Uri]::UnescapeDataString(
    $baseUri.MakeRelativeUri($childUri).ToString().Replace('/', '\')
  )
}

function Dereference-ReparsePoints {
  param(
    [Parameter(Mandatory = $true)][string]$SourceRepoRoot,
    [Parameter(Mandatory = $true)][string]$SourcePortableRoot,
    [Parameter(Mandatory = $true)][string]$StageRoot
  )

  while ($true) {
    $stageReparsePoint = Get-ChildItem -LiteralPath $StageRoot -Recurse -Force |
      Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } |
      Sort-Object FullName |
      Select-Object -First 1

    if (-not $stageReparsePoint) {
      break
    }

    $relativePath = Get-RelativePathCompat -BasePath $StageRoot -ChildPath $stageReparsePoint.FullName
    $destinationPath = $stageReparsePoint.FullName
    $sourceItemPath = Join-Path $SourcePortableRoot $relativePath
    $targetPath = Resolve-ReparseTargetForRelease -SourceRepoRoot $SourceRepoRoot -SourcePortableRoot $SourcePortableRoot -SourceItemPath $sourceItemPath

    if (-not (Test-Path $targetPath)) {
      $fallbackTarget = Join-Path $SourcePortableRoot (Join-Path "node_modules" $stageReparsePoint.Name)
      if (Test-Path $fallbackTarget) {
        $targetPath = $fallbackTarget
      } else {
        throw "Could not resolve reparse target for '$sourceItemPath'"
      }
    }

    Remove-IfExists -LiteralPath $destinationPath

    if (Test-Path $targetPath -PathType Container) {
      Invoke-RobocopyMirror -Source $targetPath -Destination $destinationPath -ExtraArgs @('/XJ')
    } else {
      $parent = Split-Path -Parent $destinationPath
      New-Item -ItemType Directory -Force -Path $parent | Out-Null
      Copy-Item -LiteralPath $targetPath -Destination $destinationPath -Force
    }
  }
}

function Get-FileHashOrThrow {
  param([Parameter(Mandatory = $true)][string]$LiteralPath)

  if (-not (Test-Path $LiteralPath)) {
    throw "Required file not found: $LiteralPath"
  }

  return (Get-FileHash -Algorithm SHA256 -LiteralPath $LiteralPath).Hash
}

function Read-DependencyStampOrThrow {
  param(
    [Parameter(Mandatory = $true)][string]$SourcePortableRoot
  )

  $stampPath = Join-Path $SourcePortableRoot $dependencyStampName
  if (-not (Test-Path $stampPath)) {
    throw "Portable dependency base is stale: missing '$dependencyStampName'. Run sync-portable.ps1 -RefreshDependencies before building a release package."
  }

  try {
    $stamp = Get-Content -LiteralPath $stampPath -Raw | ConvertFrom-Json
  } catch {
    throw "Portable dependency base is stale: '$dependencyStampName' is unreadable. Run sync-portable.ps1 -RefreshDependencies before building a release package."
  }

  if (-not $stamp.packageJsonSha256 -or -not $stamp.bunLockSha256) {
    throw "Portable dependency base is stale: '$dependencyStampName' is incomplete. Run sync-portable.ps1 -RefreshDependencies before building a release package."
  }

  return $stamp
}

function Assert-PortableDependencyBaseMatchesRepo {
  param(
    [Parameter(Mandatory = $true)][string]$SourceRepoRoot,
    [Parameter(Mandatory = $true)][string]$SourcePortableRoot
  )

  $repoPackageHash = Get-FileHashOrThrow -LiteralPath (Join-Path $SourceRepoRoot 'package.json')
  $repoLockHash = Get-FileHashOrThrow -LiteralPath (Join-Path $SourceRepoRoot 'bun.lock')

  foreach ($name in @('package.json', 'bun.lock')) {
    $repoPath = Join-Path $SourceRepoRoot $name
    $portablePath = Join-Path $SourcePortableRoot $name

    $repoHash = Get-FileHashOrThrow -LiteralPath $repoPath
    $portableHash = Get-FileHashOrThrow -LiteralPath $portablePath

    if ($repoHash -ne $portableHash) {
      throw "Portable dependency base is stale: '$name' differs between repo and portable root. Run sync-portable before building a release package."
    }
  }

  $stamp = Read-DependencyStampOrThrow -SourcePortableRoot $SourcePortableRoot
  if ($stamp.packageJsonSha256 -ne $repoPackageHash -or $stamp.bunLockSha256 -ne $repoLockHash) {
    throw "Portable dependency base is stale: '$dependencyStampName' does not match the current repo dependency manifests. Run sync-portable.ps1 -RefreshDependencies before building a release package."
  }
}

function Invoke-RepoBuildOrThrow {
  param(
    [Parameter(Mandatory = $true)][string]$SourceRepoRoot
  )

  Push-Location $SourceRepoRoot
  try {
    & bun run build | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "bun run build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  if (-not (Test-Path (Join-Path $SourceRepoRoot "dist\\cli.js"))) {
    throw "Source repo dist build not found after build: $(Join-Path $SourceRepoRoot 'dist\\cli.js')"
  }
}

if (-not (Test-Path $SourcePortableRoot)) {
  throw "Source portable root not found: $SourcePortableRoot"
}

$OutputRoot = Assert-SafeDestructiveDirectory -Path $OutputRoot -Context 'OutputRoot' -ProtectedPaths @(
  $SourceRepoRoot,
  $SourcePortableRoot
)

Assert-PortableDependencyBaseMatchesRepo -SourceRepoRoot $SourceRepoRoot -SourcePortableRoot $SourcePortableRoot

Invoke-RepoBuildOrThrow -SourceRepoRoot $SourceRepoRoot

$stageRuntimeRoot = Join-Path $OutputRoot "runtime"
$stageDistRoot = Join-Path $OutputRoot "dist"
$stageNodeModulesRoot = Join-Path $OutputRoot "node_modules"
$stageConfigRoot = Join-Path $OutputRoot ".recode"

Remove-IfExists -LiteralPath $OutputRoot
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
New-Item -ItemType Directory -Force -Path $stageConfigRoot | Out-Null

Invoke-RobocopyMirror -Source (Join-Path $SourcePortableRoot "runtime") -Destination $stageRuntimeRoot
Invoke-RobocopyMirror -Source (Join-Path $SourceRepoRoot "dist") -Destination $stageDistRoot
Invoke-RobocopyMirror -Source (Join-Path $SourcePortableRoot "node_modules") -Destination $stageNodeModulesRoot -ExtraArgs @('/XJ')
Dereference-ReparsePoints -SourceRepoRoot $SourceRepoRoot -SourcePortableRoot $SourcePortableRoot -StageRoot $OutputRoot

foreach ($name in @("local-provider.example.json", "lsp.example.json")) {
  $source = Join-Path $SourceRepoRoot ".recode\$name"
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination (Join-Path $stageConfigRoot $name) -Force
  }
}

foreach ($name in @("README.md", "README.zh-CN.md")) {
  $source = Join-Path $SourceRepoRoot $name
  if (Test-Path $source) {
    Copy-Item -LiteralPath $source -Destination (Join-Path $OutputRoot $name) -Force
  }
}

foreach ($name in @(
  "recode.cmd",
  "recode.bat",
  "configure-provider.cmd",
  "configure-provider.bat",
  "install-portable.cmd",
  "install-portable.bat",
  "uninstall-portable.cmd",
  "uninstall-portable.bat"
)) {
  $source = Join-Path $SourceRepoRoot $name
  if (-not (Test-Path $source)) {
    throw "Required portable launcher script missing from source repo: $source"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $OutputRoot $name) -Force
}

if (-not $SkipArchive) {
  if (Test-Path $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  $zipParent = Split-Path -Parent $ZipPath
  if ($zipParent) {
    New-Item -ItemType Directory -Force -Path $zipParent | Out-Null
  }

  $outputParent = Split-Path -Parent $OutputRoot
  $outputLeaf = Split-Path -Leaf $OutputRoot
  & tar -a -c -f $ZipPath -C $outputParent $outputLeaf
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create archive: $ZipPath"
  }
}

$fileCount = (Get-ChildItem -LiteralPath $OutputRoot -Recurse -File | Measure-Object).Count
$dirCount = (Get-ChildItem -LiteralPath $OutputRoot -Recurse -Directory | Measure-Object).Count
$sizeBytes = (Get-ChildItem -LiteralPath $OutputRoot -Recurse -File | Measure-Object Length -Sum).Sum

Write-Host "Portable release build complete."
Write-Host "Source repo root:      $SourceRepoRoot"
Write-Host "Source portable root: $SourcePortableRoot"
Write-Host "Output root:          $OutputRoot"
if (-not $SkipArchive) {
  Write-Host "Archive:              $ZipPath"
}
Write-Host ("Files:                {0}" -f $fileCount)
Write-Host ("Directories:          {0}" -f $dirCount)
Write-Host ("Size (MB):            {0:N2}" -f ($sizeBytes / 1MB))
