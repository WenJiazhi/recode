import { randomUUID } from 'crypto'
import type {
  WorkflowAttemptMetrics,
  WorkflowEngineEvent,
  WorkflowDependencyResult,
  WorkflowRun,
  WorkflowSpec,
  WorkflowStep,
  WorkflowStepExecutionResult,
  WorkflowStepState,
} from './types.js'
import { WORKFLOW_SCHEMA_VERSION } from './types.js'
import { validateWorkflowStructuredOutput } from './structuredOutput.js'
import {
  WorkflowStepRetryError,
  WorkflowStepSkippedError,
  workflowErrorMetrics,
} from './errors.js'
import type { WorkflowSchedulerSignal } from './runtime.js'
import {
  addWorkflowUsage,
  normalizeWorkflowAttemptMetrics,
  workflowTokenUsageTotal,
} from './usage.js'

export { WorkflowStepRetryError, WorkflowStepSkippedError } from './errors.js'

export type WorkflowStepRunner = (input: {
  run: WorkflowRun
  step: WorkflowStep
  dependencyOutputs: Record<string, string>
  dependencyResults: Record<string, WorkflowDependencyResult>
  workingDirectory?: string
  worktreePath?: string
  signal: AbortSignal
}) => Promise<WorkflowStepExecutionResult>

export type WorkflowEngineOptions = {
  signal: AbortSignal
  runStep: WorkflowStepRunner
  onEvent?: (
    event: WorkflowEngineEvent,
    run: WorkflowRun,
  ) => Promise<void> | void
  onStepController?: (
    stepId: string,
    controller: AbortController | null,
  ) => void
  schedulerSignal?: WorkflowSchedulerSignal
  now?: () => number
}

function cloneStepState(step: WorkflowStepState): WorkflowStepState {
  return structuredClone(step)
}

export function normalizeWorkflowStepExecutionResult(
  step: WorkflowStep,
  result: WorkflowStepExecutionResult,
): WorkflowStepExecutionResult {
  const normalizedResult = {
    ...result,
    ...normalizeWorkflowAttemptMetrics(result),
  }
  if (!step.outputSchema) return normalizedResult
  if (normalizedResult.structuredOutput === undefined) {
    throw new Error(
      `Step ${step.id} did not return the required structured output`,
    )
  }
  const validated = validateWorkflowStructuredOutput(
    step.outputSchema,
    normalizedResult.structuredOutput,
  )
  if ('issues' in validated) {
    throw new Error(
      `Step ${step.id} structured output failed validation: ${validated.issues.join('; ')}`,
    )
  }
  return {
    ...normalizedResult,
    output: validated.output,
    structuredOutput: validated.value,
  }
}

function runEvent(run: WorkflowRun): WorkflowEngineEvent {
  return {
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
  }
}

async function emit(
  options: WorkflowEngineOptions,
  event: WorkflowEngineEvent,
  run: WorkflowRun,
): Promise<void> {
  await options.onEvent?.(event, run)
}

export function createWorkflowRun(input: {
  spec: WorkflowSpec
  sessionId: string
  projectRoot: string
  runId?: string
  now?: number
}): WorkflowRun {
  const now = input.now ?? Date.now()
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    runId: input.runId ?? randomUUID(),
    sessionId: input.sessionId,
    projectRoot: input.projectRoot,
    spec: input.spec,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    resumeCount: 0,
    concurrencyLimit: input.spec.maxConcurrency,
    tokenBudget: input.spec.tokenBudget,
    totalTokens: 0,
    totalToolUses: 0,
    estimatedCostUsd: 0,
    hasUnknownCost: false,
    steps: Object.fromEntries(
      input.spec.steps.map(step => [
        step.id,
        {
          id: step.id,
          status: 'pending',
          attempts: 0,
          tokens: 0,
          toolUses: 0,
        } satisfies WorkflowStepState,
      ]),
    ),
  }
}

