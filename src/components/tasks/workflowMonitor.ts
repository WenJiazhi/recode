import type {
  LocalWorkflowTaskState,
  WorkflowTaskStepDefinition,
} from '../../tasks/LocalWorkflowTask/LocalWorkflowTask.js'
import type {
  WorkflowStepState,
  WorkflowStepWorktree,
} from '../../services/workflow/types.js'

export const UNPHASED_WORKFLOW_PHASE = 'Unphased'

export type WorkflowMonitorTab = 'overview' | 'phases'

export type WorkflowMonitorKey = {
  tab?: boolean
  return?: boolean
  leftArrow?: boolean
  upArrow?: boolean
  downArrow?: boolean
}

export type WorkflowMonitorKeyAction =
  | 'toggle_view'
  | 'previous_step'
  | 'next_step'
  | 'skip_step'
  | 'retry_step'
  | 'close'
  | 'back'
  | 'stop'

export type WorkflowMonitorStep = {
  id: string
  title: string
  phase: string
  mode: WorkflowTaskStepDefinition['mode']
  isolation?: WorkflowTaskStepDefinition['isolation']
  state: WorkflowStepState
}

export type WorkflowMonitorPhaseStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'attention'

export type WorkflowMonitorPhase = {
  title: string
  status: WorkflowMonitorPhaseStatus
  completed: number
  running: number
  attention: number
  total: number
  tokens: number
  toolUses: number
  estimatedCostUsd: number
  hasUnknownCost: boolean
  steps: WorkflowMonitorStep[]
}

export type WorkflowRetainedWorktree = {
  stepId: string
  stepTitle: string
  worktree: WorkflowStepWorktree
}

export type WorkflowMonitor = {
  steps: WorkflowMonitorStep[]
  phases: WorkflowMonitorPhase[]
  activeSteps: WorkflowMonitorStep[]
  attentionSteps: WorkflowMonitorStep[]
  retainedWorktrees: WorkflowRetainedWorktree[]
  completed: number
  running: number
  pending: number
  attention: number
}

export type WorkflowPhaseRow =
  | { kind: 'phase'; phase: WorkflowMonitorPhase }
  | {
      kind: 'step'
      phaseTitle: string
      step: WorkflowMonitorStep
    }

export type WorkflowRowWindow<T> = {
  items: T[]
  start: number
  hiddenBefore: number
  hiddenAfter: number
}

export function routeWorkflowMonitorKey(
  input: string,
  key: WorkflowMonitorKey,
  tab: WorkflowMonitorTab,
): WorkflowMonitorKeyAction | null {
  if (key.tab || input === '\t') return 'toggle_view'
  if (tab === 'phases' && key.upArrow) return 'previous_step'
  if (tab === 'phases' && key.downArrow) return 'next_step'
  if (tab === 'phases' && input === 's') return 'skip_step'
  if (tab === 'phases' && input === 'r') return 'retry_step'
  if (key.return) return 'close'
  if (key.leftArrow) return 'back'
  if (input === 'x') return 'stop'
  return null
}

function isAttentionStep(step: WorkflowStepState): boolean {
  return (
    step.status === 'failed' ||
    step.status === 'skipped' ||
    step.status === 'cancelled'
  )
}

function phaseStatus(steps: WorkflowMonitorStep[]): WorkflowMonitorPhaseStatus {
  if (steps.some(step => step.state.status === 'running')) return 'running'
  if (steps.some(step => isAttentionStep(step.state))) return 'attention'
  if (steps.every(step => step.state.status === 'completed')) return 'completed'
  return 'pending'
}

function fallbackDefinition(id: string): WorkflowTaskStepDefinition {
  return { id, title: id, mode: 'read' }
}

export function buildWorkflowMonitor(
  workflow: LocalWorkflowTaskState,
): WorkflowMonitor {
  const definitions = workflow.stepDefinitions ?? []
  const definitionsById = new Map(
    definitions.map(definition => [definition.id, definition]),
  )
  const orderedIds = definitions.map(definition => definition.id)
  for (const id of Object.keys(workflow.steps)) {
    if (!definitionsById.has(id)) orderedIds.push(id)
  }

  const steps = orderedIds.flatMap(id => {
    const state = workflow.steps[id]
    if (!state) return []
    const definition = definitionsById.get(id) ?? fallbackDefinition(id)
    return [
      {
        id,
        title: definition.title,
        phase: definition.phase ?? UNPHASED_WORKFLOW_PHASE,
        mode: definition.mode,
        ...(definition.isolation === undefined
          ? {}
          : { isolation: definition.isolation }),
        state,
      } satisfies WorkflowMonitorStep,
    ]
  })

  const phaseMap = new Map<string, WorkflowMonitorStep[]>()
  for (const step of steps) {
    const phaseSteps = phaseMap.get(step.phase)
    if (phaseSteps) phaseSteps.push(step)
    else phaseMap.set(step.phase, [step])
  }

  const phases = [...phaseMap].map(([title, phaseSteps]) => ({
    title,
    status: phaseStatus(phaseSteps),
    completed: phaseSteps.filter(step => step.state.status === 'completed')
      .length,
    running: phaseSteps.filter(step => step.state.status === 'running').length,
    attention: phaseSteps.filter(step => isAttentionStep(step.state)).length,
    total: phaseSteps.length,
    tokens: phaseSteps.reduce((total, step) => total + step.state.tokens, 0),
    toolUses: phaseSteps.reduce(
      (total, step) => total + step.state.toolUses,
      0,
    ),
    estimatedCostUsd: phaseSteps.reduce(
      (total, step) => total + (step.state.estimatedCostUsd ?? 0),
      0,
    ),
    hasUnknownCost: phaseSteps.some(step => step.state.hasUnknownCost === true),
    steps: phaseSteps,
  }))

  const activeSteps = steps.filter(step => step.state.status === 'running')
  const attentionSteps = steps.filter(step => isAttentionStep(step.state))
  const retainedWorktrees = steps.flatMap(step =>
    (step.state.worktrees ?? [])
      .filter(worktree => worktree.status === 'retained')
      .map(worktree => ({
        stepId: step.id,
        stepTitle: step.title,
        worktree,
      })),
  )

  return {
    steps,
    phases,
    activeSteps,
    attentionSteps,
    retainedWorktrees,
    completed: steps.filter(step => step.state.status === 'completed').length,
    running: activeSteps.length,
    pending: steps.filter(step => step.state.status === 'pending').length,
    attention: attentionSteps.length,
  }
}

export function buildWorkflowPhaseRows(
  monitor: WorkflowMonitor,
): WorkflowPhaseRow[] {
  return monitor.phases.flatMap(phase => [
    { kind: 'phase' as const, phase },
    ...phase.steps.map(step => ({
      kind: 'step' as const,
      phaseTitle: phase.title,
      step,
    })),
  ])
}

export function windowWorkflowRows<T>(
  items: T[],
  selectedIndex: number,
  limit: number,
): WorkflowRowWindow<T> {
  const safeLimit = Math.max(1, Math.trunc(limit))
  if (items.length <= safeLimit) {
    return { items, start: 0, hiddenBefore: 0, hiddenAfter: 0 }
  }
  const safeSelected = Math.max(
    0,
    Math.min(items.length - 1, Math.trunc(selectedIndex) || 0),
  )
  const start = Math.max(
    0,
    Math.min(
      items.length - safeLimit,
      safeSelected - Math.floor(safeLimit / 2),
    ),
  )
  const end = start + safeLimit
  return {
    items: items.slice(start, end),
    start,
    hiddenBefore: start,
    hiddenAfter: items.length - end,
  }
}
