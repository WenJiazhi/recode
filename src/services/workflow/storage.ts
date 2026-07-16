import { appendFile, mkdir, readFile, readdir, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  WorkflowEngineEvent,
  WorkflowJournalEvent,
  WorkflowRun,
  WorkflowTokenUsage,
} from './types.js'
import { MAX_WORKFLOW_CONCURRENCY, validateWorkflowSpec } from './validation.js'
import { WORKFLOW_SCHEMA_VERSION } from './types.js'
import type { WorkflowStep, WorkflowStepWorktree } from './types.js'
import { validateWorkflowStructuredOutput } from './structuredOutput.js'
import { MAX_TOKEN_BUDGET } from '../../utils/tokenBudget.js'

const RUN_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const WORKFLOW_WORKTREE_SLUG_RE = /^wf_[0-9a-f]{8}-[0-9a-f]{3}-\d+$/
const GIT_OBJECT_ID_RE = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i
const writeQueues = new Map<string, Promise<void>>()
const RUN_STATUSES = new Set<WorkflowRun['status']>([
  'pending',
  'running',
  'completed',
  'failed',
  'budget_limited',
  'cancelled',
])
const STEP_STATUSES = new Set<WorkflowRun['steps'][string]['status']>([
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'cancelled',
])
const WORKTREE_STATUSES = new Set<WorkflowStepWorktree['status']>([
  'active',
  'merging',
  'merged',
  'cleaned',
  'retained',
])

export function getWorkflowRunsDir(projectRoot: string): string {
  return join(projectRoot, '.recode', 'workflow-runs')
}

function assertRunId(runId: string): void {
  if (!RUN_ID_RE.test(runId)) throw new Error('Invalid workflow run id')
}

function journalPath(projectRoot: string, runId: string): string {
  assertRunId(runId)
  return join(getWorkflowRunsDir(projectRoot), `${runId}.jsonl`)
}

function enqueueWrite(
  path: string,
  operation: () => Promise<void>,
): Promise<void> {
  const previous = writeQueues.get(path)
  const pending = (
    previous ? previous.catch(() => {}) : Promise.resolve()
  ).then(operation)
  writeQueues.set(path, pending)
  void pending
    .finally(() => {
      if (writeQueues.get(path) === pending) writeQueues.delete(path)
    })
    .catch(() => {})
  return pending
}

export async function initializeWorkflowJournal(
  run: WorkflowRun,
): Promise<void> {
  const dir = getWorkflowRunsDir(run.projectRoot)
  const path = journalPath(run.projectRoot, run.runId)
  await mkdir(dir, { recursive: true })
  const event: WorkflowJournalEvent = {
    type: 'run_created',
    timestamp: new Date().toISOString(),
    run,
  }
  await enqueueWrite(path, () =>
    writeFile(path, `${JSON.stringify(event)}\n`, { flag: 'wx' }),
  )
}

export async function appendWorkflowEvent(
  run: WorkflowRun,
  event: WorkflowEngineEvent,
): Promise<void> {
  const path = journalPath(run.projectRoot, run.runId)
  const persisted: WorkflowJournalEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  }
  await enqueueWrite(path, () =>
    appendFile(path, `${JSON.stringify(persisted)}\n`),
  )
}

function isNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function isNonnegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isValidConcurrency(value: unknown): value is number {
  return (
    isNonnegativeInteger(value) &&
    value >= 1 &&
    value <= MAX_WORKFLOW_CONCURRENCY
  )
}

function isValidTokenBudget(value: unknown): value is number | null {
  return (
    value === null ||
    (isNonnegativeInteger(value) && value >= 1 && value <= MAX_TOKEN_BUDGET)
  )
}

