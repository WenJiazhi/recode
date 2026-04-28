import { afterEach, describe, expect, it } from 'bun:test'
import { isPromptCacheBreakFeatureEnabled } from '../promptCacheBreakFeatureEnabled.js'

describe('isPromptCacheBreakFeatureEnabled', () => {
  afterEach(() => {
    delete process.env.FEATURE_PROMPT_CACHE_BREAK_DETECTION
  })

  it('is false by default in source-first tests', () => {
    expect(isPromptCacheBreakFeatureEnabled()).toBe(false)
  })

  it('honors FEATURE_PROMPT_CACHE_BREAK_DETECTION in source-first tests', () => {
    process.env.FEATURE_PROMPT_CACHE_BREAK_DETECTION = '1'
    expect(isPromptCacheBreakFeatureEnabled()).toBe(true)
  })
})
