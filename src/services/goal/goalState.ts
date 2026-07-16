import { getSessionId } from '../../bootstrap/state.js'
import type { GoalCheckpoint, GoalState, GoalStatus } from '../../types/logs.js'
import { logForDebugging } from '../../utils/debug.js'

const GOAL_STATE_VERSION = 1
export const BLOCKED_CONSECUTIVE_THRESHOLD = 3
export const MAX_GOAL_CONTINUATIONS = 100
export const MAX_GOAL_OBJECTIVE_CHARS = 4000
const MAX_GOAL_CHECKPOINT_CHARS = 2000
const MAX_GOAL_STOP_REASON_CHARS = 2000
export const MAX_GOAL_CHECKPOINTS = 20

const RESUMABLE_STATUSES = new Set<GoalStatus>([
  'paused',
  'blocked',
  'usage_limited',
])
const GOAL_STATUSES = new Set<GoalStatus>([
  'active',
  'paused',
  'blocked',
  'budget_limited',
  'usage_limited',
  'max_turns',
  'complete',
])

const goals = new Map<string, GoalState>()
const subscribers = new Set<() => void>()
let revision = 0

function notifyGoalChanged(): void {
  revision += 1
  for (const subscriber of subscribers) subscriber()
}

export function subscribeToGoalChanges(subscriber: () => void): () => void {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function getGoalRevisionSnapshot(): number {
  return revision
}

function resolveSessionId(sessionId?: string): string {
  return sessionId ?? getSessionId()
}

function goalLog(event: string, detail: string): void {
  logForDebugging(`[goal] ${event}: ${detail}`)
}

function commitGoal(sessionId: string, goal: GoalState): GoalState {
  goals.set(sessionId, goal)
  notifyGoalChanged()
  return goal
}

function stopActiveClock(
  goal: GoalState,
  now: number,
  status: Exclude<GoalStatus, 'active'>,
  reason: string | null,
): GoalState {
  const activeDelta = Math.max(0, now - goal.startTime)
  return {
    ...goal,
    status,
    accumulatedActiveMs: goal.accumulatedActiveMs + activeDelta,
    pausedAt: now,
    updatedAt: now,
    lastStopReason: reason,
  }
}

function normalizeBudget(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Goal token budget must be a positive integer')
  }
  return value
}

export function setGoal(
  objective: string,
  options?: { tokenBudget?: number | null; sessionId?: string },
): GoalState {
  const normalizedObjective = objective.trim()
  if (!normalizedObjective) throw new Error('Goal objective must not be empty')
  if (normalizedObjective.length > MAX_GOAL_OBJECTIVE_CHARS) {
    throw new Error(
      `Goal objective exceeds ${MAX_GOAL_OBJECTIVE_CHARS} characters`,
    )
  }

  const now = Date.now()
  const goal: GoalState = {
    schemaVersion: GOAL_STATE_VERSION,
    objective: normalizedObjective,
    status: 'active',
    tokenBudget: normalizeBudget(options?.tokenBudget),
    tokensUsed: 0,
    startTime: now,
    pausedAt: null,
    accumulatedActiveMs: 0,
    blockedAttempts: 0,
    lastBlockReason: null,
    lastBlockedTurn: null,
    lastStopReason: null,
    createdAt: now,
    updatedAt: now,
    turnsExecuted: 0,
    checkpoints: [],
  }
  goalLog('set', normalizedObjective.slice(0, 100))
  return commitGoal(resolveSessionId(options?.sessionId), goal)
}

export function getGoal(sessionId?: string): GoalState | null {
  return goals.get(resolveSessionId(sessionId)) ?? null
}

export function clearGoal(sessionId?: string): boolean {
  const removed = goals.delete(resolveSessionId(sessionId))
  if (removed) {
    goalLog('clear', 'removed active session goal')
    notifyGoalChanged()
  }
  return removed
}

export function pauseGoal(
  reason = 'Paused by user',
  sessionId?: string,
): GoalState | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current || current.status !== 'active') return null
  const next = stopActiveClock(current, Date.now(), 'paused', reason)
  goalLog('pause', reason)
  return commitGoal(id, next)
}

export function resumeGoal(sessionId?: string): GoalState | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current || !RESUMABLE_STATUSES.has(current.status)) return null
  if (
    current.tokenBudget !== null &&
    current.tokensUsed >= current.tokenBudget
  ) {
    return null
  }

  const now = Date.now()
  const next: GoalState = {
    ...current,
    status: 'active',
    startTime: now,
    pausedAt: null,
    blockedAttempts: 0,
    lastBlockReason: null,
    lastBlockedTurn: null,
    lastStopReason: null,
    updatedAt: now,
  }
  goalLog('resume', `from ${current.status}`)
  return commitGoal(id, next)
}