function parseTokenUsage(value: unknown): WorkflowTokenUsage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (
    !isNonnegativeInteger(raw.inputTokens) ||
    !isNonnegativeInteger(raw.outputTokens) ||
    !isNonnegativeInteger(raw.cacheReadInputTokens) ||
    !isNonnegativeInteger(raw.cacheCreationInputTokens)
  ) {
    return null
  }
  return {
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
    cacheReadInputTokens: raw.cacheReadInputTokens,
    cacheCreationInputTokens: raw.cacheCreationInputTokens,
  }
}

function tokenUsageTotal(usage: WorkflowTokenUsage): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens
  )
}

function parseCheckpointedResult(
  value: unknown,
  specStep: WorkflowStep,
): WorkflowStepWorktree['result'] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (
    typeof raw.output !== 'string' ||
    !isNonnegativeInteger(raw.tokens) ||
    !isNonnegativeInteger(raw.toolUses)
  ) {
    return null
  }
  const usage = raw.usage === undefined ? undefined : parseTokenUsage(raw.usage)
  if (raw.usage !== undefined && usage === null) return null
  if (usage && tokenUsageTotal(usage) !== raw.tokens) return null
  if (
    raw.model !== undefined &&
    (typeof raw.model !== 'string' ||
      raw.model.length === 0 ||
      raw.model.length > 160)
  ) {
    return null
  }
  if (
    raw.estimatedCostUsd !== undefined &&
    !isNonnegativeFinite(raw.estimatedCostUsd)
  ) {
    return null
  }
  if (
    raw.hasUnknownCost !== undefined &&
    typeof raw.hasUnknownCost !== 'boolean'
  ) {
    return null
  }
  const metrics = {
    tokens: raw.tokens,
    toolUses: raw.toolUses,
    ...(usage === undefined || usage === null ? {} : { usage }),
    ...(raw.model === undefined ? {} : { model: raw.model as string }),
    ...(raw.estimatedCostUsd === undefined
      ? {}
      : { estimatedCostUsd: raw.estimatedCostUsd as number }),
    ...(raw.hasUnknownCost === undefined
      ? {}
      : { hasUnknownCost: raw.hasUnknownCost as boolean }),
  }
  if (raw.structuredOutput === undefined) {
    if (specStep.outputSchema) return null
    return {
      output: raw.output,
      ...metrics,
    }
  }
  if (!specStep.outputSchema) return null
  const validated = validateWorkflowStructuredOutput(
    specStep.outputSchema,
    raw.structuredOutput,
  )
  if (!validated.success) return null
  return {
    output: validated.output,
    structuredOutput: validated.value,
    ...metrics,
  }
}

function parseStepWorktree(
  value: unknown,
  specStep: WorkflowStep,
): WorkflowStepWorktree | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (
    typeof raw.slug !== 'string' ||
    !WORKFLOW_WORKTREE_SLUG_RE.test(raw.slug) ||
    typeof raw.path !== 'string' ||
    raw.path.length === 0 ||
    raw.path.length > 4096 ||
    typeof raw.branch !== 'string' ||
    raw.branch.length === 0 ||
    raw.branch.length > 256 ||
    typeof raw.sourceHead !== 'string' ||
    !GIT_OBJECT_ID_RE.test(raw.sourceHead) ||
    typeof raw.inputTree !== 'string' ||
    !GIT_OBJECT_ID_RE.test(raw.inputTree) ||
    !WORKTREE_STATUSES.has(raw.status as WorkflowStepWorktree['status']) ||
    !isNonnegativeInteger(raw.attempt) ||
    raw.attempt < 1 ||
    !isNonnegativeInteger(raw.resumeCount) ||
    !isNonnegativeInteger(raw.createdAt)
  ) {
    return null
  }
  if (
    raw.outputTree !== undefined &&
    (typeof raw.outputTree !== 'string' ||
      !GIT_OBJECT_ID_RE.test(raw.outputTree))
  ) {
    return null
  }
  if (raw.completedAt !== undefined && !isNonnegativeInteger(raw.completedAt)) {
    return null
  }
  if (
    raw.error !== undefined &&
    (typeof raw.error !== 'string' || raw.error.length > 4000)
  ) {
    return null
  }
  const result =
    raw.result === undefined
      ? undefined
      : parseCheckpointedResult(raw.result, specStep)
  if (raw.result !== undefined && result === null) return null
  if (
    (raw.status === 'merging' || raw.status === 'merged') &&
    (raw.outputTree === undefined || result === undefined || result === null)
  ) {
    return null
  }
  return {
    slug: raw.slug,
    path: raw.path,
    branch: raw.branch,
    sourceHead: raw.sourceHead,
    inputTree: raw.inputTree,
    status: raw.status as WorkflowStepWorktree['status'],
    attempt: raw.attempt,
    resumeCount: raw.resumeCount,
    createdAt: raw.createdAt,
    ...(raw.outputTree === undefined
      ? {}
      : { outputTree: raw.outputTree as string }),
    ...(raw.completedAt === undefined
      ? {}
      : { completedAt: raw.completedAt as number }),
    ...(raw.error === undefined ? {} : { error: raw.error as string }),
    ...(result === undefined || result === null ? {} : { result }),
  }
}

