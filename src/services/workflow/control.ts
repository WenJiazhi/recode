export type WorkflowStepAction = 'skip' | 'retry'

type ActiveWorkflowControl = {
  taskId: string
  runController: AbortController
  stepControllers: Map<string, AbortController>
  stepActions: Map<string, WorkflowStepAction>
}

const byRunId = new Map<string, ActiveWorkflowControl>()
const runIdByTaskId = new Map<string, string>()

export function registerWorkflowControl(
  runId: string,
  taskId: string,
  runController: AbortController,
): void {
  byRunId.set(runId, {
    taskId,
    runController,
    stepControllers: new Map(),
    stepActions: new Map(),
  })
  runIdByTaskId.set(taskId, runId)
}

export function setWorkflowStepController(
  runId: string,
  stepId: string,
  controller: AbortController | null,
): void {
  const control = byRunId.get(runId)
  if (!control) return
  if (controller) control.stepControllers.set(stepId, controller)
  else control.stepControllers.delete(stepId)
}

export function requestWorkflowStepAction(
  taskId: string,
  stepId: string,
  action: WorkflowStepAction,
): boolean {
  const runId = runIdByTaskId.get(taskId)
  const control = runId ? byRunId.get(runId) : undefined
  if (!control) return false
  const controller = control.stepControllers.get(stepId)
  if (!controller) return false
  control.stepActions.set(stepId, action)
  controller.abort()
  return true
}

export function consumeWorkflowStepAction(
  runId: string,
  stepId: string,
): WorkflowStepAction | null {
  const control = byRunId.get(runId)
  const action = control?.stepActions.get(stepId) ?? null
  control?.stepActions.delete(stepId)
  return action
}

export function cancelWorkflowRun(runOrTaskId: string): boolean {
  const runId = byRunId.has(runOrTaskId)
    ? runOrTaskId
    : runIdByTaskId.get(runOrTaskId)
  const control = runId ? byRunId.get(runId) : undefined
  if (!control) return false
  control.runController.abort()
  return true
}

export function isWorkflowRunActive(runOrTaskId: string): boolean {
  const runId = byRunId.has(runOrTaskId)
    ? runOrTaskId
    : runIdByTaskId.get(runOrTaskId)
  return runId ? byRunId.has(runId) : false
}

export function unregisterWorkflowControl(runId: string): void {
  const control = byRunId.get(runId)
  if (!control) return
  runIdByTaskId.delete(control.taskId)
  byRunId.delete(runId)
}

export function _clearWorkflowControlsForTesting(): void {
  for (const control of byRunId.values()) control.runController.abort()
  byRunId.clear()
  runIdByTaskId.clear()
}
