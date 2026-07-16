import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AppState } from '../../../state/AppState.js'
import type { ToolUseContext } from '../../../Tool.js'
import { runWithCwdOverride } from '../../../utils/cwd.js'
import {
  _clearOutputsForTest,
  _resetTaskOutputDirForTest,
  flushTaskOutput,
  getTaskOutput,
  getTaskOutputDir,
} from '../../../utils/task/diskOutput.js'
import {
  getCommandQueueSnapshot,
  resetCommandQueue,
} from '../../../utils/messageQueueManager.js'
import {
  flushSessionStorage,
  resetProjectForTesting,
  setSessionFileForTesting,
} from '../../../utils/sessionStorage.js'
import { _clearWorkflowControlsForTesting } from '../control.js'
import {
  _setWorkflowStepRunnerForTesting,
  configureWorkflowRun,
  launchWorkflow,
  resumeWorkflow,
} from '../service.js'
import { appendWorkflowEvent, loadWorkflowRun } from '../storage.js'
import { _clearWorkflowStoreForTesting, setWorkflowRun } from '../store.js'

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
      toolUseId: 'workflow-tool-use',
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
  for (let attempt = 0; attempt < 200; attempt++) {
    const status = getState().tasks[taskId]?.status
    if (status && status !== 'running' && status !== 'pending') return
    await Bun.sleep(2)
  }
  throw new Error(`Workflow task ${taskId} did not finish`)
}

