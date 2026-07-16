import { afterEach, describe, expect, test } from 'bun:test'
import { isAgentTriggersFeatureEnabled } from '../agentTriggersFeatureEnabled.js'
import { isAgentTriggersRemoteFeatureEnabled } from '../agentTriggersRemoteFeatureEnabled.js'

const ORIGINAL_AGENT_TRIGGERS = process.env.FEATURE_AGENT_TRIGGERS
const ORIGINAL_AGENT_TRIGGERS_REMOTE =
  process.env.FEATURE_AGENT_TRIGGERS_REMOTE

afterEach(() => {
  if (ORIGINAL_AGENT_TRIGGERS === undefined) {
    delete process.env.FEATURE_AGENT_TRIGGERS
  } else {
    process.env.FEATURE_AGENT_TRIGGERS = ORIGINAL_AGENT_TRIGGERS
  }

  if (ORIGINAL_AGENT_TRIGGERS_REMOTE === undefined) {
    delete process.env.FEATURE_AGENT_TRIGGERS_REMOTE
  } else {
    process.env.FEATURE_AGENT_TRIGGERS_REMOTE =
      ORIGINAL_AGENT_TRIGGERS_REMOTE
  }
})

describe('agent trigger feature helpers', () => {
  test('enables AGENT_TRIGGERS from source-first env fallback', () => {
    process.env.FEATURE_AGENT_TRIGGERS = '1'
    expect(isAgentTriggersFeatureEnabled()).toBe(true)
  })

  test('enables AGENT_TRIGGERS_REMOTE from source-first env fallback', () => {
    process.env.FEATURE_AGENT_TRIGGERS_REMOTE = '1'
    expect(isAgentTriggersRemoteFeatureEnabled()).toBe(true)
  })
})
