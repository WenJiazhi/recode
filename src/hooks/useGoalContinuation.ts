import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import {
  getGoal,
  getGoalRevisionSnapshot,
  incrementGoalTurns,
  markGoalMaxTurnsReached,
  MAX_GOAL_CONTINUATIONS,
  subscribeToGoalChanges,
} from '../services/goal/goalState.js'
import { persistCurrentGoal } from '../services/goal/goalStorage.js'
import {
  buildBudgetLimitPrompt,
  buildContinuationPrompt,
} from '../services/goal/prompts.js'
import type { GoalState } from '../types/logs.js'
import { logForDebugging } from '../utils/debug.js'
import {
  enqueue,
  getCommandQueueSnapshot,
} from '../utils/messageQueueManager.js'

export type GoalContinuationDecision =
  | { type: 'none'; reason: string }
  | { type: 'budget_limit' }
  | { type: 'max_turns' }
  | { type: 'continue' }

export function decideGoalContinuation(input: {
  goal: GoalState | null
  isLoading: boolean
  isQueryActive: boolean
  wasAborted: boolean
  queueLength: number
  hasActiveLocalJsxUI: boolean
  isInPlanMode: boolean
  alreadyEnqueued: boolean
  budgetPromptSent: boolean
}): GoalContinuationDecision {
  if (input.isLoading || input.isQueryActive)
    return { type: 'none', reason: 'query-active' }
  if (input.wasAborted) return { type: 'none', reason: 'aborted' }
  if (input.alreadyEnqueued) return { type: 'none', reason: 'already-enqueued' }
  if (input.queueLength > 0) return { type: 'none', reason: 'user-queue' }
  if (input.hasActiveLocalJsxUI) return { type: 'none', reason: 'dialog' }
  if (input.isInPlanMode) return { type: 'none', reason: 'plan-mode' }
  if (!input.goal) return { type: 'none', reason: 'no-goal' }
  if (input.goal.status === 'budget_limited') {
    return input.budgetPromptSent
      ? { type: 'none', reason: 'budget-prompt-sent' }
      : { type: 'budget_limit' }
  }
  if (input.goal.status !== 'active') {
    return { type: 'none', reason: input.goal.status }
  }
  if (input.goal.turnsExecuted >= MAX_GOAL_CONTINUATIONS) {
    return { type: 'max_turns' }
  }
  return { type: 'continue' }
}

export type UseGoalContinuationOptions = {
  isLoading: boolean
  wasAborted: boolean
  queuedCommandsLength: number
  hasActiveLocalJsxUI: boolean
  isInPlanMode: boolean
  isQueryActiveNow: () => boolean
  onContinuationEnqueued?: (payload: {
    turn: number
    maxTurns: number
    objective: string
  }) => void
  onMaxTurnsReached?: () => void
  onBudgetLimitReached?: () => void
}

export function useGoalContinuation(options: UseGoalContinuationOptions): void {
  const enqueuedForIdleWindow = useRef(false)
  const budgetPromptSent = useRef(false)
  const goalRevision = useSyncExternalStore(
    subscribeToGoalChanges,
    getGoalRevisionSnapshot,
  )

  useLayoutEffect(() => {
    if (options.isLoading) {
      enqueuedForIdleWindow.current = false
      return
    }

    const goal = getGoal()
    if (!goal || goal.status === 'active') budgetPromptSent.current = false
    const decision = decideGoalContinuation({
      goal,
      isLoading: options.isLoading,
      isQueryActive: options.isQueryActiveNow(),
      wasAborted: options.wasAborted,
      queueLength: getCommandQueueSnapshot().length,
      hasActiveLocalJsxUI: options.hasActiveLocalJsxUI,
      isInPlanMode: options.isInPlanMode,
      alreadyEnqueued: enqueuedForIdleWindow.current,
      budgetPromptSent: budgetPromptSent.current,
    })

    if (decision.type === 'none') return

    if (decision.type === 'budget_limit' && goal) {
      budgetPromptSent.current = true
      enqueuedForIdleWindow.current = true
      persistCurrentGoal()
      enqueue({
        value: buildBudgetLimitPrompt(goal),
        mode: 'prompt',
        priority: 'later',
        isMeta: true,
        origin: 'goal-budget-limit',
        skipSlashCommands: true,
      })
      options.onBudgetLimitReached?.()
      return
    }

    if (decision.type === 'max_turns') {
      if (markGoalMaxTurnsReached()) {
        persistCurrentGoal()
        options.onMaxTurnsReached?.()
      }
      return
    }

    if (!goal) return
    enqueuedForIdleWindow.current = true
    const turn = incrementGoalTurns()
    const updatedGoal = getGoal() ?? goal
    persistCurrentGoal()
    logForDebugging(
      `[goal] enqueue continuation ${turn}/${MAX_GOAL_CONTINUATIONS}`,
    )
    enqueue({
      value: buildContinuationPrompt(updatedGoal),
      mode: 'prompt',
      priority: 'later',
      isMeta: true,
      origin: 'goal-continuation',
      skipSlashCommands: true,
    })
    options.onContinuationEnqueued?.({
      turn,
      maxTurns: MAX_GOAL_CONTINUATIONS,
      objective: updatedGoal.objective,
    })
  }, [
    options.isLoading,
    options.wasAborted,
    options.queuedCommandsLength,
    options.hasActiveLocalJsxUI,
    options.isInPlanMode,
    options.isQueryActiveNow,
    options.onContinuationEnqueued,
    options.onMaxTurnsReached,
    options.onBudgetLimitReached,
    goalRevision,
  ])
}
