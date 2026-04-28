import { afterEach, describe, expect, test } from 'bun:test'
import { spawnSync } from 'child_process'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  copyWorktreeIncludeFiles,
  cleanupStaleAgentWorktrees,
  getCurrentWorktreeSession,
  cleanupWorktree,
  createAgentWorktree,
  createWorktreeForSession,
  hasWorktreeChanges,
  keepWorktree,
  removeAgentWorktree,
  validateWorktreeSlug,
  worktreeBranchName,
} from '../worktree.js'
import { resetStateForTests, setOriginalCwd, setProjectRoot } from '../../bootstrap/state.js'
import { setCwd } from '../Shell.js'
import { getCurrentProjectConfig, saveCurrentProjectConfig } from '../config.js'
import { gitExe } from '../git.js'

const tempDirs: string[] = []
const initialProcessCwd = process.cwd()

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync(gitExe(), args, {
    cwd,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

function createTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'recode-worktree-'))
  tempDirs.push(dir)

  runGit(dir, ['init'])
  runGit(dir, ['config', 'user.name', 'recode-tests'])
  runGit(dir, ['config', 'user.email', 'recode-tests@example.com'])

  writeFileSync(join(dir, 'README.md'), '# recode test repo\n', 'utf8')
  runGit(dir, ['add', 'README.md'])
  runGit(dir, ['commit', '-m', 'initial commit'])

  return dir
}

function attachBareRemote(repoDir: string): string {
  const remoteDir = mkdtempSync(join(tmpdir(), 'recode-worktree-remote-'))
  tempDirs.push(remoteDir)

  runGit(remoteDir, ['init', '--bare'])
  runGit(repoDir, ['remote', 'add', 'origin', remoteDir])
  runGit(repoDir, ['push', '-u', 'origin', 'HEAD'])

  return remoteDir
}

