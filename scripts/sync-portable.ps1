[CmdletBinding()]
param(
  [string]$SourceRoot = "E:\appdev\claudecode-rebuild",
  [string]$PortableRoot = "E:\appdev\recode-portable",
  [string]$PortableTemplateRoot = "",
  [switch]$RefreshDependencies
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

function Sync-ManagedDirectory {
  param(
    [string]$Name
  )

  $sourcePath = Join-Path $SourceRoot $Name
  $destPath = Join-Path $PortableRoot $Name

  if (-not (Test-Path $sourcePath)) {
    if (Test-Path $destPath) {
      Remove-Item -LiteralPath $destPath -Recurse -Force
    }
    return
  }

  New-Item -ItemType Directory -Force -Path $destPath | Out-Null

  $robocopyArgs = @(
    $sourcePath,
    $destPath,
    '/MIR',
    '/R:1',
    '/W:1',
    '/XD',
    'node_modules',
    '/NFL',
    '/NDL',
    '/NJH',
    '/NJS',
    '/NP'
  )

  if ($Name -eq '.recode') {
    $robocopyArgs += @('/XF', 'api-key.txt', 'local-provider.json')
  }

  & robocopy @robocopyArgs | Out-Null
  $exitCode = $LASTEXITCODE
  if ($exitCode -ge 8) {
    throw "robocopy failed while syncing '$Name' with exit code $exitCode"
  }
}

function Sync-ManagedFile {
  param(
    [string]$Name
  )

  $sourcePath = Join-Path $SourceRoot $Name
  $destPath = Join-Path $PortableRoot $Name

  if (-not (Test-Path $sourcePath)) {
    if (Test-Path $destPath) {
      Remove-Item -LiteralPath $destPath -Force
    }
    return
  }

  Copy-Item -LiteralPath $sourcePath -Destination $destPath -Force
}

function Assert-NoReparsePoints {
  param(
    [string]$Path,
    [string]$Context
  )

  $rootItem = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
  if ($rootItem -and ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw "$Context must be a materialized directory when -RefreshDependencies is used. Reparse point found: $($rootItem.FullName)"
  }

  $reparsePoint = Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } |
    Select-Object -First 1

  if ($reparsePoint) {
    throw "$Context must be a materialized directory when -RefreshDependencies is used. Reparse point found: $($reparsePoint.FullName)"
  }
}

function Get-FileHashOrThrow {
  param([string]$LiteralPath)

  if (-not (Test-Path $LiteralPath)) {
    throw "Required file not found: $LiteralPath"
  }

  return (Get-FileHash -Algorithm SHA256 -LiteralPath $LiteralPath).Hash
}

