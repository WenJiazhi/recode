import { afterEach, describe, expect, it } from 'bun:test'
import { isShotStatsFeatureEnabled } from '../shotStatsFeatureEnabled.js'

describe('isShotStatsFeatureEnabled', () => {
  afterEach(() => {
    delete process.env.FEATURE_SHOT_STATS
  })

  it('is false by default in source-first tests', () => {
    expect(isShotStatsFeatureEnabled()).toBe(false)
  })

  it('honors FEATURE_SHOT_STATS in source-first tests', () => {
    process.env.FEATURE_SHOT_STATS = '1'
    expect(isShotStatsFeatureEnabled()).toBe(true)
  })
})
