import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function readRootFile(name: string): string {
  return readFileSync(join(process.cwd(), name), 'utf8')
}

test('install-portable.cmd keeps runtime and bundled Git paths rooted under PORTABLE_ROOT', () => {
  const script = readRootFile('install-portable.cmd')

  expect(script).toContain('set "GIT_CMD=%PORTABLE_ROOT%\\runtime\\git\\cmd"')
  expect(script).toContain('set "GIT_BIN=%PORTABLE_ROOT%\\runtime\\git\\bin"')
  expect(script).toContain(
    'set "GIT_USR_BIN=%PORTABLE_ROOT%\\runtime\\git\\usr\\bin"',
  )
  expect(script).toContain('set "RUNTIME_DIR=%PORTABLE_ROOT%\\runtime"')
  expect(script).toContain('if not exist "%RUNTIME_DIR%\\bun.exe" (')
  expect(script).toContain('echo Portable runtime is incomplete. Missing "%RUNTIME_DIR%\\bun.exe".')
  expect(script).not.toContain('%PORTABLE_ROOT%runtime\\git\\cmd')
})

test('uninstall-portable.cmd keeps runtime and bundled Git paths rooted under PORTABLE_ROOT', () => {
  const script = readRootFile('uninstall-portable.cmd')

  expect(script).toContain('set "GIT_CMD=%PORTABLE_ROOT%\\runtime\\git\\cmd"')
  expect(script).toContain('set "GIT_BIN=%PORTABLE_ROOT%\\runtime\\git\\bin"')
  expect(script).toContain(
    'set "GIT_USR_BIN=%PORTABLE_ROOT%\\runtime\\git\\usr\\bin"',
  )
  expect(script).toContain('set "RUNTIME_DIR=%PORTABLE_ROOT%\\runtime"')
  expect(script).not.toContain('%PORTABLE_ROOT%runtime\\git\\cmd')
})

test('build-portable-release.ps1 rebuilds dist from the source repo before staging the release', () => {
  const script = readRootFile('scripts/build-portable-release.ps1')

  expect(script).toContain('function Invoke-RepoBuildOrThrow')
  expect(script).toContain('& bun run build | Out-Null')
  expect(script).toContain('Invoke-RepoBuildOrThrow -SourceRepoRoot $SourceRepoRoot')
  expect(script).toContain('Source repo dist build not found after build')
  expect(script.indexOf('Assert-PortableDependencyBaseMatchesRepo -SourceRepoRoot $SourceRepoRoot -SourcePortableRoot $SourcePortableRoot')).toBeLessThan(
    script.indexOf('Invoke-RepoBuildOrThrow -SourceRepoRoot $SourceRepoRoot'),
  )
})

test('sync-portable.ps1 removes stale managed directories when the source directory disappears', () => {
  const script = readRootFile('scripts/sync-portable.ps1')

  expect(script).toContain('if (-not (Test-Path $sourcePath)) {')
  expect(script).toContain('if (Test-Path $destPath) {')
  expect(script).toContain('Remove-Item -LiteralPath $destPath -Recurse -Force')
})

test('build-portable-release.ps1 copies root-owned launcher and install scripts instead of inlining a second script body', () => {
  const script = readRootFile('scripts/build-portable-release.ps1')

  expect(script).toContain('"recode.cmd",')
  expect(script).toContain('"install-portable.cmd",')
  expect(script).toContain('"uninstall-portable.cmd"')
  expect(script).toContain('Copy-Item -LiteralPath $source -Destination (Join-Path $OutputRoot $name) -Force')
  expect(script).toContain('Required portable launcher script missing from source repo')
  expect(script).not.toContain("$recodeCmd = @'")
  expect(script).not.toContain("$installPortableCmd = @'")
})

test('build-portable-release.ps1 copies source-owned README and example config files from the repo root', () => {
  const script = readRootFile('scripts/build-portable-release.ps1')

  expect(script).toContain('Join-Path $SourceRepoRoot ".recode\\$name"')
  expect(script).toContain('Join-Path $SourceRepoRoot $name')
  expect(script).not.toContain('$source = Join-Path $SourcePortableRoot ".recode\\$name"')
  expect(script).not.toContain('$source = Join-Path $SourcePortableRoot $name')
})

test('build-portable-release.ps1 dereferences portable workspace package links from the source repo', () => {
  const script = readRootFile('scripts/build-portable-release.ps1')

  expect(script).toContain('[Parameter(Mandatory = $true)][string]$SourceRepoRoot')
  expect(script).toContain('Resolve-ReparseTargetForRelease')
  expect(script).toContain('$portablePackagesRoot = Join-Path $SourcePortableRoot "packages"')
  expect(script).toContain('$repoPackagesRoot = Join-Path $SourceRepoRoot "packages"')
  expect(script).toContain('$relativePackagePath = Get-RelativePathCompat -BasePath $portablePackagesRoot -ChildPath $targetPath')
  expect(script).toContain('$repoPackageTarget = Join-Path $repoPackagesRoot $relativePackagePath')
  expect(script).toContain('Dereference-ReparsePoints -SourceRepoRoot $SourceRepoRoot -SourcePortableRoot $SourcePortableRoot -StageRoot $OutputRoot')
})

test('sync-portable.ps1 rejects junctioned runtime or node_modules roots during dependency refresh', () => {
  const script = readRootFile('scripts/sync-portable.ps1')

  expect(script).toContain('$rootItem = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue')
  expect(script).toContain('$rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint')
  expect(script).toContain('Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue |')
})

test('sync-portable.ps1 warns when manifests changed but the dependency base was preserved', () => {
  const script = readRootFile('scripts/sync-portable.ps1')

  expect(script).toContain('function Test-PortableDependencyStampMatchesRepo')
  expect(script).toContain("foreach ($name in @('runtime', 'node_modules')) {")
  expect(script).toContain("if (-not (Test-Path (Join-Path $PortableRootPath $name))) {")
  expect(script).toContain("} elseif (-not (Test-PortableDependencyStampMatchesRepo -RepoRoot $SourceRoot -PortableRootPath $PortableRoot)) {")
  expect(script).toContain('Write-Warning "Portable dependency base may be stale.')
})

test('sync-portable.ps1 preserved-state output names node_modules and the dependency stamp explicitly', () => {
  const script = readRootFile('scripts/sync-portable.ps1')

  expect(script).toContain('Preserved runtime/local files: runtime/, node_modules/, $dependencyStampName, .recode/api-key.txt, .recode/local-provider.json, AGENTS.md')
})

test('portable PowerShell scripts guard destructive directory targets before recursive delete or mirror', () => {
  const syncScript = readRootFile('scripts/sync-portable.ps1')
  const releaseScript = readRootFile('scripts/build-portable-release.ps1')

  expect(syncScript).toContain('function Assert-SafeDestructiveDirectory')
  expect(syncScript).toContain("$PortableRoot = Assert-SafeDestructiveDirectory -Path $PortableRoot -Context 'PortableRoot'")
  expect(releaseScript).toContain('function Assert-SafeDestructiveDirectory')
  expect(releaseScript).toContain("$OutputRoot = Assert-SafeDestructiveDirectory -Path $OutputRoot -Context 'OutputRoot'")
})
