import { afterEach, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { runWithCwdOverride } from '../../utils/cwd.js'
import {
  createFileStateCacheWithSizeLimit,
} from '../../utils/fileStateCache.js'

let isGitRepo = false
let diffResult: any = null

mock.module('../../utils/git.js', () => ({
  getIsGit: async () => isGitRepo,
}))

mock.module('../../utils/gitDiff.js', () => ({
  fetchGitDiff: async () => diffResult,
}))

const createdDirs: string[] = []

afterEach(() => {
  isGitRepo = false
  diffResult = null

  while (createdDirs.length > 0) {
    const dir = createdDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('/files headless reports empty context', async () => {
  const { call } = await import('../files/files.js')
  const result = await call('', {} as any)

  expect(result).toEqual({
    type: 'text',
    value: 'No files in context',
  })
})

test('/files headless renders relative file paths from read state', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-files-'))
  createdDirs.push(dir)
  const cache = createFileStateCacheWithSizeLimit(10)
  cache.set(join(dir, 'src', 'index.ts'), {
    content: 'export {}',
    timestamp: Date.now(),
    offset: undefined,
    limit: undefined,
  })

  const { call } = await import('../files/files.js')
  const result = await runWithCwdOverride(dir, () =>
    call('', { readFileState: cache } as any),
  )

  expect(result.type).toBe('text')
  expect(result.value).toContain('Files in context:')
  expect(result.value).toContain(join('src', 'index.ts'))
})

test('/diff headless reports non-git and clean states', async () => {
  const { call } = await import('../diff/diff-noninteractive.js')

  isGitRepo = false
  expect(await call('', {} as any)).toEqual({
    type: 'text',
    value: 'Not in a git repository.',
  })

  isGitRepo = true
  diffResult = {
    stats: { filesCount: 0, linesAdded: 0, linesRemoved: 0 },
    perFileStats: new Map(),
  }
  expect(await call('', {} as any)).toEqual({
    type: 'text',
    value: 'Working tree is clean.',
  })
})

test('/diff headless renders per-file summary and interactive hint', async () => {
  isGitRepo = true
  diffResult = {
    stats: { filesCount: 1, linesAdded: 12, linesRemoved: 3 },
    perFileStats: new Map([
      [
        'src/example.ts',
        {
          added: 12,
          removed: 3,
          isBinary: false,
          isUntracked: true,
        },
      ],
    ]),
  }

  const { call } = await import('../diff/diff-noninteractive.js')
  const result = await call('', {} as any)

  expect(result.type).toBe('text')
  expect(result.value).toContain('Uncommitted changes (git diff HEAD):')
  expect(result.value).toContain('1 files changed, +12 -3')
  expect(result.value).toContain('- src/example.ts (+12 -3) [untracked]')
  expect(result.value).toContain('Run `recode /diff` for the full interactive diff view.')
})

test('/tasks headless reports empty and sorted task summaries', async () => {
  const { call } = await import('../tasks/tasks-noninteractive.js')

  expect(
    await call('', {
      getAppState: () => ({ tasks: {} }),
    } as any),
  ).toEqual({
    type: 'text',
    value: 'No background tasks.',
  })

  const result = await call('', {
    getAppState: () => ({
      tasks: {
        t1: {
          status: 'completed',
          type: 'worker',
          description: 'older completed task',
          startTime: 1,
        },
        t2: {
          status: 'running',
          type: 'worker',
          description: 'active task',
          startTime: 2,
        },
      },
    }),
  } as any)

  expect(result.type).toBe('text')
  expect(result.value).toContain('Background tasks: 2')
  expect(result.value).toContain('- [running] active task (worker, t2)')
  expect(result.value).toContain('- [completed] older completed task (worker, t1)')
  expect(result.value).toContain('Run `recode /tasks` for the full interactive task manager.')
  expect(result.value.indexOf('active task')).toBeLessThan(
    result.value.indexOf('older completed task'),
  )
})
