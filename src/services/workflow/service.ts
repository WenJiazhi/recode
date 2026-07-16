import type { CanUseToolFn } from '../../hooks/useCanUseTool.js'
import type { ToolUseContext } from '../../Tool.js'
import { getSessionId } from '../../bootstrap/state.js'
import {
  OUTPUT_FILE_TAG,
  STATUS_TAG,
  SUMMARY_TAG,
  TASK_ID_TAG,
  TASK_NOTIFICATION_TAG,
  TOOL_USE_ID_TAG,
} from '../../constants/xml.js'
import {
  markWorkflowTaskNotified,
  registerLocalWorkflowTask,
  syncWorkflowTask,
} from '../../tasks/LocalWorkflowTask/LocalWorkflowTask.js'
import { getCwd } from '../../utils/cwd.js'
import { logError } from '../../utils/log.js'
import { enqueuePendingNotification } from '../../utils/messageQueueManager.js'
import {
  appendTaskOutput,
  flushTaskOutput,
  getTaskOutputPath,
} from '../../utils/task/diskOutput.js'
import { emitTaskProgress } from '../../utils/task/sdkProgress.js'
import { escapeXml } from '../../utils/xml.js'
import { join } from 'path'
import {
  cancelWorkflowRun,
  consumeWorkflowStepAction,
  isWorkflowRunActive,
  registerWorkflowControl,
  setWorkflowStepController,
  unregisterWorkflowControl,
} from './control.js'
import {
  createWorkflowRun,
  executeWorkflow,
  applyWorkflowAttemptMetrics,
  normalizeWorkflowStepExecutionResult,
  prepareWorkflowRunForResume,
  WorkflowStepRetryError,
  WorkflowStepSkippedError,
} from './engine.js'
import { workflowErrorMetrics } from './errors.js'
import { runWorkflowAgentStep } from './agentRunner.js'
import {
  appendWorkflowEvent,
  getWorkflowRunsDir,
  initializeWorkflowJournal,
  loadWorkflowRun,
} from './storage.js'
import { setWorkflowRun } from './store.js'
import type { WorkflowRun, WorkflowSpec } from './types.js'
import type { WorkflowStepWorktree } from './types.js'
import type { WorkflowStepRunner } from './engine.js'
import { validateWorkflowSpec } from './validation.js'
import { MAX_WORKFLOW_CONCURRENCY } from './validation.js'
import {
  recoverWorkflowWorktrees,
  releaseWorkflowWorktreeRun,
  runWorkflowStepInWorktree,
} from './worktree.js'
import { WorkflowSchedulerSignal } from './runtime.js'
import { MAX_TOKEN_BUDGET } from '../../utils/tokenBudget.js'

let agentStepOverride: WorkflowStepRunner | null = null

type ActiveWorkflowRuntime = {
  run: WorkflowRun
  taskId: string
  host: WorkflowLaunchHost
  schedulerSignal: WorkflowSchedulerSignal
}

const activeWorkflowRuntimes = new Map<string, ActiveWorkflowRuntime>()
const workflowConfigurationTails = new Map<string, Promise<void>>()

async function withWorkflowConfigurationLock<T>(
  runId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = workflowConfigurationTails.get(runId) ?? Promise.resolve()
  let release!: () => void
  const tail = new Promise<void>(resolve => {
    release = resolve
  })
  workflowConfigurationTails.set(runId, tail)
  await previous
  try {
    return await operation()
  } finally {
    release()
    if (workflowConfigurationTails.get(runId) === tail) {
      workflowConfigurationTails.delete(runId)
    }
  }
}

export type WorkflowLaunchHost = {
  toolUseContext: ToolUseContext
  canUseTool: CanUseToolFn
}

export type WorkflowLaunchResult = {
  runId: string
  taskId: string
  outputFile: string
  workflowFile: string
}

function workflowFile(run: WorkflowRun): string {
  return join(getWorkflowRunsDir(run.projectRoot), `${run.runId}.jsonl`)
}

function appendProgress(taskId: string, line: string): void {
  appendTaskOutput(taskId, `[${new Date().toISOString()}] ${line}\n`)
}

function finalOutput(run: WorkflowRun): string {
  const leafIds = run.spec.steps
    .filter(
      candidate =>
        !run.spec.steps.some(step => step.dependsOn.includes(candidate.id)),
    )
    .map(step => step.id)
  const sections = leafIds.flatMap(id => {
    const step = run.steps[id]
    if (!step?.output) return []
    return [`## ${id}\n${step.output}`]
  })
  return sections.join('\n\n').slice(0, 100_000)
}

