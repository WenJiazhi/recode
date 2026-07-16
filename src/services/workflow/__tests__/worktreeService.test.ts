import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AppState } from '../../../state/AppState.js'
import type { ToolUseContext } from '../../../Tool.js'
import { runWithCwdOverride } from '../../../utils/cwd.js'
import {
  _clearOutputsForTest,
  _resetTaskOutputDirForTest,
  getTaskOutputDir,
} from '../../../utils/task/diskOutput.js'
import { gitExe } from '../../../utils/git.js'
import { removeAgentWorktree } from '../../../utils/worktree.js'
import { resetCommandQueue } from '../../../utils/messageQueueManager.js'
import {
  flushSessionStorage,
  resetProjectForTesting,
  setSessionFileForTesting,
} from '../../../utils/sessionStorage.js'
import { _clearWorkflowControlsForTesting } from '../control.js'
import { createWorkflowRun } from '../engine.js'
import {
  _setWorkflowStepRunnerForTesting,
  launchWorkflow,
  resumeWorkflow,
} from '../service.js'
import {
  appendWorkflowEvent,
  initializeWorkflowJournal,
  loadWorkflowRun,
} from '../storage.js'
import { _clearWorkflowStoreForTesting } from '../store.js'
import type { WorkflowStepWorktree } from '../types.js'
import { validateWorkflowSpec } from '../validation.js'
import {
  _clearWorkflowWorktreeStateForTesting,
  runWorkflowStepInWorktree,
} from '../worktree.js'

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync(gitExe(), args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

function createContext(): {
  context: ToolUseContext
  getState: () => AppState
} {
  let state = { tasks: {} } as AppState
  const setAppState = (updater: (previous: AppState) => AppState): void => {
    state = updater(state)
  }
  return {
    context: {
      toolUseId: 'workflow-worktree-tool-use',
      getAppState: () => state,
      setAppState,
      setAppStateForTasks: setAppState,
      options: {},
    } as unknown as ToolUseContext,
    getState: () => state,
  }
}

async function waitForTerminalTask(
  getState: () => AppState,
  taskId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) {
    const status = getState().tasks[taskId]?.status
    if (status && status !== 'running' && status !== 'pending') return
    await Bun.sleep(5)
  }
  throw new Error(`Workflow task ${taskId} did not finish`)
}

function createBarrier(size: number): () => Promise<void> {
  let arrivals = 0
  let release!: () => void
  const ready = new Promise<void>(resolve => {
    release = resolve
  })
  return async () => {
    arrivals += 1
    if (arrivals === size) release()
    await ready
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

test('workflow service merges isolated write steps and journals their lifecycle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-service-git-'))
  const configDir = await mkdtemp(join(tmpdir(), 'recode-workflow-config-'))
  const previousConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = configDir
  runGit(root, ['init'])
  runGit(root, ['config', 'user.name', 'recode-tests'])
  runGit(root, ['config', 'user.email', 'recode-tests@example.com'])
  await writeFile(
    join(root, '.gitignore'),
    '.claude/worktrees/\n.recode/workflow-runs/\n',
  )
  await writeFile(join(root, 'base.txt'), 'base\n')
  runGit(root, ['add', '.gitignore', 'base.txt'])
  runGit(root, ['commit', '-m', 'initial'])

  resetProjectForTesting()
  setSessionFileForTesting(join(configDir, 'session.jsonl'))
  resetCommandQueue()
  _resetTaskOutputDirForTest()
  _clearWorkflowStoreForTesting()
  _clearWorkflowControlsForTesting()
  _clearWorkflowWorktreeStateForTesting()
  const { context, getState } = createContext()
  const barrier = createBarrier(2)
  _setWorkflowStepRunnerForTesting(async ({ step, workingDirectory }) => {
    if (!workingDirectory)
      throw new Error('Expected isolated working directory')
    await barrier()
    await writeFile(join(workingDirectory, `${step.id}.txt`), `${step.id}\n`)
    return { output: `result:${step.id}`, tokens: 10, toolUses: 1 }
  })

  try {
    const launched = await runWithCwdOverride(root, () =>
      launchWorkflow(
        {
          version: 1,
          name: 'service-worktree-test',
          objective: 'Apply independent changes',
          maxConcurrency: 2,
          steps: [
            {
              id: 'alpha',
              title: 'Alpha',
              prompt: 'Write alpha',
              mode: 'write',
              isolation: 'worktree',
            },
            {
              id: 'beta',
              title: 'Beta',
              prompt: 'Write beta',
              mode: 'write',
              isolation: 'worktree',
            },
          ],
        },
        {
          toolUseContext: context,
          canUseTool: async () =>
            ({ behavior: 'allow', updatedInput: {} }) as never,
        },
      ),
    )
    await waitForTerminalTask(getState, launched.taskId)

    expect(getState().tasks[launched.taskId]?.status).toBe('completed')
    expect(await readFile(join(root, 'alpha.txt'), 'utf8')).toBe('alpha\n')
    expect(await readFile(join(root, 'beta.txt'), 'utf8')).toBe('beta\n')
    const restored = await loadWorkflowRun(root, launched.runId)
    expect(restored?.status).toBe('completed')
    for (const step of Object.values(restored?.steps ?? {})) {
      expect(step.status).toBe('completed')
      expect(step.worktrees?.at(-1)?.status).toBe('merged')
      expect(await exists(step.worktrees!.at(-1)!.path)).toBe(false)
    }
  } finally {
    _setWorkflowStepRunnerForTesting()
    _clearWorkflowControlsForTesting()
    _clearWorkflowStoreForTesting()
    _clearWorkflowWorktreeStateForTesting()
    resetCommandQueue()
    await _clearOutputsForTest()
    await flushSessionStorage()
    resetProjectForTesting()
    await rm(getTaskOutputDir(), { recursive: true, force: true })
    await rm(root, { recursive: true, force: true })
    await rm(configDir, { recursive: true, force: true })
    if (previousConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = previousConfigDir
  }
}, 20_000)

