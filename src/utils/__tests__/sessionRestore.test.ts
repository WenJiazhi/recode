import { afterEach, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resetStateForTests, setOriginalCwd, setProjectRoot } from '../../bootstrap/state.js'
import { setCwd } from '../Shell.js'
import { getCwd } from '../cwd.js'
import { saveCurrentProjectConfig } from '../config.js'
import { restoreWorktreeForResume, exitRestoredWorktree } from '../sessionRestore.js'
import { saveWorktreeState } from '../sessionStorage.js'
import { getCurrentWorktreeSession, restoreWorktreeSession } from '../worktree.js'
import type { PersistedWorktreeSession } from '../../types/logs.js'

const tempDirs: string[] = []
const initialProcessCwd = process.cwd()

afterEach(() => {
  restoreWorktreeSession(null)
  process.chdir(initialProcessCwd)
  setOriginalCwd(initialProcessCwd)
  setProjectRoot(initialProcessCwd)
  setCwd(initialProcessCwd)
  saveCurrentProjectConfig(current => ({
    ...current,
    activeWorktreeSession: undefined,
    currentSessionWorktree: undefined,
  }))
  resetStateForTests()

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('restoreWorktreeForResume re-enters a persisted worktree and exitRestoredWorktree returns to the original cwd', () => {
  const repoDir = mkdtempSync(join(tmpdir(), 'recode-session-restore-repo-'))
  const worktreeDir = mkdtempSync(join(tmpdir(), 'recode-session-restore-worktree-'))
  tempDirs.push(repoDir, worktreeDir)
  mkdirSync(join(repoDir, '.claude'), { recursive: true })

  process.chdir(repoDir)
  setOriginalCwd(repoDir)
  setProjectRoot(repoDir)
  setCwd(repoDir)

  const persisted: PersistedWorktreeSession = {
    originalCwd: repoDir,
    worktreePath: worktreeDir,
    worktreeName: 'feature-resume',
    worktreeBranch: 'worktree-feature-resume',
    sessionId: 'resume-session',
  }

  restoreWorktreeForResume(persisted)

  expect(process.cwd()).toBe(worktreeDir)
  expect(getCwd()).toBe(worktreeDir)
  expect(getCurrentWorktreeSession()?.worktreePath).toBe(worktreeDir)
  expect(getCurrentWorktreeSession()?.originalCwd).toBe(repoDir)

  exitRestoredWorktree()

  expect(process.cwd()).toBe(repoDir)
  expect(getCwd()).toBe(repoDir)
  expect(getCurrentWorktreeSession()).toBeNull()
})

test('restoreWorktreeForResume clears stale persisted state when the worktree directory is gone', () => {
  const repoDir = mkdtempSync(join(tmpdir(), 'recode-session-stale-repo-'))
  const missingWorktreeDir = join(repoDir, 'missing-worktree')
  tempDirs.push(repoDir)
  mkdirSync(join(repoDir, '.claude'), { recursive: true })

  process.chdir(repoDir)
  setOriginalCwd(repoDir)
  setProjectRoot(repoDir)
  setCwd(repoDir)

  const stale: PersistedWorktreeSession = {
    originalCwd: repoDir,
    worktreePath: missingWorktreeDir,
    worktreeName: 'feature-missing',
    worktreeBranch: 'worktree-feature-missing',
    sessionId: 'missing-session',
  }

  restoreWorktreeForResume(stale)

  expect(process.cwd()).toBe(repoDir)
  expect(getCwd()).toBe(repoDir)
  expect(getCurrentWorktreeSession()).toBeNull()
})

test('restoreWorktreeForResume prefers an already-active fresh worktree session over stale transcript state', () => {
  const repoDir = mkdtempSync(join(tmpdir(), 'recode-session-fresh-repo-'))
  const freshWorktreeDir = mkdtempSync(join(tmpdir(), 'recode-session-fresh-worktree-'))
  const staleWorktreeDir = mkdtempSync(join(tmpdir(), 'recode-session-stale-worktree-'))
  tempDirs.push(repoDir, freshWorktreeDir, staleWorktreeDir)
  mkdirSync(join(repoDir, '.claude'), { recursive: true })

  process.chdir(repoDir)
  setOriginalCwd(repoDir)
  setProjectRoot(repoDir)
  setCwd(repoDir)

  const fresh: PersistedWorktreeSession = {
    originalCwd: repoDir,
    worktreePath: freshWorktreeDir,
    worktreeName: 'feature-fresh',
    worktreeBranch: 'worktree-feature-fresh',
    sessionId: 'fresh-session',
  }
  const stale: PersistedWorktreeSession = {
    originalCwd: repoDir,
    worktreePath: staleWorktreeDir,
    worktreeName: 'feature-stale',
    worktreeBranch: 'worktree-feature-stale',
    sessionId: 'stale-session',
  }

  restoreWorktreeSession(fresh)
  saveWorktreeState(stale)

  restoreWorktreeForResume(stale)

  expect(process.cwd()).toBe(repoDir)
  expect(getCwd()).toBe(repoDir)
  expect(getCurrentWorktreeSession()?.worktreePath).toBe(freshWorktreeDir)
})

test('exitRestoredWorktree tolerates a missing original cwd and leaves the process in the worktree', () => {
  const repoDir = mkdtempSync(join(tmpdir(), 'recode-session-missing-origin-repo-'))
  const worktreeDir = mkdtempSync(join(tmpdir(), 'recode-session-missing-origin-worktree-'))
  tempDirs.push(repoDir, worktreeDir)
  mkdirSync(join(repoDir, '.claude'), { recursive: true })

  process.chdir(repoDir)
  setOriginalCwd(repoDir)
  setProjectRoot(repoDir)
  setCwd(repoDir)

  const persisted: PersistedWorktreeSession = {
    originalCwd: repoDir,
    worktreePath: worktreeDir,
    worktreeName: 'feature-missing-origin',
    worktreeBranch: 'worktree-feature-missing-origin',
    sessionId: 'missing-origin-session',
  }

  restoreWorktreeForResume(persisted)
  rmSync(repoDir, { recursive: true, force: true })

  exitRestoredWorktree()

  expect(process.cwd()).toBe(worktreeDir)
  expect(getCwd()).toBe(worktreeDir)
  expect(getCurrentWorktreeSession()).toBeNull()
})
