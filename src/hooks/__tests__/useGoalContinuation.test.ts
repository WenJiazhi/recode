import { describe, expect, test } from 'bun:test'
import type { GoalState } from '../../types/logs.js'
import {
  decideGoalContinuation,
  type GoalContinuationDecision,
} from '../useGoalContinuation.js'
import { MAX_GOAL_CONTINUATIONS } from '../../services/goal/goalState.js'

function makeGoal(overrides: Partial<GoalState> = {}): GoalState {
  const now = Date.now()
  return {
    schemaVersion: 1,
    objective: 'finish the task',
    status: 'active',
    tokenBudget: null,
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
    ...overrides,
  }
}

function decide(
  overrides: Partial<Parameters<typeof decideGoalContinuation>[0]> = {},
): GoalContinuationDecision {
  return decideGoalContinuation({
    goal: makeGoal(),
    isLoading: false,
    isQueryActive: false,
    wasAborted: false,
    queueLength: 0,
    hasActiveLocalJsxUI: false,
    isInPlanMode: false,
    alreadyEnqueued: false,
    budgetPromptSent: false,
    ...overrides,
  })
}

describe('decideGoalContinuation', () => {
  test('continues only from a clean idle state', () => {
    expect(decide()).toEqual({ type: 'continue' })
  })

  test('gives active queries and prior aborts precedence', () => {
    expect(decide({ isLoading: true })).toEqual({
      type: 'none',
      reason: 'query-active',
    })
    expect(decide({ isQueryActive: true })).toEqual({
      type: 'none',
      reason: 'query-active',
    })
    expect(decide({ wasAborted: true })).toEqual({
      type: 'none',
      reason: 'aborted',
    })
  })

  test('never jumps ahead of user input, dialogs, or plan mode', () => {
    expect(decide({ queueLength: 1 })).toEqual({
      type: 'none',
      reason: 'user-queue',
    })
    expect(decide({ hasActiveLocalJsxUI: true })).toEqual({
      type: 'none',
      reason: 'dialog',
    })
    expect(decide({ isInPlanMode: true })).toEqual({
      type: 'none',
      reason: 'plan-mode',
    })
  })

  test('does not enqueue twice in one idle window', () => {
    expect(decide({ alreadyEnqueued: true })).toEqual({
      type: 'none',
      reason: 'already-enqueued',
    })
  })

  test('emits one budget summary turn and then stops', () => {
    const limited = makeGoal({ status: 'budget_limited' })
    expect(decide({ goal: limited })).toEqual({ type: 'budget_limit' })
    expect(decide({ goal: limited, budgetPromptSent: true })).toEqual({
      type: 'none',
      reason: 'budget-prompt-sent',
    })
  })

  test('stops active Goals at the automatic continuation cap', () => {
    expect(
      decide({
        goal: makeGoal({ turnsExecuted: MAX_GOAL_CONTINUATIONS }),
      }),
    ).toEqual({ type: 'max_turns' })
  })

  test('does not continue absent or terminal Goals', () => {
    expect(decide({ goal: null })).toEqual({
      type: 'none',
      reason: 'no-goal',
    })
    expect(decide({ goal: makeGoal({ status: 'complete' }) })).toEqual({
      type: 'none',
      reason: 'complete',
    })
    expect(decide({ goal: makeGoal({ status: 'paused' }) })).toEqual({
      type: 'none',
      reason: 'paused',
    })
  })
})