function notifyWorkflowFinished(
  taskId: string,
  run: WorkflowRun,
  context: ToolUseContext,
): void {
  if (!markWorkflowTaskNotified(taskId, context.setAppState)) return
  const status =
    run.status === 'completed'
      ? 'completed'
      : run.status === 'cancelled'
        ? 'killed'
        : 'failed'
  const toolUseIdLine = context.toolUseId
    ? `\n<${TOOL_USE_ID_TAG}>${context.toolUseId}</${TOOL_USE_ID_TAG}>`
    : ''
  const summary = escapeXml(
    run.status === 'completed'
      ? `Workflow "${run.spec.name}" completed`
      : run.status === 'budget_limited'
        ? `Workflow "${run.spec.name}" reached its token budget: ${run.error ?? 'budget exhausted'}`
        : `Workflow "${run.spec.name}" ${status}: ${run.error ?? 'unknown error'}`,
  )
  enqueuePendingNotification({
    value: `<${TASK_NOTIFICATION_TAG}>
<${TASK_ID_TAG}>${taskId}</${TASK_ID_TAG}>${toolUseIdLine}
<${OUTPUT_FILE_TAG}>${getTaskOutputPath(taskId)}</${OUTPUT_FILE_TAG}>
<${STATUS_TAG}>${status}</${STATUS_TAG}>
<${SUMMARY_TAG}>${summary}</${SUMMARY_TAG}>
<workflow_run_id>${run.runId}</workflow_run_id>
</${TASK_NOTIFICATION_TAG}>`,
    mode: 'task-notification',
  })
}

async function runDetachedWorkflow(
  run: WorkflowRun,
  taskId: string,
  controller: AbortController,
  host: WorkflowLaunchHost,
  schedulerSignal: WorkflowSchedulerSignal,
): Promise<void> {
  const persistWorktreeRecord = async (
    activeRun: WorkflowRun,
    stepId: string,
    record: WorkflowStepWorktree,
  ): Promise<void> => {
    const current = activeRun.steps[stepId]
    if (!current) throw new Error(`Workflow step state not found: ${stepId}`)
    const worktrees = [...(current.worktrees ?? [])]
    const existingIndex = worktrees.findIndex(item => item.slug === record.slug)
    if (existingIndex === -1) worktrees.push(structuredClone(record))
    else worktrees[existingIndex] = structuredClone(record)
    const next = { ...current, worktrees }
    activeRun.steps[stepId] = next
    activeRun.updatedAt = Date.now()
    await appendWorkflowEvent(activeRun, {
      type: 'step_updated',
      step: structuredClone(next),
    })
    setWorkflowRun(activeRun)
    syncWorkflowTask(taskId, activeRun, host.toolUseContext.setAppState)
  }

  try {
    await executeWorkflow(run, {
      signal: controller.signal,
      schedulerSignal,
      async runStep({
        run: activeRun,
        step,
        dependencyOutputs,
        dependencyResults,
        signal,
      }) {
        try {
          const executeStep = async (
            workingDirectory?: string,
            worktreePath?: string,
          ) =>
            agentStepOverride
              ? await agentStepOverride({
                  run: activeRun,
                  step,
                  dependencyOutputs,
                  dependencyResults,
                  workingDirectory,
                  worktreePath,
                  signal,
                })
              : await runWorkflowAgentStep({
                  run: activeRun,
                  step,
                  dependencyResults,
                  workingDirectory,
                  worktreePath,
                  signal,
                  host,
                })

          return step.isolation === 'worktree'
            ? await runWorkflowStepInWorktree({
                run: activeRun,
                step,
                onUpdate: record =>
                  persistWorktreeRecord(activeRun, step.id, record),
                execute: async (workingDirectory, worktreePath) =>
                  normalizeWorkflowStepExecutionResult(
                    step,
                    await executeStep(workingDirectory, worktreePath),
                  ),
              })
            : await executeStep()
        } catch (error) {
          const action = consumeWorkflowStepAction(activeRun.runId, step.id)
          const metrics = workflowErrorMetrics(error)
          if (action === 'skip')
            throw new WorkflowStepSkippedError(undefined, metrics)
          if (action === 'retry')
            throw new WorkflowStepRetryError(undefined, metrics)
          throw error
        }
      },
      onStepController(stepId, stepController) {
        setWorkflowStepController(run.runId, stepId, stepController)
      },
      async onEvent(event, activeRun) {
        await appendWorkflowEvent(activeRun, event)
        setWorkflowRun(activeRun)
        const isTerminalUpdate =
          event.type === 'run_updated' &&
          (event.status === 'completed' ||
            event.status === 'failed' ||
            event.status === 'budget_limited' ||
            event.status === 'cancelled')
        // Keep the task running until its terminal notification is queued.
        // Headless mode waits on running tasks; publishing terminal state first
        // leaves a race where the process can exit during output finalization.
        if (!isTerminalUpdate) {
          syncWorkflowTask(taskId, activeRun, host.toolUseContext.setAppState)
        }
        if (event.type === 'step_updated') {
          const step = event.step
          appendProgress(
            taskId,
            `${step.id}: ${step.status}${step.error ? ` (${step.error})` : ''}`,
          )
        }
        emitTaskProgress({
          taskId,
          toolUseId: host.toolUseContext.toolUseId,
          description: activeRun.spec.objective,
          startTime: activeRun.createdAt,
          totalTokens: activeRun.totalTokens,
          toolUses: activeRun.totalToolUses,
          summary: `${Object.values(activeRun.steps).filter(step => step.status === 'completed').length}/${activeRun.spec.steps.length} workflow steps complete`,
        })
      },
    })
  } catch (error) {
    run.status = controller.signal.aborted ? 'cancelled' : 'failed'
    run.error = error instanceof Error ? error.message : String(error)
    run.completedAt = Date.now()
    run.updatedAt = run.completedAt
    try {
      await appendWorkflowEvent(run, {
        type: 'run_updated',
        status: run.status,
        updatedAt: run.updatedAt,
        completedAt: run.completedAt,
        resumeCount: run.resumeCount,
        totalTokens: run.totalTokens,
        totalToolUses: run.totalToolUses,
        estimatedCostUsd: run.estimatedCostUsd,
        hasUnknownCost: run.hasUnknownCost,
        error: run.error,
      })
    } catch (persistenceError) {
      logError(persistenceError)
    }
    try {
      setWorkflowRun(run)
    } catch (stateError) {
      logError(stateError)
    }
  } finally {
    try {
      appendProgress(taskId, `workflow ${run.status}`)
      const output = finalOutput(run)
      if (output) appendTaskOutput(taskId, `\n${output}\n`)
      await flushTaskOutput(taskId)
    } catch (outputError) {
      logError(outputError)
    }
    try {
      notifyWorkflowFinished(taskId, run, host.toolUseContext)
    } catch (notificationError) {
      logError(notificationError)
    }
    try {
      syncWorkflowTask(taskId, run, host.toolUseContext.setAppState)
    } catch (stateError) {
      logError(stateError)
    } finally {
      unregisterWorkflowControl(run.runId)
      releaseWorkflowWorktreeRun(run.runId)
      schedulerSignal.clear()
      if (activeWorkflowRuntimes.get(run.runId)?.run === run) {
        activeWorkflowRuntimes.delete(run.runId)
      }
    }
  }
}