test('workflow service completes, notifies, journals, and resumes without rerunning completed steps', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-service-'))
  const configDir = await mkdtemp(join(tmpdir(), 'recode-workflow-config-'))
  const previousConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = configDir
  resetProjectForTesting()
  setSessionFileForTesting(join(configDir, 'session.jsonl'))
  resetCommandQueue()
  _resetTaskOutputDirForTest()
  _clearWorkflowStoreForTesting()
  _clearWorkflowControlsForTesting()

  const { context, getState } = createContext()
  const calls = new Map<string, number>()
  let failImplement = true
  _setWorkflowStepRunnerForTesting(async ({ step, dependencyOutputs }) => {
    calls.set(step.id, (calls.get(step.id) ?? 0) + 1)
    if (step.id === 'implement' && failImplement) {
      throw new Error('simulated provider failure')
    }
    if (step.id === 'implement') {
      expect(Object.keys(dependencyOutputs).sort()).toEqual(['review', 'tests'])
    }
    return { output: `result:${step.id}`, tokens: 10, toolUses: 1 }
  })

  try {
    const launched = await runWithCwdOverride(root, () =>
      launchWorkflow(
        {
          version: 1,
          name: 'service-test',
          objective: 'Review, test, and implement',
          maxConcurrency: 2,
          steps: [
            { id: 'review', title: 'Review', prompt: 'Review' },
            { id: 'tests', title: 'Tests', prompt: 'Inspect tests' },
            {
              id: 'implement',
              title: 'Implement',
              prompt: 'Implement verified changes',
              mode: 'write',
              dependsOn: ['review', 'tests'],
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
    expect(getState().tasks[launched.taskId]?.status).toBe('failed')
    expect(getState().tasks[launched.taskId]?.notified).toBe(true)

    const failed = await loadWorkflowRun(root, launched.runId)
    if (!failed) throw new Error('Expected failed workflow journal')
    expect(failed?.steps.review?.status).toBe('completed')
    expect(failed?.steps.implement?.status).toBe('failed')
    expect(
      getCommandQueueSnapshot().some(command =>
        String(command.value).includes(launched.runId),
      ),
    ).toBe(true)

    failImplement = false
    // Emulate a process crash that left the last persisted run status as
    // running. No in-memory control exists, so recovery must still be allowed.
    failed.status = 'running'
    failed.completedAt = undefined
    failed.updatedAt = Date.now()
    await appendWorkflowEvent(failed, {
      type: 'run_updated',
      status: 'running',
      updatedAt: failed.updatedAt,
      resumeCount: failed.resumeCount,
      totalTokens: failed.totalTokens,
      totalToolUses: failed.totalToolUses,
      estimatedCostUsd: failed.estimatedCostUsd,
      hasUnknownCost: failed.hasUnknownCost,
    })
    setWorkflowRun(failed)
    const resumed = await runWithCwdOverride(root, () =>
      resumeWorkflow(launched.runId, {
        toolUseContext: context,
        canUseTool: async () =>
          ({ behavior: 'allow', updatedInput: {} }) as never,
      }),
    )
    await waitForTerminalTask(getState, resumed.taskId)
    expect(getState().tasks[resumed.taskId]?.notified).toBe(true)
    await flushTaskOutput(resumed.taskId)

    const completed = await loadWorkflowRun(root, launched.runId)
    expect(completed?.status).toBe('completed')
    expect(completed?.resumeCount).toBe(1)
    expect(calls.get('review')).toBe(1)
    expect(calls.get('tests')).toBe(1)
    expect(calls.get('implement')).toBe(2)
    expect(await getTaskOutput(resumed.taskId)).toContain('result:implement')
  } finally {
    _setWorkflowStepRunnerForTesting()
    _clearWorkflowControlsForTesting()
    _clearWorkflowStoreForTesting()
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
})

test('workflow service reconfigures and resumes a budget-limited run', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-budget-'))
  const configDir = await mkdtemp(join(tmpdir(), 'recode-workflow-config-'))
  const previousConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = configDir
  resetProjectForTesting()
  setSessionFileForTesting(join(configDir, 'session.jsonl'))
  resetCommandQueue()
  _resetTaskOutputDirForTest()
  _clearWorkflowStoreForTesting()
  _clearWorkflowControlsForTesting()

  const { context, getState } = createContext()
  const calls = new Map<string, number>()
  _setWorkflowStepRunnerForTesting(async ({ step }) => {
    calls.set(step.id, (calls.get(step.id) ?? 0) + 1)
    return { output: step.id, tokens: 10, toolUses: 1 }
  })

  try {
    const launched = await runWithCwdOverride(root, () =>
      launchWorkflow(
        {
          version: 1,
          name: 'budget-resume',
          objective: 'Finish within an explicit budget',
          maxConcurrency: 1,
          tokenBudget: 5,
          steps: [
            { id: 'first', title: 'First', prompt: 'First' },
            {
              id: 'second',
              title: 'Second',
              prompt: 'Second',
              dependsOn: ['first'],
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

    const limited = await loadWorkflowRun(root, launched.runId)
    expect(limited?.status).toBe('budget_limited')
    expect(limited?.totalTokens).toBe(10)
    expect(limited?.steps.first?.status).toBe('completed')
    expect(limited?.steps.second?.status).toBe('pending')

    limited!.status = 'failed'
    limited!.error = 'simulated failure before a budget-aware resume'
    limited!.completedAt = Date.now()
    limited!.updatedAt = limited!.completedAt
    limited!.steps.second = {
      ...limited!.steps.second!,
      status: 'failed',
      completedAt: limited!.completedAt,
      error: limited!.error,
    }
    await appendWorkflowEvent(limited!, {
      type: 'step_updated',
      step: structuredClone(limited!.steps.second),
    })
    await appendWorkflowEvent(limited!, {
      type: 'run_updated',
      status: 'failed',
      updatedAt: limited!.updatedAt,
      completedAt: limited!.completedAt,
      resumeCount: limited!.resumeCount,
      totalTokens: limited!.totalTokens,
      totalToolUses: limited!.totalToolUses,
      estimatedCostUsd: limited!.estimatedCostUsd,
      hasUnknownCost: limited!.hasUnknownCost,
      error: limited!.error,
    })
    setWorkflowRun(limited!)

    const stillLimited = await runWithCwdOverride(root, () =>
      resumeWorkflow(launched.runId, {
        toolUseContext: context,
        canUseTool: async () =>
          ({ behavior: 'allow', updatedInput: {} }) as never,
      }),
    )
    await waitForTerminalTask(getState, stillLimited.taskId)
    const replayedBaseline = await loadWorkflowRun(root, launched.runId)
    expect(replayedBaseline?.status).toBe('budget_limited')
    expect(replayedBaseline?.steps.second?.status).toBe('pending')
    expect(calls.get('second')).toBeUndefined()

    const configured = await runWithCwdOverride(root, () =>
      configureWorkflowRun(launched.runId, {
        maxConcurrency: 2,
        tokenBudget: 50,
      }),
    )
    expect(configured.concurrencyLimit).toBe(2)
    expect(configured.tokenBudget).toBe(50)

    const resumed = await runWithCwdOverride(root, () =>
      resumeWorkflow(launched.runId, {
        toolUseContext: context,
        canUseTool: async () =>
          ({ behavior: 'allow', updatedInput: {} }) as never,
      }),
    )
    await waitForTerminalTask(getState, resumed.taskId)

    const completed = await loadWorkflowRun(root, launched.runId)
    expect(completed?.status).toBe('completed')
    expect(completed?.resumeCount).toBe(2)
    expect(completed?.totalTokens).toBe(20)
    expect(completed?.concurrencyLimit).toBe(2)
    expect(completed?.tokenBudget).toBe(50)
    expect(calls.get('first')).toBe(1)
    expect(calls.get('second')).toBe(1)
  } finally {
    _setWorkflowStepRunnerForTesting()
    _clearWorkflowControlsForTesting()
    _clearWorkflowStoreForTesting()
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
})

test('active workflow configuration wakes the scheduler immediately', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-concurrency-'))
  const configDir = await mkdtemp(join(tmpdir(), 'recode-workflow-config-'))
  const previousConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = configDir
  resetProjectForTesting()
  setSessionFileForTesting(join(configDir, 'session.jsonl'))
  resetCommandQueue()
  _resetTaskOutputDirForTest()
  _clearWorkflowStoreForTesting()
  _clearWorkflowControlsForTesting()

  const { context, getState } = createContext()
  const started: string[] = []
  const releases = new Map<string, () => void>()
  _setWorkflowStepRunnerForTesting(async ({ step }) => {
    started.push(step.id)
    await new Promise<void>(resolve => releases.set(step.id, resolve))
    return { output: step.id, tokens: 5, toolUses: 0 }
  })

  try {
    const launched = await runWithCwdOverride(root, () =>
      launchWorkflow(
        {
          version: 1,
          name: 'hot-concurrency',
          objective: 'Increase concurrency while running',
          maxConcurrency: 1,
          steps: [
            { id: 'one', title: 'One', prompt: 'One' },
            { id: 'two', title: 'Two', prompt: 'Two' },
          ],
        },
        {
          toolUseContext: context,
          canUseTool: async () =>
            ({ behavior: 'allow', updatedInput: {} }) as never,
        },
      ),
    )
    for (let i = 0; i < 100 && started.length < 1; i++) await Bun.sleep(1)
    expect(started).toEqual(['one'])

    await runWithCwdOverride(root, () =>
      Promise.all([
        configureWorkflowRun(launched.runId, { maxConcurrency: 2 }),
        configureWorkflowRun(launched.runId, { tokenBudget: 50 }),
      ]),
    )
    for (let i = 0; i < 100 && started.length < 2; i++) await Bun.sleep(1)
    expect(started).toEqual(['one', 'two'])

    releases.get('one')!()
    releases.get('two')!()
    await waitForTerminalTask(getState, launched.taskId)
    const completed = await loadWorkflowRun(root, launched.runId)
    expect(completed?.status).toBe('completed')
    expect(completed?.concurrencyLimit).toBe(2)
    expect(completed?.tokenBudget).toBe(50)
  } finally {
    for (const release of releases.values()) release()
    _setWorkflowStepRunnerForTesting()
    _clearWorkflowControlsForTesting()
    _clearWorkflowStoreForTesting()
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
})
