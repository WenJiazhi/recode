import { afterEach, describe, expect, test } from 'bun:test'
import { spawnSync } from 'child_process'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getCurrentWorktreeSession,
  cleanupWorktree,
  createWorktreeForSession,
  hasWorktreeChanges,
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
})