export function updateGoalBudget(
  tokenBudget: number | null,
  sessionId?: string,
): GoalState | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current || current.status === 'complete') return null

  const budget = normalizeBudget(tokenBudget)
  const now = Date.now()
  let next: GoalState = {
    ...current,
    tokenBudget: budget,
    updatedAt: now,
  }

  if (
    current.status === 'budget_limited' &&
    (budget === null || budget > current.tokensUsed)
  ) {
    next = {
      ...next,
      status: 'active',
      startTime: now,
      pausedAt: null,
      lastStopReason: null,
    }
  } else if (budget !== null && current.tokensUsed >= budget) {
    next =
      current.status === 'active'
        ? stopActiveClock(next, now, 'budget_limited', 'Token budget reached')
        : {
            ...next,
            status: 'budget_limited',
            pausedAt: current.pausedAt ?? now,
            lastStopReason: 'Token budget reached',
          }
  }

  goalLog('budget', budget === null ? 'unlimited' : String(budget))
  return commitGoal(id, next)
}

export function completeGoal(
  sessionId?: string,
  finalSummary?: string,
): GoalState | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current) return null
  if (current.status === 'complete') return current

  const normalizedSummary = finalSummary?.trim()
  if (
    normalizedSummary &&
    normalizedSummary.length > MAX_GOAL_CHECKPOINT_CHARS
  ) {
    throw new Error(
      `Goal checkpoint exceeds ${MAX_GOAL_CHECKPOINT_CHARS} characters`,
    )
  }
  const completedAt = Date.now()
  const checkpoints = normalizedSummary
    ? [
        ...current.checkpoints,
        {
          summary: normalizedSummary,
          createdAt: completedAt,
          turnsExecuted: current.turnsExecuted,
          tokensUsed: current.tokensUsed,
        },
      ].slice(-MAX_GOAL_CHECKPOINTS)
    : current.checkpoints

  const stopped =
    current.status === 'active'
      ? stopActiveClock(current, completedAt, 'complete', null)
      : {
          ...current,
          status: 'complete' as const,
          updatedAt: completedAt,
          lastStopReason: null,
        }
  const next = { ...stopped, checkpoints }
  goalLog('complete', current.objective.slice(0, 100))
  return commitGoal(id, next)
}

export function updateGoalTokens(
  delta: number,
  sessionId?: string,
): GoalState | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current || current.status !== 'active') return current ?? null
  if (!Number.isFinite(delta) || delta <= 0) return current

  const increment = Math.floor(delta)
  if (increment <= 0) return current
  const tokensUsed = Math.min(
    Number.MAX_SAFE_INTEGER,
    current.tokensUsed + increment,
  )
  const now = Date.now()
  const next =
    current.tokenBudget !== null && tokensUsed >= current.tokenBudget
      ? stopActiveClock(
          { ...current, tokensUsed },
          now,
          'budget_limited',
          'Token budget reached',
        )
      : { ...current, tokensUsed, updatedAt: now }

  return commitGoal(id, next)
}

export function markUsageLimited(
  reason = 'Provider usage limit reached',
  sessionId?: string,
): GoalState | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current || current.status !== 'active') return null
  return commitGoal(
    id,
    stopActiveClock(current, Date.now(), 'usage_limited', reason),
  )
}

export function incrementGoalTurns(sessionId?: string): number {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current || current.status !== 'active') return 0
  const turnsExecuted = current.turnsExecuted + 1
  const blockedStreakWasBroken =
    current.lastBlockedTurn !== null &&
    current.lastBlockedTurn !== current.turnsExecuted
  commitGoal(id, {
    ...current,
    turnsExecuted,
    ...(blockedStreakWasBroken
      ? {
          blockedAttempts: 0,
          lastBlockReason: null,
          lastBlockedTurn: null,
        }
      : {}),
    updatedAt: Date.now(),
  })
  return turnsExecuted
}

export function markGoalMaxTurnsReached(sessionId?: string): GoalState | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (
    !current ||
    current.status !== 'active' ||
    current.turnsExecuted < MAX_GOAL_CONTINUATIONS
  ) {
    return null
  }
  return commitGoal(
    id,
    stopActiveClock(
      current,
      Date.now(),
      'max_turns',
      `Reached ${MAX_GOAL_CONTINUATIONS} automatic continuations`,
    ),
  )
}

