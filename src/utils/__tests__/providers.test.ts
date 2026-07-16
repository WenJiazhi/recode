import { afterEach, describe, expect, test } from 'bun:test'
import {
  getAPIProvider,
  isCpaBaseUrl,
  isFirstPartyAnthropicBaseUrl,
} from '../model/providers'

const originalBaseUrl = process.env.ANTHROPIC_BASE_URL
const originalProviderType = process.env.RECODE_PROVIDER_TYPE
const originalUseOpenAI = process.env.CLAUDE_CODE_USE_OPENAI

afterEach(() => {
  process.env.ANTHROPIC_BASE_URL = originalBaseUrl
  process.env.RECODE_PROVIDER_TYPE = originalProviderType
  process.env.CLAUDE_CODE_USE_OPENAI = originalUseOpenAI
})

describe('provider host detection', () => {
  test('detects CPA hosts via cpapi.app domains', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://cpa.cpapi.app'
    expect(isCpaBaseUrl()).toBe(true)
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false)

    process.env.ANTHROPIC_BASE_URL = 'https://cpapi.app/v1'
    expect(isCpaBaseUrl()).toBe(true)
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false)
  })

  test('does not classify Anthropic first-party hosts as CPA', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com'
    expect(isCpaBaseUrl()).toBe(false)
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true)
  })

  test('detects explicit openai provider routing', () => {
    process.env.RECODE_PROVIDER_TYPE = 'openai'
    expect(getAPIProvider()).toBe('openai')

    delete process.env.RECODE_PROVIDER_TYPE
    process.env.CLAUDE_CODE_USE_OPENAI = '1'
    expect(getAPIProvider()).toBe('openai')
  })
})