test('workflow resume completes an already-applied checkpoint without rerunning the agent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-resume-git-'))
  const configDir = await mkdtemp(join(tmpdir(), 'recode-workflow-config-'))
  const previousConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = configDir
  runGit(root, ['init'])
  runGit(root, ['config', 'user.name', 'recode-tests'])
  runGit(root, ['config', 'user.email', 'recode-tests@example.com'])
  await writeFile(
    join(root, '.gitignore'),
    '.claude/worktrees/\n.recode/workflow-runs/\n',
  )
  await writeFile(join(root, 'base.txt'), 'base\n')
  runGit(root, ['add', '.gitignore', 'base.txt'])
  runGit(root, ['commit', '-m', 'initial'])

  resetProjectForTesting()
  setSessionFileForTesting(join(configDir, 'session.jsonl'))
  resetCommandQueue()
  _resetTaskOutputDirForTest()
  _clearWorkflowStoreForTesting()
  _clearWorkflowControlsForTesting()
  _clearWorkflowWorktreeStateForTesting()
  const { context, getState } = createContext()
  const spec = validateWorkflowSpec({
    version: 1,
    name: 'resume-checkpoint',
    objective: 'Recover an applied isolated change',
    steps: [
      {
        id: 'implement',
        title: 'Implement',
        prompt: 'Implement the change',
        mode: 'write',
        isolation: 'worktree',
      },
    ],
  })
  const run = createWorkflowRun({
    spec,
    sessionId: 'session',
    projectRoot: root,
    runId: '88888888-8888-4888-8888-888888888888',
  })
  run.status = 'running'
  run.steps.implement!.status = 'running'
  run.steps.implement!.attempts = 1
  let checkpoint: WorkflowStepWorktree | undefined
  let checkpointPersisted = false

  try {
    await initializeWorkflowJournal(run)
    await expect(
      runWorkflowStepInWorktree({
        run,
        step: spec.steps[0]!,
        async onUpdate(record) {
          const state = run.steps.implement!
          const worktrees = [...(state.worktrees ?? [])]
          const index = worktrees.findIndex(item => item.slug === record.slug)
          if (index === -1) worktrees.push(structuredClone(record))
          else worktrees[index] = structuredClone(record)
          state.worktrees = worktrees
          if (checkpointPersisted) return
          await appendWorkflowEvent(run, {
            type: 'step_updated',
            step: structuredClone(state),
          })
          if (record.status === 'merging') {
            checkpoint = structuredClone(record)
            checkpointPersisted = true
            throw new Error('simulated process exit after merge checkpoint')
          }
        },
        async execute(workingDirectory) {
          await writeFile(join(workingDirectory, 'recovered.txt'), 'done\n')
          return {
            output: 'checkpointed result',
            tokens: 17,
            toolUses: 2,
          }
        },
      }),
    ).rejects.toThrow('Worktree retained at')

    expect(checkpoint?.status).toBe('merging')
    await writeFile(join(root, 'recovered.txt'), 'done\n')
    expect(
      await removeAgentWorktree(checkpoint!.path, checkpoint!.branch, root),
    ).toBe(true)
    runGit(root, ['gc', '--prune=now'])
    run.status = 'failed'
    run.error = 'simulated process exit'
    run.completedAt = Date.now()
    run.updatedAt = run.completedAt
    await appendWorkflowEvent(run, {
      type: 'run_updated',
      status: 'failed',
      updatedAt: run.updatedAt,
      completedAt: run.completedAt,
      resumeCount: 0,
      totalTokens: 0,
      totalToolUses: 0,
      estimatedCostUsd: 0,
      hasUnknownCost: false,
      error: run.error,
    })

    let agentCalls = 0
    _setWorkflowStepRunnerForTesting(async () => {
      agentCalls += 1
      throw new Error('agent must not rerun an applied checkpoint')
    })
    const resumed = await runWithCwdOverride(root, () =>
      resumeWorkflow(run.runId, {
        toolUseContext: context,
        canUseTool: async () =>
          ({ behavior: 'allow', updatedInput: {} }) as never,
      }),
    )
    await waitForTerminalTask(getState, resumed.taskId)

    expect(agentCalls).toBe(0)
    expect(getState().tasks[resumed.taskId]?.status).toBe('completed')
    const restored = await loadWorkflowRun(root, run.runId)
    expect(restored?.status).toBe('completed')
    expect(restored?.resumeCount).toBe(1)
    expect(restored?.steps.implement).toMatchObject({
      status: 'completed',
      output: 'checkpointed result',
      tokens: 17,
      toolUses: 2,
    })
    expect(restored?.steps.implement?.worktrees?.at(-1)?.status).toBe('merged')
    expect(await readFile(join(root, 'recovered.txt'), 'utf8')).toBe('done\n')
    expect(
      runGit(root, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/recode/workflows',
      ]),
    ).toBe('')
  } finally {
    _setWorkflowStepRunnerForTesting()
    _clearWorkflowControlsForTesting()
    _clearWorkflowStoreForTesting()
    _clearWorkflowWorktreeStateForTesting()
    resetCommandQueue()
    await _clearOutputsForTest()
    await flushSessionStorage()
    resetProjectForTesting()
    await rm(getTaskOutputDir(), { recursive: true, force: true })
    await rm(root, { recursive: true, force: true })
    await rm(configDir, { recursive: true, force: true })
    if (previousConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = previousConfigDir
  }
}, 20_000)
