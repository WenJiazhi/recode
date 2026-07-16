import {
  createTaskStateBase,
  generateTaskId,
  type SetAppState,
  type Task,
  type TaskStateBase,
} from '../../Task.js'
import {
  cancelWorkflowRun,
  requestWorkflowStepAction,
} from '../../services/workflow/control.js'
import type {
  WorkflowRun,
  WorkflowStep,
  WorkflowStepState,
} from '../../services/workflow/types.js'
import { registerTask, updateTaskState } from '../../utils/task/framework.js'

export type WorkflowTaskStepDefinition = Pick<
  WorkflowStep,
  'id' | 'title' | 'phase' | 'mode' | 'isolation'
>

function getStepDefinitions(run: WorkflowRun): WorkflowTaskStepDefinition[] {
  return run.spec.steps.map(step => ({
    id: step.id,
    title: step.title,
    mode: step.mode,
    ...(step.phase === undefined ? {} : { phase: step.phase }),
    ...(step.isolation === undefined ? {} : { isolation: step.isolation }),
  }))
}

export type LocalWorkflowTaskState = TaskStateBase & {
  type: 'local_workflow'
  runId: string
  workflowName: string
  workflowFile: string
  summary?: string
  agentCount: number
  completedCount: number
  failedCount: number
  concurrencyLimit: number
  tokenBudget: number | null
  totalTokens: number
  totalToolUses: number
  estimatedCostUsd: number
  hasUnknownCost: boolean
  /** Immutable display metadata kept beside the live step states. */
  stepDefinitions: WorkflowTaskStepDefinition[]
  steps: Record<string, WorkflowStepState>
  output?: string
  error?: string
  abortController?: AbortController
}

export function registerLocalWorkflowTask(
  setAppState: SetAppState,
  input: {
    run: WorkflowRun
    workflowFile: string
    toolUseId?: string
    abortController: AbortController
  },
): string {
  const id = generateTaskId('local_workflow')
  const task: LocalWorkflowTaskState = {
    ...createTaskStateBase(
      id,
      'local_workflow',
      input.run.spec.objective,
      input.toolUseId,
    ),
    type: 'local_workflow',
    status: 'running',
    runId: input.run.runId,
    workflowName: input.run.spec.name,
    workflowFile: input.workflowFile,
    summary: input.run.spec.objective,
    agentCount: input.run.spec.steps.length,
    completedCount: 0,
    failedCount: 0,
    concurrencyLimit: input.run.concurrencyLimit,
    tokenBudget: input.run.tokenBudget,
    totalTokens: input.run.totalTokens,
    totalToolUses: input.run.totalToolUses,
    estimatedCostUsd: input.run.estimatedCostUsd,
    hasUnknownCost: input.run.hasUnknownCost,
    stepDefinitions: getStepDefinitions(input.run),
    steps: structuredClone(input.run.steps),
    abortController: input.abortController,
  }
  registerTask(task, setAppState)
  return id
}

export function syncWorkflowTask(
  taskId: string,
  run: WorkflowRun,
  setAppState: SetAppState,
): void {
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task => {
    const terminal =
      run.status === 'completed' ||
      run.status === 'failed' ||
      run.status === 'budget_limited' ||
      run.status === 'cancelled'
    return {
      ...task,
      status:
        run.status === 'completed'
          ? 'completed'
          : run.status === 'failed'
            ? 'failed'
            : run.status === 'budget_limited'
              ? 'failed'
              : run.status === 'cancelled'
                ? 'killed'
                : 'running',
      endTime: terminal ? run.completedAt : undefined,
      completedCount: Object.values(run.steps).filter(
        step => step.status === 'completed',
      ).length,
      failedCount: Object.values(run.steps).filter(
        step => step.status === 'failed' || step.status === 'skipped',
      ).length,
      concurrencyLimit: run.concurrencyLimit,
      tokenBudget: run.tokenBudget,
      totalTokens: run.totalTokens,
      totalToolUses: run.totalToolUses,
      estimatedCostUsd: run.estimatedCostUsd,
      hasUnknownCost: run.hasUnknownCost,
      stepDefinitions: getStepDefinitions(run),
      steps: structuredClone(run.steps),
      error: run.error,
      abortController: terminal ? undefined : task.abortController,
    }
  })
}

export function markWorkflowTaskNotified(
  taskId: string,
  setAppState: SetAppState,
): boolean {
  let shouldNotify = false
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task => {
    if (task.notified) return task
    shouldNotify = true
    return { ...task, notified: true }
  })
  return shouldNotify
}

export function killWorkflowTask(
  taskId: string,
  setAppState: SetAppState,
): void {
  if (cancelWorkflowRun(taskId)) return
  updateTaskState<LocalWorkflowTaskState>(taskId, setAppState, task =>
    task.status === 'running'
      ? {
          ...task,
          status: 'killed',
          endTime: Date.now(),
          error: 'Workflow cancelled',
          abortController: undefined,
        }
      : task,
  )
}

export function skipWorkflowStep(
  taskId: string,
  stepId: string,
  _setAppState: SetAppState,
): void {
  requestWorkflowStepAction(taskId, stepId, 'skip')
}

export function retryWorkflowStep(
  taskId: string,
  stepId: string,
  _setAppState: SetAppState,
): void {
  requestWorkflowStepAction(taskId, stepId, 'retry')
}

export const LocalWorkflowTask: Task = {
  name: 'LocalWorkflowTask',
  type: 'local_workflow',
  async kill(taskId, setAppState) {
    killWorkflowTask(taskId, setAppState)
  },
}
