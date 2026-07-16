import { describe, expect, test } from 'bun:test'
import { parseGoalCommand, parseGoalTokenBudget } from '../goalCommandParser.js'

describe('parseGoalTokenBudget', () => {
  test('supports integer, k, m, and exact decimal suffixes', () => {
    expect(parseGoalTokenBudget('50000')).toBe(50_000)
    expect(parseGoalTokenBudget('80k')).toBe(80_000)
    expect(parseGoalTokenBudget('1m')).toBe(1_000_000)
    expect(parseGoalTokenBudget('1.5k')).toBe(1_500)
  })

  test('rejects zero, fractions, malformed values, and excessive budgets', () => {
    expect(parseGoalTokenBudget('0')).toBeNull()
    expect(parseGoalTokenBudget('1.25')).toBeNull()
    expect(parseGoalTokenBudget('80kb')).toBeNull()
    expect(parseGoalTokenBudget('101m')).toBeNull()
  })
})

describe('parseGoalCommand', () => {
  test('uses an empty invocation for status', () => {
    expect(parseGoalCommand('')).toEqual({ action: 'status' })
  })

  test('parses a direct objective and optional creation budget', () => {
    expect(parseGoalCommand('ship a tested release')).toEqual({
      action: 'set',
      objective: 'ship a tested release',
      tokenBudget: null,
    })
    expect(parseGoalCommand('--budget 80k ship a tested release')).toEqual({
      action: 'set',
      objective: 'ship a tested release',
      tokenBudget: 80_000,
    })
    expect(parseGoalCommand('start --tokens=1m implement the feature')).toEqual(
      {
        action: 'set',
        objective: 'implement the feature',
        tokenBudget: 1_000_000,
      },
    )
  })

  test('parses lifecycle controls', () => {
    for (const action of [
      'status',
      'clear',
      'pause',
      'resume',
      'continue',
      'complete',
    ] as const) {
      expect(parseGoalCommand(action)).toEqual({ action })
    }
    expect(parseGoalCommand('checkpoint parser is stable')).toEqual({
      action: 'checkpoint',
      summary: 'parser is stable',
    })
  })

  test('parses budget updates and unlimited mode', () => {
    expect(parseGoalCommand('budget 120k')).toEqual({
      action: 'budget',
      tokenBudget: 120_000,
    })
    expect(parseGoalCommand('budget none')).toEqual({
      action: 'budget',
      tokenBudget: null,
    })
  })

  test('returns actionable errors for incomplete or unknown options', () => {
    expect(parseGoalCommand('checkpoint').action).toBe('error')
    expect(parseGoalCommand('budget').action).toBe('error')
    expect(parseGoalCommand('--budget nope work').action).toBe('error')
    expect(parseGoalCommand('--unknown work').action).toBe('error')
  })

  test('allows reserved control words inside an explicit start objective', () => {
    expect(parseGoalCommand('start pause handling must be tested')).toEqual({
      action: 'set',
      objective: 'pause handling must be tested',
      tokenBudget: null,
    })
  })
})