function Write-DependencyStamp {
  param(
    [string]$RepoRoot,
    [string]$PortableRootPath
  )

  $stampPath = Join-Path $PortableRootPath $dependencyStampName
  $stamp = @{
    packageJsonSha256 = Get-FileHashOrThrow -LiteralPath (Join-Path $RepoRoot 'package.json')
    bunLockSha256 = Get-FileHashOrThrow -LiteralPath (Join-Path $RepoRoot 'bun.lock')
    refreshedAt = (Get-Date).ToString('o')
  } | ConvertTo-Json

  [IO.File]::WriteAllText($stampPath, $stamp + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

function Test-PortableDependencyStampMatchesRepo {
  param(
    [string]$RepoRoot,
    [string]$PortableRootPath
  )

  foreach ($name in @('runtime', 'node_modules')) {
    if (-not (Test-Path (Join-Path $PortableRootPath $name))) {
      return $false
    }
  }

  $stampPath = Join-Path $PortableRootPath $dependencyStampName
  if (-not (Test-Path $stampPath)) {
    return $false
  }

  try {
    $stamp = Get-Content -LiteralPath $stampPath -Raw | ConvertFrom-Json
  } catch {
    return $false
  }

  if (-not $stamp.packageJsonSha256 -or -not $stamp.bunLockSha256) {
    return $false
  }

  return (
    $stamp.packageJsonSha256 -eq (Get-FileHashOrThrow -LiteralPath (Join-Path $RepoRoot 'package.json')) -and
    $stamp.bunLockSha256 -eq (Get-FileHashOrThrow -LiteralPath (Join-Path $RepoRoot 'bun.lock'))
  )
}

function Assert-TemplateDependencyBaseMatchesRepo {
  param(
    [string]$RepoRoot,
    [string]$TemplateRoot
  )

  foreach ($name in @('package.json', 'bun.lock')) {
    $repoHash = Get-FileHashOrThrow -LiteralPath (Join-Path $RepoRoot $name)
    $templateHash = Get-FileHashOrThrow -LiteralPath (Join-Path $TemplateRoot $name)
    if ($repoHash -ne $templateHash) {
      throw "Portable template dependency base is stale: '$name' differs between repo and PortableTemplateRoot. Refresh or rebuild the portable template before using -RefreshDependencies."
    }
  }
}

$managedDirectories = @(
  '.githooks',
  '.github',
  '.recode',
  'docs',
  'packages',
  'scripts',
  'src'
)

$managedFiles = @(
  '.editorconfig',
  '.gitignore',
  'biome.json',
  'build.ts',
  'bun.lock',
  'bunfig.toml',
  'CLAUDE.md',
  'configure-provider.bat',
  'configure-provider.cmd',
  'install-portable.bat',
  'install-portable.cmd',
  'knip.json',
  'mint.json',
  'package.json',
  'README.md',
  'README.zh-CN.md',
  'recode.bat',
  'recode.cmd',
  'SECURITY.md',
  'sync-portable.bat',
  'tsconfig.json',
  'uninstall-portable.bat',
  'uninstall-portable.cmd'
)

$portableKeepDirectories = @(
  'node_modules',
  'runtime'
)

$portableKeepFiles = @(
  'AGENTS.md',
  $dependencyStampName
)

if (-not (Test-Path $PortableRoot)) {
  throw "Portable root not found: $PortableRoot"
}

$PortableRoot = Assert-SafeDestructiveDirectory -Path $PortableRoot -Context 'PortableRoot' -ProtectedPaths @(
  $SourceRoot,
  $PortableTemplateRoot
)

foreach ($directory in $managedDirectories) {
  Sync-ManagedDirectory -Name $directory
}

foreach ($file in $managedFiles) {
  Sync-ManagedFile -Name $file
}

$managedNames = @($managedDirectories + $managedFiles)
$preservedNames = @($portableKeepDirectories + $portableKeepFiles)
$allowedNames = @($managedNames + $preservedNames)

Get-ChildItem -LiteralPath $PortableRoot -Force | ForEach-Object {
  if ($_.Name -notin $allowedNames) {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
  }
}

if ($RefreshDependencies) {
  if ([string]::IsNullOrWhiteSpace($PortableTemplateRoot)) {
    throw "PortableTemplateRoot is required when -RefreshDependencies is used"
  }

  Assert-TemplateDependencyBaseMatchesRepo -RepoRoot $SourceRoot -TemplateRoot $PortableTemplateRoot

  $stampPath = Join-Path $PortableRoot $dependencyStampName
  if (Test-Path $stampPath) {
    Remove-Item -LiteralPath $stampPath -Force
  }

  foreach ($name in @('runtime', 'node_modules')) {
    $templatePath = Join-Path $PortableTemplateRoot $name
    $portablePath = Join-Path $PortableRoot $name
    if (-not (Test-Path $templatePath)) {
      throw "Portable template path missing: $templatePath"
    }

    Assert-NoReparsePoints -Path $templatePath -Context $templatePath

    New-Item -ItemType Directory -Force -Path $portablePath | Out-Null
    & robocopy $templatePath $portablePath /MIR /XJ /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    $exitCode = $LASTEXITCODE
    if ($exitCode -ge 8) {
      throw "robocopy failed while refreshing portable '$name' with exit code $exitCode"
    }
  }

  Write-DependencyStamp -RepoRoot $SourceRoot -PortableRootPath $PortableRoot
} elseif (-not (Test-PortableDependencyStampMatchesRepo -RepoRoot $SourceRoot -PortableRootPath $PortableRoot)) {
  Write-Warning "Portable dependency base may be stale. package.json/bun.lock were synced, but runtime/, node_modules/, and $dependencyStampName were preserved. Run sync-portable.ps1 -RefreshDependencies before building or packaging."
}

Write-Host "Portable sync complete."
Write-Host "Source:   $SourceRoot"
Write-Host "Portable: $PortableRoot"
Write-Host "Preserved runtime/local files: runtime/, node_modules/, $dependencyStampName, .recode/api-key.txt, .recode/local-provider.json, AGENTS.md"
if ($RefreshDependencies) {
  Write-Host "Refreshed portable runtime/node_modules from template: $PortableTemplateRoot"
}
