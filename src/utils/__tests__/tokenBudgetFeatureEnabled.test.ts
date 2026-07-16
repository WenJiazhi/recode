import { afterEach, describe, expect, it } from 'bun:test'
import { isTokenBudgetFeatureEnabled } from '../tokenBudgetFeatureEnabled.js'

describe('isTokenBudgetFeatureEnabled', () => {
  afterEach(() => {
    delete process.env.FEATURE_TOKEN_BUDGET
  })

  it('is false by default in source-first tests', () => {
    expect(isTokenBudgetFeatureEnabled()).toBe(false)
  })

  it('honors FEATURE_TOKEN_BUDGET in source-first tests', () => {
    process.env.FEATURE_TOKEN_BUDGET = '1'
    expect(isTokenBudgetFeatureEnabled()).toBe(true)
  })
})
