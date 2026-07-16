import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  _clearAllGoalsForTesting,
  getGoal,
  incrementGoalTurns,
  pauseGoal,
  setGoal,
  updateGoalTokens,
} from '../../../services/goal/goalState.js'

let persistCalls = 0
mock.module('../../../services/goal/goalStorage.js', () => ({
  persistCurrentGoal: () => {
    persistCalls += 1
  },
}))

const { GoalTool } = await import('../GoalTool.js')

beforeEach(() => {
  _clearAllGoalsForTesting()
  persistCalls = 0
})

describe('GoalTool', () => {
  test('reports that no Goal exists without failing the tool call', async () => {
    const result = await GoalTool.call({ action: 'get' })
    expect(result.data).toEqual({
      success: true,
      message: 'No Goal is active.',
    })
  })

  test('returns a compact active Goal snapshot', async () => {
    setGoal('finish integration', { tokenBudget: 50_000 })
    const result = await GoalTool.call({ action: 'get' })

    expect(result.data.success).toBe(true)
    expect(result.data.goal?.objective).toBe('finish integration')
    expect(result.data.goal?.status).toBe('Active')
    expect(result.data.goal?.tokenBudget).toBe(50_000)
  })

  test('records a milestone checkpoint', async () => {
    setGoal('finish integration')
    const result = await GoalTool.call({
      action: 'checkpoint',
      summary: 'state tests pass',
    })

    expect(result.data.success).toBe(true)
    expect(getGoal()?.checkpoints.at(-1)?.summary).toBe('state tests pass')
    expect(persistCalls).toBe(1)
  })

  test('completes only an active Goal and includes usage evidence', async () => {
    setGoal('finish integration')
    const result = await GoalTool.call({
      action: 'update',
      status: 'complete',
      reason: 'all acceptance checks pass',
    })

    expect(result.data.success).toBe(true)
    expect(result.data.report).toContain('Goal achieved')
    expect(result.data.report).toContain('Token usage:')
    expect(getGoal()?.status).toBe('complete')
    expect(getGoal()?.checkpoints.at(-1)?.summary).toBe(
      'all acceptance checks pass',
    )

    const repeated = await GoalTool.call({
      action: 'update',
      status: 'complete',
      reason: 'repeat',
    })
    expect(repeated.data.success).toBe(false)
  })

  test('can commit verified completion from the budget-ending response', async () => {
    setGoal('finish within budget', { tokenBudget: 10 })
    updateGoalTokens(10)
    expect(getGoal()?.status).toBe('budget_limited')

    const result = await GoalTool.call({
      action: 'update',
      status: 'complete',
      reason: 'the final response proved every acceptance check',
    })

    expect(result.data.success).toBe(true)
    expect(getGoal()?.status).toBe('complete')
    expect(getGoal()?.checkpoints.at(-1)?.summary).toContain('final response')
  })

  test('enforces one blocked report per continuation and three consecutive turns', async () => {
    setGoal('finish integration')

    const first = await GoalTool.call({
      action: 'update',
      status: 'blocked',
      reason: 'missing service',
    })
    const duplicate = await GoalTool.call({
      action: 'update',
      status: 'blocked',
      reason: 'missing service',
    })
    expect(first.data.message).toContain('1/3')
    expect(duplicate.data.message).toContain('already recorded')

    incrementGoalTurns()
    await GoalTool.call({
      action: 'update',
      status: 'blocked',
      reason: 'missing service',
    })
    incrementGoalTurns()
    const third = await GoalTool.call({
      action: 'update',
      status: 'blocked',
      reason: 'missing service',
    })

    expect(third.data.message).toContain('blocked after 3')
    expect(getGoal()?.status).toBe('blocked')
  })

  test('rejects model mutations while the Goal is paused', async () => {
    setGoal('finish integration')
    pauseGoal()

    const result = await GoalTool.call({
      action: 'checkpoint',
      summary: 'should not save',
    })
    expect(result.data.success).toBe(false)

    const update = await GoalTool.call({
      action: 'update',
      status: 'complete',
      reason: 'should not complete',
    })
    expect(update.data.error).toContain('paused')
  })

  test('only read operations are concurrency safe', () => {
    expect(GoalTool.isConcurrencySafe({ action: 'get' })).toBe(true)
    expect(
      GoalTool.isConcurrencySafe({
        action: 'checkpoint',
        summary: 'milestone',
      }),
    ).toBe(false)
  })

  test('strict input schema rejects unknown fields', () => {
    expect(
      GoalTool.inputSchema.safeParse({ action: 'get', unexpected: true })
        .success,
    ).toBe(false)
  })

  test('renders Ink nodes instead of bare result strings', () => {
    expect(
      GoalTool.renderToolResultMessage({
        success: true,
        message: 'checkpoint saved',
      }),
    ).toBeObject()
    expect(GoalTool.renderToolUseRejectedMessage()).toBeObject()
  })
})