export function continueGoalFromMaxTurns(sessionId?: string): GoalState | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current || current.status !== 'max_turns') return null
  const now = Date.now()
  return commitGoal(id, {
    ...current,
    status: 'active',
    turnsExecuted: 0,
    startTime: now,
    pausedAt: null,
    blockedAttempts: 0,
    lastBlockReason: null,
    lastBlockedTurn: null,
    lastStopReason: null,
    updatedAt: now,
  })
}

export function recordBlockedAttempt(
  reason: string,
  sessionId?: string,
): { status: GoalStatus; attempts: number; recorded: boolean } | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current || current.status !== 'active') return null

  const trimmed = reason.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_GOAL_STOP_REASON_CHARS) {
    throw new Error(
      `Goal stop reason exceeds ${MAX_GOAL_STOP_REASON_CHARS} characters`,
    )
  }
  if (current.lastBlockedTurn === current.turnsExecuted) {
    return {
      status: current.status,
      attempts: current.blockedAttempts,
      recorded: false,
    }
  }
  const normalized = trimmed.replace(/\s+/g, ' ').toLowerCase()
  const previous = current.lastBlockReason
    ?.trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
  const blockedAttempts =
    previous === normalized ? current.blockedAttempts + 1 : 1
  const now = Date.now()
  const candidate: GoalState = {
    ...current,
    blockedAttempts,
    lastBlockReason: trimmed,
    lastBlockedTurn: current.turnsExecuted,
    updatedAt: now,
  }
  const next =
    blockedAttempts >= BLOCKED_CONSECUTIVE_THRESHOLD
      ? stopActiveClock(candidate, now, 'blocked', trimmed)
      : candidate
  commitGoal(id, next)
  return { status: next.status, attempts: blockedAttempts, recorded: true }
}

export function recordGoalCheckpoint(
  summary: string,
  sessionId?: string,
): GoalState | null {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  const normalized = summary.trim()
  if (!current || current.status !== 'active' || !normalized) return null
  if (normalized.length > MAX_GOAL_CHECKPOINT_CHARS) {
    throw new Error(
      `Goal checkpoint exceeds ${MAX_GOAL_CHECKPOINT_CHARS} characters`,
    )
  }

  const checkpoint: GoalCheckpoint = {
    summary: normalized,
    createdAt: Date.now(),
    turnsExecuted: current.turnsExecuted,
    tokensUsed: current.tokensUsed,
  }
  const checkpoints = [...current.checkpoints, checkpoint].slice(
    -MAX_GOAL_CHECKPOINTS,
  )
  return commitGoal(id, {
    ...current,
    checkpoints,
    blockedAttempts: 0,
    lastBlockReason: null,
    lastBlockedTurn: null,
    updatedAt: checkpoint.createdAt,
  })
}

export function getActiveElapsedMs(goal: GoalState): number {
  const ongoing =
    goal.status === 'active' ? Math.max(0, Date.now() - goal.startTime) : 0
  return goal.accumulatedActiveMs + ongoing
}