function parseStepState(
  value: unknown,
  specStep: WorkflowStep,
): WorkflowRun['steps'][string] | null {
  const expectedId = specStep.id
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (
    raw.id !== expectedId ||
    !STEP_STATUSES.has(raw.status as WorkflowRun['steps'][string]['status']) ||
    !isNonnegativeInteger(raw.attempts) ||
    !isNonnegativeInteger(raw.tokens) ||
    !isNonnegativeInteger(raw.toolUses)
  ) {
    return null
  }
  if (raw.startedAt !== undefined && !isNonnegativeInteger(raw.startedAt))
    return null
  if (raw.completedAt !== undefined && !isNonnegativeInteger(raw.completedAt))
    return null
  if (raw.output !== undefined && typeof raw.output !== 'string') return null
  if (raw.error !== undefined && typeof raw.error !== 'string') return null
  let worktrees: WorkflowStepWorktree[] | undefined
  if (raw.worktrees !== undefined) {
    if (!Array.isArray(raw.worktrees) || raw.worktrees.length > 96) return null
    const parsed = raw.worktrees.map(worktree =>
      parseStepWorktree(worktree, specStep),
    )
    if (parsed.some(worktree => worktree === null)) return null
    worktrees = parsed as WorkflowStepWorktree[]
    if (
      new Set(worktrees.map(worktree => worktree.slug)).size !==
      worktrees.length
    )
      return null
  }
  const usage = raw.usage === undefined ? undefined : parseTokenUsage(raw.usage)
  if (raw.usage !== undefined && usage === null) return null
  if (usage && tokenUsageTotal(usage) !== raw.tokens) return null
  let models: string[] | undefined
  if (raw.models !== undefined) {
    if (
      !Array.isArray(raw.models) ||
      raw.models.length > 16 ||
      raw.models.some(
        model =>
          typeof model !== 'string' || model.length === 0 || model.length > 160,
      )
    ) {
      return null
    }
    models = raw.models as string[]
    if (new Set(models).size !== models.length) return null
  }
  if (
    raw.estimatedCostUsd !== undefined &&
    !isNonnegativeFinite(raw.estimatedCostUsd)
  ) {
    return null
  }
  if (
    raw.hasUnknownCost !== undefined &&
    typeof raw.hasUnknownCost !== 'boolean'
  ) {
    return null
  }
  let structuredOutput
  let canonicalOutput = raw.output as string | undefined
  if (raw.structuredOutput !== undefined) {
    if (!specStep.outputSchema) return null
    const validated = validateWorkflowStructuredOutput(
      specStep.outputSchema,
      raw.structuredOutput,
    )
    if (!validated.success) return null
    structuredOutput = validated.value
    canonicalOutput = validated.output
  } else if (raw.status === 'completed' && specStep.outputSchema) {
    return null
  }
  return {
    id: expectedId,
    status: raw.status as WorkflowRun['steps'][string]['status'],
    attempts: raw.attempts,
    tokens: raw.tokens,
    toolUses: raw.toolUses,
    ...(raw.startedAt === undefined
      ? {}
      : { startedAt: raw.startedAt as number }),
    ...(raw.completedAt === undefined
      ? {}
      : { completedAt: raw.completedAt as number }),
    ...(canonicalOutput === undefined ? {} : { output: canonicalOutput }),
    ...(structuredOutput === undefined ? {} : { structuredOutput }),
    ...(worktrees === undefined ? {} : { worktrees }),
    ...(usage === undefined || usage === null ? {} : { usage }),
    ...(models === undefined ? {} : { models }),
    ...(raw.estimatedCostUsd === undefined
      ? {}
      : { estimatedCostUsd: raw.estimatedCostUsd as number }),
    ...(raw.hasUnknownCost === undefined
      ? {}
      : { hasUnknownCost: raw.hasUnknownCost as boolean }),
    ...(raw.error === undefined ? {} : { error: raw.error as string }),
  }
}

