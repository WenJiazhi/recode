import { afterEach, describe, expect, it } from 'bun:test'
import { isVerificationAgentFeatureEnabled } from '../verificationAgentFeatureEnabled.js'

describe('isVerificationAgentFeatureEnabled', () => {
  afterEach(() => {
    delete process.env.FEATURE_VERIFICATION_AGENT
  })

  it('is false by default in source-first tests', () => {
    expect(isVerificationAgentFeatureEnabled()).toBe(false)
  })

  it('honors FEATURE_VERIFICATION_AGENT in source-first tests', () => {
    process.env.FEATURE_VERIFICATION_AGENT = '1'
    expect(isVerificationAgentFeatureEnabled()).toBe(true)
  })
})
