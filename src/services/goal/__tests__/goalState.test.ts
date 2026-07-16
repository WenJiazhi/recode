import { beforeEach, describe, expect, test } from 'bun:test'
import {
  _clearAllGoalsForTesting,
  _setGoalTurnsForTesting,
  BLOCKED_CONSECUTIVE_THRESHOLD,
  clearGoal,
  completeGoal,
  continueGoalFromMaxTurns,
  getActiveElapsedMs,
  getGoal,
  hydrateGoalState,
  incrementGoalTurns,
  markGoalMaxTurnsReached,
  MAX_GOAL_CHECKPOINTS,
  MAX_GOAL_CONTINUATIONS,
  normalizePersistedGoalState,
  pauseGoal,
  recordBlockedAttempt,
  recordGoalCheckpoint,
  resumeGoal,
  setGoal,
  updateGoalBudget,
  updateGoalTokens,
} from '../goalState.js'

const SESSION = 'goal-state-test-session'

beforeEach(() => {
  _clearAllGoalsForTesting()
})

describe('Goal lifecycle', () => {
  test('creates a trimmed active Goal with isolated session state', () => {
    const goal = setGoal('  ship the feature  ', {
      tokenBudget: 80_000,
      sessionId: SESSION,
    })

    expect(goal.objective).toBe('ship the feature')
    expect(goal.status).toBe('active')
    expect(goal.tokenBudget).toBe(80_000)
    expect(goal.tokensUsed).toBe(0)
    expect(goal.checkpoints).toEqual([])
    expect(getGoal('another-session')).toBeNull()
  })

  test('rejects invalid objectives and budgets', () => {
    expect(() => setGoal('   ', { sessionId: SESSION })).toThrow()
    expect(() =>
      setGoal('work', { tokenBudget: -1, sessionId: SESSION }),
    ).toThrow()
    expect(() =>
      setGoal('work', { tokenBudget: 1.5, sessionId: SESSION }),
    ).toThrow()
  })

  test('pauses, resumes, completes, and clears', async () => {
    setGoal('work', { sessionId: SESSION })
    await Bun.sleep(5)

    const paused = pauseGoal('manual pause', SESSION)
    expect(paused?.status).toBe('paused')
    expect(paused?.lastStopReason).toBe('manual pause')
    expect(paused?.accumulatedActiveMs).toBeGreaterThanOrEqual(1)

    const frozenElapsed = getActiveElapsedMs(paused!)
    await Bun.sleep(5)
    expect(getActiveElapsedMs(getGoal(SESSION)!)).toBe(frozenElapsed)

    expect(resumeGoal(SESSION)?.status).toBe('active')
    expect(completeGoal(SESSION)?.status).toBe('complete')
    expect(clearGoal(SESSION)).toBe(true)
    expect(getGoal(SESSION)).toBeNull()
  })
})

describe('Goal token budget', () => {
  test('counts all positive token deltas and stops at the budget', () => {
    setGoal('bounded work', { tokenBudget: 100, sessionId: SESSION })
    updateGoalTokens(40, SESSION)
    updateGoalTokens(60.9, SESSION)

    const goal = getGoal(SESSION)!
    expect(goal.tokensUsed).toBe(100)
    expect(goal.status).toBe('budget_limited')
    expect(goal.lastStopReason).toBe('Token budget reached')

    updateGoalTokens(50, SESSION)
    expect(getGoal(SESSION)?.tokensUsed).toBe(100)
  })

  test('extending or removing a reached budget resumes the Goal', () => {
    setGoal('bounded work', { tokenBudget: 100, sessionId: SESSION })
    updateGoalTokens(110, SESSION)

    expect(updateGoalBudget(200, SESSION)?.status).toBe('active')
    updateGoalTokens(20, SESSION)
    expect(updateGoalBudget(null, SESSION)?.tokenBudget).toBeNull()
    expect(getGoal(SESSION)?.status).toBe('active')
  })

  test('lowering a paused Goal below used tokens makes the budget authoritative', () => {
    setGoal('bounded work', { tokenBudget: 500, sessionId: SESSION })
    updateGoalTokens(200, SESSION)
    pauseGoal('review', SESSION)

    const limited = updateGoalBudget(100, SESSION)
    expect(limited?.status).toBe('budget_limited')
    expect(resumeGoal(SESSION)).toBeNull()
  })
})