export function prepareWorkflowRunForResume(
  previous: WorkflowRun,
  now = Date.now(),
): WorkflowRun {
  if (previous.status === 'completed') {
    throw new Error('Completed workflows do not need to be resumed')
  }
  const steps = Object.fromEntries(
    Object.entries(previous.steps).map(([id, step]) => [
      id,
      step.status === 'completed'
        ? cloneStepState(step)
        : {
            id,
            status: 'pending' as const,
            attempts: 0,
            tokens: step.tokens,
            toolUses: step.toolUses,
            ...(step.usage === undefined
              ? {}
              : { usage: structuredClone(step.usage) }),
            ...(step.models === undefined ? {} : { models: [...step.models] }),
            ...(step.estimatedCostUsd === undefined
              ? {}
              : { estimatedCostUsd: step.estimatedCostUsd }),
            ...(step.hasUnknownCost === undefined
              ? {}
              : { hasUnknownCost: step.hasUnknownCost }),
            ...(step.worktrees === undefined
              ? {}
              : { worktrees: structuredClone(step.worktrees) }),
          },
    ]),
  )
  return {
    ...previous,
    status: 'pending',
    updatedAt: now,
    completedAt: undefined,
    resumeCount: previous.resumeCount + 1,
    totalTokens: Object.values(steps).reduce(
      (total, step) => total + step.tokens,
      0,
    ),
    totalToolUses: Object.values(steps).reduce(
      (total, step) => total + step.toolUses,
      0,
    ),
    estimatedCostUsd: Object.values(steps).reduce(
      (total, step) => total + (step.estimatedCostUsd ?? 0),
      0,
    ),
    hasUnknownCost: Object.values(steps).some(
      step => step.hasUnknownCost === true,
    ),
    error: undefined,
    steps,
  }
}

function isDependencyFailure(status: WorkflowStepState['status']): boolean {
  return status === 'failed' || status === 'skipped' || status === 'cancelled'
}

function getReadySteps(run: WorkflowRun): WorkflowStep[] {
  return run.spec.steps.filter(step => {
    if (run.steps[step.id]?.status !== 'pending') return false
    return step.dependsOn.every(
      dependency => run.steps[dependency]?.status === 'completed',
    )
  })
}

async function markBlockedSteps(
  run: WorkflowRun,
  options: WorkflowEngineOptions,
  now: number,
): Promise<boolean> {
  let changed = false
  for (const step of run.spec.steps) {
    const state = run.steps[step.id]
    if (!state || state.status !== 'pending') continue
    const failedDependency = step.dependsOn.find(dependency =>
      isDependencyFailure(run.steps[dependency]?.status ?? 'failed'),
    )
    if (!failedDependency) continue
    const next: WorkflowStepState = {
      ...state,
      status: 'skipped',
      completedAt: now,
      error: `Dependency ${failedDependency} did not complete`,
    }
    run.steps[step.id] = next
    run.updatedAt = now
    changed = true
    await emit(
      options,
      { type: 'step_updated', step: cloneStepState(next) },
      run,
    )
  }
  return changed
}

type SettledStep =
  | { id: string; kind: 'completed'; result: WorkflowStepExecutionResult }
  | {
      id: string
      kind: 'failed' | 'skipped' | 'retry' | 'cancelled'
      error: Error
      metrics?: WorkflowAttemptMetrics
    }

function startStep(
  run: WorkflowRun,
  step: WorkflowStep,
  options: WorkflowEngineOptions,
): Promise<SettledStep> {
  const controller = new AbortController()
  const onRunAbort = (): void => controller.abort()
  if (options.signal.aborted) controller.abort()
  else options.signal.addEventListener('abort', onRunAbort, { once: true })
  options.onStepController?.(step.id, controller)

  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, step.timeoutMs)

  const dependencyResults = Object.fromEntries(
    step.dependsOn.map(id => {
      const state = run.steps[id]
      return [
        id,
        {
          output: state?.output ?? '',
          ...(state?.structuredOutput === undefined
            ? {}
            : { structuredOutput: structuredClone(state.structuredOutput) }),
        } satisfies WorkflowDependencyResult,
      ]
    }),
  )
  const dependencyOutputs = Object.fromEntries(
    Object.entries(dependencyResults).map(([id, result]) => [
      id,
      result.output,
    ]),
  )

  const classifyFailure = (
    value: unknown,
    metrics = workflowErrorMetrics(value),
  ): SettledStep => {
    const error = value instanceof Error ? value : new Error(String(value))
    if (error instanceof WorkflowStepSkippedError) {
      return { id: step.id, kind: 'skipped', error, metrics }
    }
    if (error instanceof WorkflowStepRetryError) {
      return { id: step.id, kind: 'retry', error, metrics }
    }
    if (options.signal.aborted) {
      return { id: step.id, kind: 'cancelled', error, metrics }
    }
    if (timedOut) {
      return {
        id: step.id,
        kind: 'failed',
        error: new Error(`Step timed out after ${step.timeoutMs}ms`, {
          cause: error,
        }),
        metrics,
      }
    }
    return { id: step.id, kind: 'failed', error, metrics }
  }

  return Promise.resolve()
    .then(() =>
      options.runStep({
        run,
        step,
        dependencyOutputs,
        dependencyResults,
        signal: controller.signal,
      }),
    )
    .then((result): SettledStep => {
      try {
        return {
          id: step.id,
          kind: 'completed',
          result: normalizeWorkflowStepExecutionResult(step, result),
        }
      } catch (error) {
        return classifyFailure(error, result)
      }
    })
    .catch((value: unknown): SettledStep => classifyFailure(value))
    .finally(() => {
      clearTimeout(timeout)
      options.signal.removeEventListener('abort', onRunAbort)
      options.onStepController?.(step.id, null)
    })
}