describe('worktree git workflow', () => {
  afterEach(async () => {
    try {
      await cleanupWorktree()
    } catch {
      // Best-effort cleanup for temp repos.
    }

    process.chdir(initialProcessCwd)
    setOriginalCwd(initialProcessCwd)
    setProjectRoot(initialProcessCwd)
    setCwd(initialProcessCwd)
    saveCurrentProjectConfig(current => ({
      ...current,
      activeWorktreeSession: undefined,
    }))
    resetStateForTests()

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  test('creates and cleans up a git worktree session', async () => {
    const repoDir = createTempRepo()
    mkdirSync(join(repoDir, '.claude'), { recursive: true })
    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const session = await createWorktreeForSession(
      '11111111-1111-1111-1111-111111111111',
      'feature-mainline',
    )

    expect(session.worktreeBranch).toBe(worktreeBranchName('feature-mainline'))
    expect(existsSync(session.worktreePath)).toBe(true)
    expect(runGit(session.worktreePath, ['branch', '--show-current'])).toBe(
      worktreeBranchName('feature-mainline'),
    )
    expect(getCurrentWorktreeSession()?.worktreePath).toBe(session.worktreePath)
    expect(getCurrentProjectConfig().activeWorktreeSession?.worktreePath).toBe(
      session.worktreePath,
    )

    await cleanupWorktree()

    expect(getCurrentWorktreeSession()).toBeNull()
    expect(existsSync(session.worktreePath)).toBe(false)
    expect(
      runGit(repoDir, ['branch', '--list', worktreeBranchName('feature-mainline')]),
    ).toBe('')
    expect(getCurrentProjectConfig().activeWorktreeSession).toBeUndefined()
  })

  test('keeps an existing worktree on disk while clearing session state', async () => {
    const repoDir = createTempRepo()
    mkdirSync(join(repoDir, '.claude'), { recursive: true })
    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const session = await createWorktreeForSession(
      '33333333-3333-3333-3333-333333333333',
      'feature-keep',
    )

    await keepWorktree()

    expect(getCurrentWorktreeSession()).toBeNull()
    expect(getCurrentProjectConfig().activeWorktreeSession).toBeUndefined()
    expect(existsSync(session.worktreePath)).toBe(true)
    expect(runGit(session.worktreePath, ['branch', '--show-current'])).toBe(
      worktreeBranchName('feature-keep'),
    )
  })

  test('reuses an existing named worktree instead of recreating it', async () => {
    const repoDir = createTempRepo()
    mkdirSync(join(repoDir, '.claude'), { recursive: true })
    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const firstSession = await createWorktreeForSession(
      '44444444-4444-4444-4444-444444444444',
      'feature-reuse',
    )
    const initialWorktreePath = firstSession.worktreePath
    await keepWorktree()

    const resumedSession = await createWorktreeForSession(
      '55555555-5555-5555-5555-555555555555',
      'feature-reuse',
    )

    expect(resumedSession.worktreePath).toBe(initialWorktreePath)
    expect(resumedSession.worktreeBranch).toBe(
      worktreeBranchName('feature-reuse'),
    )
    expect(resumedSession.creationDurationMs).toBeUndefined()
    expect(existsSync(initialWorktreePath)).toBe(true)

    expect(resumedSession.originalHeadCommit).toBe(firstSession.originalHeadCommit)
    expect(runGit(initialWorktreePath, ['branch', '--show-current'])).toBe(
      worktreeBranchName('feature-reuse'),
    )
  })

  test('detects dirty files and new commits inside a worktree', async () => {
    const repoDir = createTempRepo()
    mkdirSync(join(repoDir, '.claude'), { recursive: true })
    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const session = await createWorktreeForSession(
      '22222222-2222-2222-2222-222222222222',
      'feature-dirty',
    )

    expect(
      await hasWorktreeChanges(
        session.worktreePath,
        session.originalHeadCommit ?? '',
      ),
    ).toBe(false)

    writeFileSync(join(session.worktreePath, 'dirty.txt'), 'dirty\n', 'utf8')
    expect(
      await hasWorktreeChanges(
        session.worktreePath,
        session.originalHeadCommit ?? '',
      ),
    ).toBe(true)

    runGit(session.worktreePath, ['add', 'dirty.txt'])
    runGit(session.worktreePath, ['commit', '-m', 'dirty commit'])
    expect(
      await hasWorktreeChanges(
        session.worktreePath,
        session.originalHeadCommit ?? '',
      ),
    ).toBe(true)
  })

  test('rejects invalid worktree slugs before side effects', () => {
    expect(() => validateWorktreeSlug('feature/main')).not.toThrow()
    expect(() => validateWorktreeSlug('feature_main-1.2')).not.toThrow()

    expect(() => validateWorktreeSlug('..')).toThrow(
      'must not contain "." or ".." path segments',
    )
    expect(() => validateWorktreeSlug('../escape')).toThrow(
      'must not contain "." or ".." path segments',
    )
    expect(() => validateWorktreeSlug('feature//nested')).toThrow(
      'must be non-empty and contain only letters, digits, dots, underscores, and dashes',
    )
    expect(() => validateWorktreeSlug('feature\\nested')).toThrow(
      'must be non-empty and contain only letters, digits, dots, underscores, and dashes',
    )
  })

  test('flattens nested worktree slugs in branch names', () => {
    expect(worktreeBranchName('feature/main')).toBe('worktree-feature+main')
    expect(worktreeBranchName('team/review/fix')).toBe(
      'worktree-team+review+fix',
    )
  })

  test('copies only .worktreeinclude-matched gitignored files into the worktree', async () => {
    const repoDir = createTempRepo()
    const worktreeDir = mkdtempSync(join(tmpdir(), 'recode-worktree-copy-'))
    tempDirs.push(worktreeDir)

    mkdirSync(join(repoDir, 'config', 'secrets'), { recursive: true })
    writeFileSync(join(repoDir, '.gitignore'), 'config/\n*.local\n', 'utf8')
    writeFileSync(
      join(repoDir, '.worktreeinclude'),
      'config/secrets/api.key\nnotes.local\n',
      'utf8',
    )
    writeFileSync(join(repoDir, 'config', 'secrets', 'api.key'), 'secret\n', 'utf8')
    writeFileSync(join(repoDir, 'notes.local'), 'local notes\n', 'utf8')
    writeFileSync(join(repoDir, 'tracked.txt'), 'tracked\n', 'utf8')

    const copied = await copyWorktreeIncludeFiles(repoDir, worktreeDir)

    expect(copied.sort()).toEqual(['config/secrets/api.key', 'notes.local'])
    expect(existsSync(join(worktreeDir, 'config', 'secrets', 'api.key'))).toBe(
      true,
    )
    expect(existsSync(join(worktreeDir, 'notes.local'))).toBe(true)
    expect(existsSync(join(worktreeDir, 'tracked.txt'))).toBe(false)
  })

  test('expands collapsed ignored directories when .worktreeinclude targets nested files', async () => {
    const repoDir = createTempRepo()
    const worktreeDir = mkdtempSync(join(tmpdir(), 'recode-worktree-expand-'))
    tempDirs.push(worktreeDir)

    mkdirSync(join(repoDir, 'config', 'secrets'), { recursive: true })
    writeFileSync(join(repoDir, '.gitignore'), 'config/\n', 'utf8')
    writeFileSync(join(repoDir, '.worktreeinclude'), 'config/**/*.key\n', 'utf8')
    writeFileSync(join(repoDir, 'config', 'secrets', 'api.key'), 'secret\n', 'utf8')

    const copied = await copyWorktreeIncludeFiles(repoDir, worktreeDir)

    expect(copied).toEqual(['config/secrets/api.key'])
    expect(existsSync(join(worktreeDir, 'config', 'secrets', 'api.key'))).toBe(
      true,
    )
  })

  test('creates and removes an agent worktree without mutating the current session state', async () => {
    const repoDir = createTempRepo()
    mkdirSync(join(repoDir, '.claude'), { recursive: true })
    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const created = await createAgentWorktree('agent-a1234567')

    expect(created.gitRoot).toBe(repoDir)
    expect(created.worktreeBranch).toBe(worktreeBranchName('agent-a1234567'))
    expect(existsSync(created.worktreePath)).toBe(true)
    expect(getCurrentWorktreeSession()).toBeNull()
    expect(getCurrentProjectConfig().activeWorktreeSession).toBeUndefined()
    expect(process.cwd()).toBe(repoDir)
    expect(runGit(created.worktreePath, ['branch', '--show-current'])).toBe(
      worktreeBranchName('agent-a1234567'),
    )

    const removed = await removeAgentWorktree(
      created.worktreePath,
      created.worktreeBranch,
      created.gitRoot,
      created.hookBased,
    )

    expect(removed).toBe(true)
    expect(existsSync(created.worktreePath)).toBe(false)
    expect(
      runGit(repoDir, ['branch', '--list', worktreeBranchName('agent-a1234567')]),
    ).toBe('')
    expect(getCurrentWorktreeSession()).toBeNull()
    expect(getCurrentProjectConfig().activeWorktreeSession).toBeUndefined()
  })

  test('cleans up a stale clean ephemeral agent worktree when its HEAD is already reachable from a remote', async () => {
    const repoDir = createTempRepo()
    attachBareRemote(repoDir)
    mkdirSync(join(repoDir, '.claude'), { recursive: true })
    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const created = await createAgentWorktree('agent-a7654321')
    const staleDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
    utimesSync(created.worktreePath, staleDate, staleDate)

    const removed = await cleanupStaleAgentWorktrees(new Date())

    expect(removed).toBe(1)
    expect(existsSync(created.worktreePath)).toBe(false)
    expect(
      runGit(repoDir, ['branch', '--list', worktreeBranchName('agent-a7654321')]),
    ).toBe('')
  })

  test('skips dirty stale ephemeral agent worktrees during cleanup', async () => {
    const repoDir = createTempRepo()
    attachBareRemote(repoDir)
    mkdirSync(join(repoDir, '.claude'), { recursive: true })
    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const created = await createAgentWorktree('agent-aabcdef0')
    writeFileSync(join(created.worktreePath, 'README.md'), '# changed in worktree\n', 'utf8')
    const staleDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
    utimesSync(created.worktreePath, staleDate, staleDate)

    const removed = await cleanupStaleAgentWorktrees(new Date())

    expect(removed).toBe(0)
    expect(existsSync(created.worktreePath)).toBe(true)
    expect(
      runGit(repoDir, ['branch', '--list', worktreeBranchName('agent-aabcdef0')]),
    ).toContain(worktreeBranchName('agent-aabcdef0'))
  })
})