describe('Goal checkpoints and blocked audit', () => {
  test('keeps a bounded checkpoint history and resets a blocked streak', () => {
    setGoal('checkpointed work', { sessionId: SESSION })
    recordBlockedAttempt('missing fixture', SESSION)
    expect(getGoal(SESSION)?.blockedAttempts).toBe(1)

    for (let index = 0; index < MAX_GOAL_CHECKPOINTS + 2; index += 1) {
      recordGoalCheckpoint(`milestone ${index}`, SESSION)
    }

    const goal = getGoal(SESSION)!
    expect(goal.checkpoints).toHaveLength(MAX_GOAL_CHECKPOINTS)
    expect(goal.checkpoints[0]?.summary).toBe('milestone 2')
    expect(goal.blockedAttempts).toBe(0)
    expect(goal.lastBlockReason).toBeNull()
  })

  test('ignores duplicate blocked reports from the same continuation', () => {
    setGoal('blocked work', { sessionId: SESSION })

    const first = recordBlockedAttempt('missing credential', SESSION)
    const duplicate = recordBlockedAttempt('missing credential', SESSION)

    expect(first).toEqual({ status: 'active', attempts: 1, recorded: true })
    expect(duplicate).toEqual({
      status: 'active',
      attempts: 1,
      recorded: false,
    })
  })

  test('requires the same reason across three consecutive Goal turns', () => {
    setGoal('blocked work', { sessionId: SESSION })

    expect(recordBlockedAttempt('missing credential', SESSION)?.attempts).toBe(
      1,
    )
    incrementGoalTurns(SESSION)
    expect(
      recordBlockedAttempt('Missing   Credential', SESSION)?.attempts,
    ).toBe(2)
    incrementGoalTurns(SESSION)
    const third = recordBlockedAttempt('MISSING CREDENTIAL', SESSION)

    expect(BLOCKED_CONSECUTIVE_THRESHOLD).toBe(3)
    expect(third).toEqual({ status: 'blocked', attempts: 3, recorded: true })
  })

  test('a turn without a blocked report breaks the streak', () => {
    setGoal('blocked work', { sessionId: SESSION })
    recordBlockedAttempt('same reason', SESSION)
    incrementGoalTurns(SESSION)
    incrementGoalTurns(SESSION)

    const next = recordBlockedAttempt('same reason', SESSION)
    expect(next?.attempts).toBe(1)
    expect(next?.status).toBe('active')
  })
})

describe('Goal continuation cap', () => {
  test('stops at the cap and requires explicit continuation', () => {
    setGoal('long work', { sessionId: SESSION })
    _setGoalTurnsForTesting(MAX_GOAL_CONTINUATIONS, SESSION)

    expect(markGoalMaxTurnsReached(SESSION)?.status).toBe('max_turns')
    const resumed = continueGoalFromMaxTurns(SESSION)
    expect(resumed?.status).toBe('active')
    expect(resumed?.turnsExecuted).toBe(0)
  })
})

describe('persisted Goal normalization', () => {
  test('excludes CLI offline time from active elapsed time', () => {
    const normalized = normalizePersistedGoalState(
      {
        schemaVersion: 1,
        objective: 'resume work',
        status: 'active',
        tokenBudget: null,
        tokensUsed: 10,
        startTime: 1_000,
        updatedAt: 2_000,
        createdAt: 500,
        accumulatedActiveMs: 250,
        turnsExecuted: 1,
      },
      100_000,
    )

    expect(normalized?.startTime).toBe(100_000)
    expect(normalized?.accumulatedActiveMs).toBe(1_250)
  })

  test('repairs active states that already reached a stop invariant', () => {
    const budgetLimited = normalizePersistedGoalState({
      objective: 'budget work',
      status: 'active',
      tokenBudget: 10,
      tokensUsed: 10,
      turnsExecuted: 0,
    })
    expect(budgetLimited?.status).toBe('budget_limited')

    const maxTurns = normalizePersistedGoalState({
      objective: 'long work',
      status: 'active',
      tokenBudget: null,
      tokensUsed: 0,
      turnsExecuted: MAX_GOAL_CONTINUATIONS,
    })
    expect(maxTurns?.status).toBe('max_turns')
  })

  test('rejects future schemas and hydrates valid state per session', () => {
    expect(
      normalizePersistedGoalState({
        schemaVersion: 99,
        objective: 'future',
        status: 'active',
      }),
    ).toBeNull()

    const hydrated = hydrateGoalState(
      { objective: 'restored', status: 'paused' },
      SESSION,
    )
    expect(hydrated?.objective).toBe('restored')
    expect(getGoal(SESSION)?.status).toBe('paused')
  })
})
