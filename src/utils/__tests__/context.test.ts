import { afterEach, describe, expect, test } from 'bun:test'
import { getContextWindowForModel, MODEL_CONTEXT_WINDOW_DEFAULT } from '../context.js'

const ORIGINAL_MAX_CONTEXT = process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS

afterEach(() => {
  if (ORIGINAL_MAX_CONTEXT === undefined) {
    delete process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS
    return
  }
  process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS = ORIGINAL_MAX_CONTEXT
})

describe('getContextWindowForModel', () => {
  test('respects CLAUDE_CODE_MAX_CONTEXT_TOKENS outside ant builds', () => {
    delete process.env.USER_TYPE
    process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS = '258000'
    expect(getContextWindowForModel('gpt-5.4')).toBe(258000)
  })

  test('falls back to default when override is invalid', () => {
    process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS = 'invalid'
    expect(getContextWindowForModel('gpt-5.4')).toBe(MODEL_CONTEXT_WINDOW_DEFAULT)
  })
})