function parseRunCreated(
  value: unknown,
  projectRoot: string,
  expectedRunId: string,
): WorkflowRun | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const event = value as Record<string, unknown>
  if (
    event.type !== 'run_created' ||
    !event.run ||
    typeof event.run !== 'object'
  ) {
    return null
  }
  const raw = event.run as WorkflowRun
  const rawRecord = event.run as Record<string, unknown>
  const rawSchemaVersion = rawRecord.schemaVersion
  try {
    const spec = validateWorkflowSpec(raw.spec)
    if (
      (rawSchemaVersion !== 1 &&
        rawSchemaVersion !== 2 &&
        rawSchemaVersion !== 3 &&
        rawSchemaVersion !== WORKFLOW_SCHEMA_VERSION) ||
      raw.runId !== expectedRunId ||
      typeof raw.sessionId !== 'string' ||
      typeof raw.projectRoot !== 'string' ||
      !RUN_STATUSES.has(raw.status) ||
      !isNonnegativeInteger(raw.createdAt) ||
      !isNonnegativeInteger(raw.updatedAt) ||
      !isNonnegativeInteger(raw.resumeCount) ||
      !raw.steps ||
      typeof raw.steps !== 'object'
    ) {
      return null
    }
    const isV4 = rawSchemaVersion === WORKFLOW_SCHEMA_VERSION
    const concurrencyLimit = isV4
      ? rawRecord.concurrencyLimit
      : spec.maxConcurrency
    const tokenBudget = isV4 ? rawRecord.tokenBudget : spec.tokenBudget
    if (
      !isValidConcurrency(concurrencyLimit) ||
      !isValidTokenBudget(tokenBudget) ||
      (raw.status === 'budget_limited' && !isV4) ||
      (isV4 &&
        (!isNonnegativeFinite(rawRecord.estimatedCostUsd) ||
          typeof rawRecord.hasUnknownCost !== 'boolean'))
    ) {
      return null
    }
    assertRunId(expectedRunId)
    const rawSteps = raw.steps as Record<string, unknown>
    const stepEntries = spec.steps.map(step => {
      const state = parseStepState(rawSteps[step.id], step)
      return state ? ([step.id, state] as const) : null
    })
    if (stepEntries.some(entry => entry === null)) return null
    return {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      runId: expectedRunId,
      sessionId: raw.sessionId,
      // The journal owns state, not its old filesystem location. Rebasing to
      // the directory containing it keeps moved projects resumable and stops
      // a journal from selecting an unrelated working directory.
      projectRoot,
      spec,
      status: raw.status,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      ...(isNonnegativeInteger(raw.completedAt)
        ? { completedAt: raw.completedAt }
        : {}),
      resumeCount: raw.resumeCount,
      concurrencyLimit,
      tokenBudget,
      totalTokens: 0,
      totalToolUses: 0,
      estimatedCostUsd: 0,
      hasUnknownCost: false,
      ...(typeof raw.error === 'string' ? { error: raw.error } : {}),
      steps: Object.fromEntries(
        stepEntries as Array<readonly [string, WorkflowRun['steps'][string]]>,
      ),
    }
  } catch {
    return null
  }
}

