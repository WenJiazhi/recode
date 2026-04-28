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
import { type ToolUseContext } from '../../Tool.js'
import { runWithCwdOverride } from '../cwd.js'
import { createFileStateCacheWithSizeLimit } from '../fileStateCache.js'
import { executeShellCommandsInPrompt } from '../promptShellExecution.js'
import { setCwd } from '../Shell.js'
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
  const dir = mkdtempSync(join(tmpdir(), 'recode-prompt-shell-'))
  tempDirs.push(dir)

  runGit(dir, ['init'])
  runGit(dir, ['config', 'user.name', 'recode-tests'])
  runGit(dir, ['config', 'user.email', 'recode-tests@example.com'])

  writeFileSync(join(dir, 'README.md'), '# recode test repo\n', 'utf8')
  runGit(dir, ['add', 'README.md'])
  runGit(dir, ['commit', '-m', 'initial commit'])

  return dir
}

function createToolUseContext(
  allowRules?: string[],
): ToolUseContext {
  let appState = getDefaultAppState()

  if (allowRules && allowRules.length > 0) {
    appState = {
      ...appState,
      toolPermissionContext: {
        ...appState.toolPermissionContext,
        alwaysAllowRules: {
          ...appState.toolPermissionContext.alwaysAllowRules,
          command: allowRules,
        },
      },
    }
  }

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

describe('executeShellCommandsInPrompt', () => {
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

  test('expands git placeholders used by the commit workflow without shell reset noise', async () => {
    const repoDir = createTempRepo()
    writeFileSync(join(repoDir, 'README.md'), '# recode updated repo\n', 'utf8')

    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const branch = runGit(repoDir, ['branch', '--show-current'])
    const prompt = [
      '- Current git status: !`git status --short`',
      '- Current branch: !`git branch --show-current`',
      '- Recent commits: !`git log --oneline -1`',
    ].join('\n')

    const expanded = await runWithCwdOverride(repoDir, () =>
      executeShellCommandsInPrompt(prompt, createToolUseContext(), '/commit'),
    )

    expect(expanded).toContain('M README.md')
    expect(expanded).toContain(`- Current branch: ${branch}`)
    expect(expanded).toContain('initial commit')
    expect(expanded).not.toContain('Shell cwd was reset')
  })

  test('allows the optional gh probe used by commit-push-pr to fail open', async () => {
    const repoDir = createTempRepo()

    process.chdir(repoDir)
    setOriginalCwd(repoDir)
    setProjectRoot(repoDir)
    setCwd(repoDir)

    const prompt =
      '- `gh pr view --json number 2>/dev/null || true`: !`gh pr view --json number 2>/dev/null || true`'

    const expanded = await runWithCwdOverride(repoDir, () =>
      executeShellCommandsInPrompt(
        prompt,
        createToolUseContext(['Bash(gh pr view:*)']),
        '/commit-push-pr',
      ),
    )

    expect(expanded).toContain(
      '- `gh pr view --json number 2>/dev/null || true`:',
    )
    expect(expanded).not.toContain('Shell command failed')
    expect(expanded).not.toContain('Shell cwd was reset')
  })
})