async function startRun(
  run: WorkflowRun,
  host: WorkflowLaunchHost,
): Promise<WorkflowLaunchResult> {
  const controller = new AbortController()
  const schedulerSignal = new WorkflowSchedulerSignal()
  const file = workflowFile(run)
  const taskId = registerLocalWorkflowTask(host.toolUseContext.setAppState, {
    run,
    workflowFile: file,
    toolUseId: host.toolUseContext.toolUseId,
    abortController: controller,
  })
  registerWorkflowControl(run.runId, taskId, controller)
  activeWorkflowRuntimes.set(run.runId, {
    run,
    taskId,
    host,
    schedulerSignal,
  })
  setWorkflowRun(run)
  appendProgress(taskId, `workflow ${run.spec.name} started`)
  void runDetachedWorkflow(
    run,
    taskId,
    controller,
    host,
    schedulerSignal,
  ).catch(logError)
  return {
    runId: run.runId,
    taskId,
    outputFile: getTaskOutputPath(taskId),
    workflowFile: file,
  }
}

export async function launchWorkflow(
  specInput: unknown,
  host: WorkflowLaunchHost,
): Promise<WorkflowLaunchResult> {
  const spec: WorkflowSpec = validateWorkflowSpec(specInput)
  const run = createWorkflowRun({
    spec,
    sessionId: getSessionId(),
    projectRoot: getCwd(),
  })
  await initializeWorkflowJournal(run)
  return startRun(run, host)
}

export type WorkflowRunConfiguration = {
  maxConcurrency?: number
  tokenBudget?: number | null
}

