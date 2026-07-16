import { beforeEach, describe, expect, test } from 'bun:test'
import type { BetaUsage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import { addToTotalSessionCost, resetCostState } from '../../../cost-tracker.js'
import { _clearAllGoalsForTesting, getGoal, setGoal } from '../goalState.js'

beforeEach(() => {
  resetCostState()
  _clearAllGoalsForTesting()
})

describe('Goal token accounting', () => {
  test('uses the same normalized API usage recorded by the session cost tracker', () => {
    setGoal('bounded API work', { tokenBudget: 25 })
    const usage = {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 7,
      cache_creation_input_tokens: 4,
      server_tool_use: {
        web_search_requests: 0,
        web_fetch_requests: 0,
      },
      cache_creation: {
        ephemeral_1h_input_tokens: 0,
        ephemeral_5m_input_tokens: 4,
      },
      service_tier: null,
      inference_geo: null,
      iterations: null,
      speed: null,
    } as BetaUsage

    addToTotalSessionCost(0, usage, 'test-model')

    expect(getGoal()?.tokensUsed).toBe(26)
    expect(getGoal()?.status).toBe('budget_limited')
  })
})