export function formatGoalElapsed(goal: GoalState): string {
  const seconds = Math.floor(getActiveElapsedMs(goal) / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${remainder}s`
  return `${remainder}s`
}

export function formatGoalStatusLabel(status: GoalStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'paused':
      return 'Paused'
    case 'blocked':
      return 'Blocked'
    case 'budget_limited':
      return 'Budget Limited'
    case 'usage_limited':
      return 'Usage Limited'
    case 'max_turns':
      return 'Max Continuations Reached'
    case 'complete':
      return 'Complete'
  }
}

function finiteNonNegative(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback
}

export function normalizePersistedGoalState(
  value: unknown,
  now = Date.now(),
): GoalState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (
    raw.schemaVersion !== undefined &&
    raw.schemaVersion !== GOAL_STATE_VERSION
  ) {
    return null
  }
  if (typeof raw.objective !== 'string') return null
  const objective = raw.objective.trim()
  if (!objective || objective.length > MAX_GOAL_OBJECTIVE_CHARS) return null
  if (
    typeof raw.status !== 'string' ||
    !GOAL_STATUSES.has(raw.status as GoalStatus)
  ) {
    return null
  }

  const tokenBudget =
    raw.tokenBudget === null || raw.tokenBudget === undefined
      ? null
      : typeof raw.tokenBudget === 'number' &&
          Number.isSafeInteger(raw.tokenBudget) &&
          raw.tokenBudget > 0
        ? raw.tokenBudget
        : null
  const createdAt = finiteNonNegative(raw.createdAt, now)
  const updatedAt = Math.min(now, finiteNonNegative(raw.updatedAt, createdAt))
  const startTime = Math.min(now, finiteNonNegative(raw.startTime, updatedAt))
  let accumulatedActiveMs = finiteNonNegative(raw.accumulatedActiveMs, 0)
  const persistedStatus = raw.status as GoalStatus
  const tokensUsed = Math.floor(finiteNonNegative(raw.tokensUsed, 0))
  const turnsExecuted = Math.floor(finiteNonNegative(raw.turnsExecuted, 0))
  const status: GoalStatus =
    persistedStatus === 'active' &&
    tokenBudget !== null &&
    tokensUsed >= tokenBudget
      ? 'budget_limited'
      : persistedStatus === 'active' && turnsExecuted >= MAX_GOAL_CONTINUATIONS
        ? 'max_turns'
        : persistedStatus

  // A resumed active goal starts a new clock interval. Time while the CLI was
  // closed is excluded; only activity through the last persisted checkpoint
  // is folded into the accumulated total.
  if (persistedStatus === 'active') {
    accumulatedActiveMs += Math.max(0, updatedAt - startTime)
  }

  const checkpoints: GoalCheckpoint[] = Array.isArray(raw.checkpoints)
    ? raw.checkpoints
        .filter(
          (checkpoint): checkpoint is Record<string, unknown> =>
            Boolean(checkpoint) &&
            typeof checkpoint === 'object' &&
            !Array.isArray(checkpoint) &&
            typeof (checkpoint as Record<string, unknown>).summary === 'string',
        )
        .map(checkpoint => ({
          summary: String(checkpoint.summary).slice(
            0,
            MAX_GOAL_CHECKPOINT_CHARS,
          ),
          createdAt: finiteNonNegative(checkpoint.createdAt, updatedAt),
          turnsExecuted: Math.floor(
            finiteNonNegative(checkpoint.turnsExecuted, 0),
          ),
          tokensUsed: Math.floor(finiteNonNegative(checkpoint.tokensUsed, 0)),
        }))
        .slice(-MAX_GOAL_CHECKPOINTS)
    : []

  return {
    schemaVersion: GOAL_STATE_VERSION,
    objective,
    status,
    tokenBudget,
    tokensUsed,
    startTime: status === 'active' ? now : startTime,
    pausedAt:
      status === 'active'
        ? null
        : persistedStatus === 'active'
          ? updatedAt
          : finiteNonNegative(raw.pausedAt, updatedAt),
    accumulatedActiveMs,
    blockedAttempts: Math.floor(finiteNonNegative(raw.blockedAttempts, 0)),
    lastBlockReason:
      typeof raw.lastBlockReason === 'string'
        ? raw.lastBlockReason.slice(0, MAX_GOAL_STOP_REASON_CHARS)
        : null,
    lastBlockedTurn:
      raw.lastBlockedTurn === null || raw.lastBlockedTurn === undefined
        ? null
        : Math.min(
            turnsExecuted,
            Math.floor(finiteNonNegative(raw.lastBlockedTurn, 0)),
          ),
    lastStopReason:
      status === 'budget_limited' && persistedStatus === 'active'
        ? 'Token budget reached'
        : status === 'max_turns' && persistedStatus === 'active'
          ? `Reached ${MAX_GOAL_CONTINUATIONS} automatic continuations`
          : typeof raw.lastStopReason === 'string'
            ? raw.lastStopReason
            : null,
    createdAt,
    updatedAt: now,
    turnsExecuted,
    checkpoints,
  }
}

export function hydrateGoalState(
  value: unknown,
  sessionId?: string,
): GoalState | null {
  const normalized = normalizePersistedGoalState(value)
  if (!normalized) return null
  return commitGoal(resolveSessionId(sessionId), normalized)
}

export function _clearAllGoalsForTesting(): void {
  goals.clear()
  notifyGoalChanged()
}

export function _setGoalTurnsForTesting(
  turnsExecuted: number,
  sessionId?: string,
): void {
  const id = resolveSessionId(sessionId)
  const current = goals.get(id)
  if (!current) return
  commitGoal(id, { ...current, turnsExecuted })
}