export async function configureWorkflowRun(
  runId: string,
  configuration: WorkflowRunConfiguration,
): Promise<WorkflowRun> {
  const hasConcurrency = configuration.maxConcurrency !== undefined
  const hasTokenBudget = Object.hasOwn(configuration, 'tokenBudget')
  if (!hasConcurrency && !hasTokenBudget) {
    throw new Error('Workflow configuration did not include any changes')
  }
  if (
    hasConcurrency &&
    (!Number.isSafeInteger(configuration.maxConcurrency) ||
      configuration.maxConcurrency! < 1 ||
      configuration.maxConcurrency! > MAX_WORKFLOW_CONCURRENCY)
  ) {
    throw new Error(
      `Workflow concurrency must be an integer from 1 to ${MAX_WORKFLOW_CONCURRENCY}`,
    )
  }
  if (
    hasTokenBudget &&
    configuration.tokenBudget !== null &&
    (!Number.isSafeInteger(configuration.tokenBudget) ||
      configuration.tokenBudget! < 1 ||
      configuration.tokenBudget! > MAX_TOKEN_BUDGET)
  ) {
    throw new Error(
      `Workflow token budget must be null or an integer from 1 to ${MAX_TOKEN_BUDGET}`,
    )
  }

  return withWorkflowConfigurationLock(runId, async () => {
    const runtime = activeWorkflowRuntimes.get(runId)
    const run =
      runtime?.run ?? (await loadWorkflowRun(getCwd(), runId)) ?? undefined
    if (!run) throw new Error(`Workflow run not found: ${runId}`)
    if (run.status === 'completed') {
      throw new Error('Completed workflows cannot be reconfigured')
    }

    const concurrencyLimit = hasConcurrency
      ? configuration.maxConcurrency!
      : run.concurrencyLimit
    const tokenBudget = hasTokenBudget
      ? (configuration.tokenBudget ?? null)
      : run.tokenBudget
    const updatedAt = Date.now()
    await appendWorkflowEvent(run, {
      type: 'run_configured',
      updatedAt,
      concurrencyLimit,
      tokenBudget,
    })
    run.concurrencyLimit = concurrencyLimit
    run.tokenBudget = tokenBudget
    run.updatedAt = updatedAt
    setWorkflowRun(run)
    if (runtime) {
      runtime.schedulerSignal.notify()
      syncWorkflowTask(
        runtime.taskId,
        run,
        runtime.host.toolUseContext.setAppState,
      )
    }
    return structuredClone(run)
  })
}

export async function resumeWorkflow(
  runId: string,
  host: WorkflowLaunchHost,
): Promise<WorkflowLaunchResult> {
  const projectRoot = getCwd()
  if (isWorkflowRunActive(runId)) {
    throw new Error('Workflow is already running')
  }
  const previous = await loadWorkflowRun(projectRoot, runId)
  if (!previous) throw new Error(`Workflow run not found: ${runId}`)
  await recoverWorkflowWorktrees({
    run: previous,
    async onUpdate(stepId, record, recoveredResult) {
      const current = previous.steps[stepId]
      if (!current) return
      const worktrees = [...(current.worktrees ?? [])]
      const index = worktrees.findIndex(item => item.slug === record.slug)
      if (index === -1) worktrees.push(structuredClone(record))
      else worktrees[index] = structuredClone(record)
      const next = recoveredResult
        ? {
            ...applyWorkflowAttemptMetrics(current, recoveredResult),
            status: 'completed' as const,
            completedAt: record.completedAt ?? Date.now(),
            output: recoveredResult.output,
            ...(recoveredResult.structuredOutput === undefined
              ? { structuredOutput: undefined }
              : {
                  structuredOutput: structuredClone(
                    recoveredResult.structuredOutput,
                  ),
                }),
            error: undefined,
            worktrees,
          }
        : { ...current, worktrees }
      previous.steps[stepId] = next
      previous.updatedAt = Date.now()
      await appendWorkflowEvent(previous, {
        type: 'step_updated',
        step: structuredClone(next),
      })
      setWorkflowRun(previous)
    },
  })
  const resumed = prepareWorkflowRunForResume(previous)
  for (const step of resumed.spec.steps) {
    if (previous.steps[step.id]?.status === 'completed') continue
    await appendWorkflowEvent(resumed, {
      type: 'step_updated',
      step: structuredClone(resumed.steps[step.id]!),
    })
  }
  await appendWorkflowEvent(resumed, {
    type: 'run_updated',
    status: resumed.status,
    updatedAt: resumed.updatedAt,
    resumeCount: resumed.resumeCount,
    totalTokens: resumed.totalTokens,
    totalToolUses: resumed.totalToolUses,
    estimatedCostUsd: resumed.estimatedCostUsd,
    hasUnknownCost: resumed.hasUnknownCost,
  })
  setWorkflowRun(resumed)
  return startRun(resumed, host)
}

export function stopWorkflow(runOrTaskId: string): boolean {
  return cancelWorkflowRun(runOrTaskId)
}

export function _setWorkflowStepRunnerForTesting(
  runner?: WorkflowStepRunner,
): void {
  agentStepOverride = runner ?? null
}
