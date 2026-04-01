import { afterEach, describe, expect, test } from 'bun:test'
import { isCpaBaseUrl, isFirstPartyAnthropicBaseUrl } from '../model/providers'

const originalBaseUrl = process.env.ANTHROPIC_BASE_URL

afterEach(() => {
  process.env.ANTHROPIC_BASE_URL = originalBaseUrl
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
})
