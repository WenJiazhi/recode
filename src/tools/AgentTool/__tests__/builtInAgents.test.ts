import { afterEach, describe, expect, test } from 'bun:test'
import { areExplorePlanAgentsEnabled } from '../builtInAgents.js'

const ORIGINAL_EXPLORE_PLAN = process.env.FEATURE_BUILTIN_EXPLORE_PLAN_AGENTS

afterEach(() => {
  if (ORIGINAL_EXPLORE_PLAN === undefined) {
    delete process.env.FEATURE_BUILTIN_EXPLORE_PLAN_AGENTS
  } else {
    process.env.FEATURE_BUILTIN_EXPLORE_PLAN_AGENTS =
      ORIGINAL_EXPLORE_PLAN
  }
})

describe('built-in explore/plan agent gate', () => {
  test('enables explore/plan agents from source-first env fallback', () => {
    process.env.FEATURE_BUILTIN_EXPLORE_PLAN_AGENTS = '1'
    expect(areExplorePlanAgentsEnabled()).toBe(true)
  })
})
