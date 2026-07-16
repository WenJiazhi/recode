import type { WorkflowAttemptMetrics } from './types.js'

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

export class WorkflowStepExecutionError extends Error {
  readonly metrics: WorkflowAttemptMetrics

  constructor(value: unknown, metrics: WorkflowAttemptMetrics) {
    const cause = asError(value)
    super(cause.message, { cause })
    this.name = 'WorkflowStepExecutionError'
    this.metrics = structuredClone(metrics)
  }
}

export class WorkflowStepSkippedError extends Error {
  constructor(
    message = 'Workflow step skipped by user',
    readonly metrics?: WorkflowAttemptMetrics,
  ) {
    super(message)
    this.name = 'WorkflowStepSkippedError'
  }
}

export class WorkflowStepRetryError extends Error {
  constructor(
    message = 'Workflow step retry requested by user',
    readonly metrics?: WorkflowAttemptMetrics,
  ) {
    super(message)
    this.name = 'WorkflowStepRetryError'
  }
}

export function workflowErrorMetrics(
  error: unknown,
): WorkflowAttemptMetrics | undefined {
  return error instanceof WorkflowStepExecutionError ||
    error instanceof WorkflowStepSkippedError ||
    error instanceof WorkflowStepRetryError
    ? error.metrics
    : undefined
}