function safeMetricAdd(left: number, right: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, left + right)
}

export function applyWorkflowAttemptMetrics(
  state: WorkflowStepState,
  metrics: WorkflowAttemptMetrics | undefined,
): WorkflowStepState {
  if (!metrics) return state
  const normalized = normalizeWorkflowAttemptMetrics(metrics)
  const models = new Set(state.models ?? [])
  if (normalized.model) models.add(normalized.model)
  const canPreserveUsage =
    (state.tokens === 0 || state.usage !== undefined) &&
    (normalized.tokens === 0 || normalized.usage !== undefined)
  const usage = canPreserveUsage
    ? addWorkflowUsage(state.usage, normalized.usage)
    : undefined
  const modelHistory = [...models].slice(-16)
  const estimatedCost = safeMetricAdd(
    state.estimatedCostUsd ?? 0,
    normalized.estimatedCostUsd ?? 0,
  )
  return {
    ...state,
    tokens: usage
      ? workflowTokenUsageTotal(usage)
      : safeMetricAdd(state.tokens, normalized.tokens),
    toolUses: safeMetricAdd(state.toolUses, normalized.toolUses),
    ...(usage === undefined ? {} : { usage }),
    ...(modelHistory.length === 0 ? {} : { models: modelHistory }),
    estimatedCostUsd: estimatedCost,
    hasUnknownCost:
      (state.hasUnknownCost ?? state.tokens > 0) ||
      normalized.hasUnknownCost === true,
  }
}

function updateRunMetrics(run: WorkflowRun): void {
  run.totalTokens = Object.values(run.steps).reduce(
    (total, step) => total + step.tokens,
    0,
  )
  run.totalToolUses = Object.values(run.steps).reduce(
    (total, step) => total + step.toolUses,
    0,
  )
  run.estimatedCostUsd = Object.values(run.steps).reduce(
    (total, step) => total + (step.estimatedCostUsd ?? 0),
    0,
  )
  run.hasUnknownCost = Object.values(run.steps).some(
    step => step.hasUnknownCost === true,
  )
}

function tokenBudgetReached(run: WorkflowRun): boolean {
  return run.tokenBudget !== null && run.totalTokens >= run.tokenBudget
}