function applyJournalEvent(run: WorkflowRun, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const event = value as Record<string, unknown>
  if (
    event.type === 'step_updated' &&
    event.step &&
    typeof event.step === 'object'
  ) {
    const id = (event.step as Record<string, unknown>).id
    if (typeof id === 'string' && run.steps[id]) {
      const specStep = run.spec.steps.find(step => step.id === id)
      const step = specStep ? parseStepState(event.step, specStep) : null
      if (step) run.steps[id] = step
    }
    return
  }
  if (event.type === 'run_configured') {
    if (
      isValidConcurrency(event.concurrencyLimit) &&
      isValidTokenBudget(event.tokenBudget)
    ) {
      run.concurrencyLimit = event.concurrencyLimit
      run.tokenBudget = event.tokenBudget
      if (isNonnegativeInteger(event.updatedAt)) run.updatedAt = event.updatedAt
    }
    return
  }
  if (event.type !== 'run_updated') return
  if (
    event.status === 'pending' ||
    event.status === 'running' ||
    event.status === 'completed' ||
    event.status === 'failed' ||
    event.status === 'budget_limited' ||
    event.status === 'cancelled'
  ) {
    run.status = event.status
  }
  if (isNonnegativeInteger(event.updatedAt)) run.updatedAt = event.updatedAt
  run.completedAt = isNonnegativeInteger(event.completedAt)
    ? event.completedAt
    : undefined
  if (isNonnegativeInteger(event.resumeCount))
    run.resumeCount = event.resumeCount
  if (isNonnegativeInteger(event.totalTokens))
    run.totalTokens = event.totalTokens
  if (isNonnegativeInteger(event.totalToolUses))
    run.totalToolUses = event.totalToolUses
  if (isNonnegativeFinite(event.estimatedCostUsd))
    run.estimatedCostUsd = event.estimatedCostUsd
  if (typeof event.hasUnknownCost === 'boolean')
    run.hasUnknownCost = event.hasUnknownCost
  run.error = typeof event.error === 'string' ? event.error : undefined
}

export async function loadWorkflowRun(
  projectRoot: string,
  runId: string,
): Promise<WorkflowRun | null> {
  let content: string
  try {
    content = await readFile(journalPath(projectRoot, runId), 'utf8')
  } catch {
    return null
  }
  const events = content
    .split('\n')
    .filter(Boolean)
    .flatMap(line => {
      try {
        return [JSON.parse(line) as unknown]
      } catch {
        return []
      }
    })
  const run = parseRunCreated(events[0], projectRoot, runId)
  if (!run) return null
  for (const event of events.slice(1)) applyJournalEvent(run, event)
  for (const step of Object.values(run.steps)) {
    if (
      step.tokens > 0 &&
      (step.estimatedCostUsd === undefined || step.hasUnknownCost === undefined)
    ) {
      step.estimatedCostUsd ??= 0
      step.hasUnknownCost = true
    }
  }
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
  return run
}

export async function listWorkflowRuns(
  projectRoot: string,
): Promise<WorkflowRun[]> {
  let files: string[]
  try {
    files = await readdir(getWorkflowRunsDir(projectRoot))
  } catch {
    return []
  }
  const runs = await Promise.all(
    files
      .filter(file => file.endsWith('.jsonl'))
      .map(file =>
        loadWorkflowRun(projectRoot, file.slice(0, -'.jsonl'.length)),
      ),
  )
  return runs
    .filter((run): run is WorkflowRun => run !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function _flushWorkflowStorageForTesting(): Promise<void> {
  await Promise.allSettled([...writeQueues.values()])
}
