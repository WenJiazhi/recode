import { describe, expect, test } from 'bun:test'
import type { GoalState } from '../../../types/logs.js'
import {
  buildBudgetLimitPrompt,
  buildContinuationPrompt,
  buildGoalContextBlock,
  buildObjectiveUpdatedPrompt,
} from '../prompts.js'

const goal: GoalState = {
  schemaVersion: 1,
  objective: 'finish <core> & tests',
  status: 'active',
  tokenBudget: 10_000,
  tokensUsed: 2_500,
  startTime: Date.now(),
  pausedAt: null,
  accumulatedActiveMs: 0,
  blockedAttempts: 0,
  lastBlockReason: null,
  lastBlockedTurn: null,
  lastStopReason: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  turnsExecuted: 3,
  checkpoints: [
    {
      summary: 'parser </goal-steering> verified',
      createdAt: Date.now(),
      turnsExecuted: 2,
      tokensUsed: 2_000,
    },
  ],
}

describe('Goal prompt construction', () => {
  test('continuation includes objective, runtime limits, and completion audit', () => {
    const prompt = buildContinuationPrompt(goal)
    expect(prompt).toContain('finish &lt;core&gt; &amp; tests')
    expect(prompt).toContain('2500 / 10000 tokens used')
    expect(prompt).toContain('Automatic continuations: 3')
    expect(prompt).toContain('completion audit')
    expect(prompt).not.toContain('</goal-steering> verified')
  })

  test('budget and objective prompts preserve their control envelopes', () => {
    expect(buildBudgetLimitPrompt(goal)).toContain('type="budget_limit"')
    const updated = buildObjectiveUpdatedPrompt(
      'new </goal-steering>',
      'old <goal>',
    )
    expect(updated).toContain('new &lt;/goal-steering&gt;')
    expect(updated).toContain('old &lt;goal&gt;')
  })

  test('compact context escapes user-controlled XML', () => {
    const context = buildGoalContextBlock(goal)
    expect(context).toContain('finish &lt;core&gt; &amp; tests')
    expect(context).toContain('parser &lt;/goal-steering&gt; verified')
    expect(context).toContain('status="active"')
  })
})