export async function executeWorkflow(
  run: WorkflowRun,
  options: WorkflowEngineOptions,
): Promise<WorkflowRun> {
  const now = options.now ?? Date.now
  run.status = 'running'
  run.updatedAt = now()
  run.error = undefined
  await emit(options, runEvent(run), run)

  const running = new Map<string, Promise<SettledStep>>()

  while (true) {
    if (options.signal.aborted && running.size === 0) break
    await markBlockedSteps(run, options, now())

    for (const step of getReadySteps(run)) {
      if (
        running.size >= run.concurrencyLimit ||
        options.signal.aborted ||
        tokenBudgetReached(run)
      ) {
        break
      }
      const state = run.steps[step.id]!
      const next: WorkflowStepState = {
        ...state,
        status: 'running',
        attempts: state.attempts + 1,
        startedAt: now(),
        completedAt: undefined,
        error: undefined,
      }
      run.steps[step.id] = next
      run.updatedAt = next.startedAt!
      await emit(
        options,
        { type: 'step_updated', step: cloneStepState(next) },
        run,
      )
      running.set(step.id, startStep(run, step, options))
    }

    if (running.size === 0) {
      const pending = Object.values(run.steps).some(
        step => step.status === 'pending',
      )
      if (!pending || options.signal.aborted) break
      if (tokenBudgetReached(run)) break
      run.error = 'Workflow scheduler reached an invalid dependency state'
      break
    }

    let settled: SettledStep
    if (options.schedulerSignal && !options.signal.aborted) {
      const waiter = options.schedulerSignal.wait(options.signal)
      const outcome = await Promise.race([
        Promise.race(running.values()).then(stepResult => ({
          type: 'step' as const,
          stepResult,
        })),
        waiter.promise.then(() => ({ type: 'schedule' as const })),
      ])
      waiter.cancel()
      if (outcome.type === 'schedule') continue
      settled = outcome.stepResult
    } else {
      settled = await Promise.race(running.values())
    }
    running.delete(settled.id)
    const currentState = run.steps[settled.id]!
    const state = applyWorkflowAttemptMetrics(
      currentState,
      settled.kind === 'completed' ? settled.result : settled.metrics,
    )
    const completedAt = now()
    let next: WorkflowStepState

    if (settled.kind === 'completed') {
      next = {
        ...state,
        status: 'completed',
        completedAt,
        output: settled.result.output,
        ...(settled.result.structuredOutput === undefined
          ? {}
          : {
              structuredOutput: structuredClone(
                settled.result.structuredOutput,
              ),
            }),
        error: undefined,
      }
    } else if (settled.kind === 'retry') {
      next = {
        id: state.id,
        status: 'pending',
        attempts: Math.max(0, state.attempts - 1),
        tokens: state.tokens,
        toolUses: state.toolUses,
        ...(state.usage === undefined
          ? {}
          : { usage: structuredClone(state.usage) }),
        ...(state.models === undefined ? {} : { models: [...state.models] }),
        ...(state.estimatedCostUsd === undefined
          ? {}
          : { estimatedCostUsd: state.estimatedCostUsd }),
        ...(state.hasUnknownCost === undefined
          ? {}
          : { hasUnknownCost: state.hasUnknownCost }),
        ...(state.worktrees === undefined
          ? {}
          : { worktrees: structuredClone(state.worktrees) }),
      }
    } else if (settled.kind === 'skipped') {
      next = {
        ...state,
        status: 'skipped',
        completedAt,
        error: settled.error.message,
      }
    } else if (settled.kind === 'cancelled') {
      next = {
        ...state,
        status: 'cancelled',
        completedAt,
        error: settled.error.message,
      }
    } else if (
      state.attempts < run.spec.steps.find(s => s.id === state.id)!.maxAttempts
    ) {
      next = {
        id: state.id,
        status: 'pending',
        attempts: state.attempts,
        tokens: state.tokens,
        toolUses: state.toolUses,
        ...(state.usage === undefined
          ? {}
          : { usage: structuredClone(state.usage) }),
        ...(state.models === undefined ? {} : { models: [...state.models] }),
        ...(state.estimatedCostUsd === undefined
          ? {}
          : { estimatedCostUsd: state.estimatedCostUsd }),
        ...(state.hasUnknownCost === undefined
          ? {}
          : { hasUnknownCost: state.hasUnknownCost }),
        error: settled.error.message,
        ...(state.worktrees === undefined
          ? {}
          : { worktrees: structuredClone(state.worktrees) }),
      }
    } else {
      next = {
        ...state,
        status: 'failed',
        completedAt,
        error: settled.error.message,
      }
    }

    run.steps[settled.id] = next
    updateRunMetrics(run)
    run.updatedAt = completedAt
    await emit(
      options,
      { type: 'step_updated', step: cloneStepState(next) },
      run,
    )
  }

  const terminalAt = now()
  if (options.signal.aborted) {
    for (const state of Object.values(run.steps)) {
      if (state.status !== 'pending') continue
      const next: WorkflowStepState = {
        ...state,
        status: 'cancelled',
        completedAt: terminalAt,
        error: 'Workflow cancelled',
      }
      run.steps[state.id] = next
      await emit(
        options,
        { type: 'step_updated', step: cloneStepState(next) },
        run,
      )
    }
    run.status = 'cancelled'
    run.error = 'Workflow cancelled'
  } else if (
    run.error ||
    Object.values(run.steps).some(
      step =>
        step.status === 'failed' ||
        step.status === 'skipped' ||
        step.status === 'cancelled',
    )
  ) {
    run.status = 'failed'
    run.error ??= 'One or more workflow steps did not complete'
  } else if (
    tokenBudgetReached(run) &&
    Object.values(run.steps).some(step => step.status !== 'completed')
  ) {
    run.status = 'budget_limited'
    run.error = `Workflow token budget reached (${run.totalTokens} / ${run.tokenBudget} processed tokens)`
  } else {
    run.status = 'completed'
    run.error = undefined
  }
  run.completedAt = terminalAt
  run.updatedAt = terminalAt
  await emit(options, runEvent(run), run)
  return run
}
