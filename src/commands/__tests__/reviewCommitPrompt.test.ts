import { afterEach, describe, expect, test } from 'bun:test'
import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  resetStateForTests,
  setOriginalCwd,
  setProjectRoot,
} from '../../bootstrap/state.js'
import { getDefaultAppState } from '../../state/AppStateStore.js'
import type { ToolUseContext } from '../../Tool.js'
import { runWithCwdOverride } from '../../utils/cwd.js'
import { createFileStateCacheWithSizeLimit } from '../../utils/fileStateCache.js'
import { gitExe } from '../../utils/git.js'
import { setCwd } from '../../utils/Shell.js'

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
  const dir = mkdtempSync(join(tmpdir(), 'recode-review-commit-'))
  tempDirs.push(dir)

  runGit(dir, ['init'])
  runGit(dir, ['config', 'user.name', 'recode-tests'])
  runGit(dir, ['config', 'user.email', 'recode-tests@example.com'])

  writeFileSync(join(dir, 'README.md'), '# recode test repo\n', 'utf8')
  runGit(dir, ['add', 'README.md'])
  runGit(dir, ['commit', '-m', 'initial commit'])
  runGit(dir, ['checkout', '-b', 'main'])

  return dir
}

function createToolUseContext(): ToolUseContext {
  let appState = getDefaultAppState()

  return {
    options: {
      commands: [],
      debug: false,
      mainLoopModel: 'test-model',
      tools: [],
      verbose: false,
      thinkingConfig: { type: 'disabled' },
      mcpClients: [],
      mcpResources: {},
      isNonInteractiveSession: false,
      agentDefinitions: { activeAgents: [], allAgents: [] },
    },
    abortController: new AbortController(),
    readFileState: createFileStateCacheWithSizeLimit(10),
    getAppState: () => appState,
    setAppState: updater => {
      appState = updater(appState)
    },
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
    updateFileHistoryState: () => {},
    updateAttributionState: () => {},
    messages: [],
    toolUseId: 'tool-use-test',
  } as ToolUseContext
}

describe('review and commit-push-pr prompt generation', () => {
  afterEach(() => {
    process.chdir(initialProcessCwd)
    setOriginalCwd(initialProcessCwd)
    setProjectRoot(initialProcessCwd)
    setCwd(initialProcessCwd)
    resetStateForTests()

    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  test('review stays local and threads the PR number into the prompt', async () => {
    const { default: review } = await import('../review.js')
    const blocks = await review.getPromptForCommand('123')
    const text = blocks[0]

    expect(text?.type).toBe('text')
    expect(text?.text).toContain('gh pr list')
    expect(text?.text).toContain('gh pr view <number>')
    expect(text?.text).toContain('gh pr diff <number>')
    expect(text?.text).toContain('PR number: 123')
  })

  test('ultrareview metadata keeps the intended public description', async () => {
    const { ultrareview } = await import('../review.js')

    expect(ultrareview.description).toContain('~10-20 min')
    expect(ultrareview.description).toContain('Claude Code on the web')
  })

  test('commit builds prompt context from the local repo without shell reset noise', async () => {
    const { default: commit } = await import('../commit.js')
    const repoDir = createTempRepo()
    writeFileSync(join(repoDir, 'README.md'), '# recode updated repo\n', 'utf8')

    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const currentBranch = runGit(repoDir, ['branch', '--show-current'])

    const blocks = await runWithCwdOverride(repoDir, () =>
      commit.getPromptForCommand('', createToolUseContext()),
    )
    const text = blocks[0]

    expect(text?.type).toBe('text')
    expect(text?.text).toContain('Current git status:')
    expect(text?.text).toContain('Current git diff (staged and unstaged changes):')
    expect(text?.text).toContain(`- Current branch: ${currentBranch}`)
    expect(text?.text).toContain('Recent commits:')
    expect(text?.text).toContain('README.md')
    expect(text?.text).not.toContain('Shell command failed')
    expect(text?.text).not.toContain('Shell cwd was reset')
  })

  test('commit-push-pr builds prompt context from the local repo and appends user instructions', async () => {
    const { default: commitPushPr } = await import('../commit-push-pr.js')
    const repoDir = createTempRepo()
    writeFileSync(join(repoDir, 'README.md'), '# recode updated repo\n', 'utf8')

    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const currentBranch = runGit(repoDir, ['branch', '--show-current'])

    const blocks = await runWithCwdOverride(repoDir, () =>
      commitPushPr.getPromptForCommand(
        'Mention the regression coverage in the PR body.',
        createToolUseContext(),
      ),
    )
    const text = blocks[0]

    expect(text?.type).toBe('text')
    expect(text?.text).toContain('README.md')
    expect(text?.text).toContain(`- \`git branch --show-current\`: ${currentBranch}`)
    expect(text?.text).toContain('gh pr view --json number 2>/dev/null || true')
    expect(text?.text).toContain('## Additional instructions from user')
    expect(text?.text).toContain('Mention the regression coverage in the PR body.')
    expect(text?.text).not.toContain('Shell cwd was reset')
  })
})
