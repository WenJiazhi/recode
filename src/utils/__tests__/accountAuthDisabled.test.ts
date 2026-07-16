import { afterEach, expect, test } from 'bun:test'
import { ANTHROPIC_ACCOUNT_AUTH_ENABLED } from '../../constants/capabilities.js'
import {
  clearOAuthTokenCache,
  getAnthropicApiKeyWithSource,
  getClaudeAIOAuthTokens,
  isAnthropicAuthEnabled,
  isClaudeAISubscriber,
} from '../auth.js'

const originalEnvironment = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

afterEach(() => {
  restoreEnvironment('ANTHROPIC_API_KEY', originalEnvironment.apiKey)
  restoreEnvironment('CLAUDE_CODE_OAUTH_TOKEN', originalEnvironment.oauthToken)
  clearOAuthTokenCache()
})

test('current build disables account OAuth and ignores account tokens', () => {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = 'account-token-must-not-be-used'
  clearOAuthTokenCache()

  expect(ANTHROPIC_ACCOUNT_AUTH_ENABLED).toBe(false)
  expect(isAnthropicAuthEnabled()).toBe(false)
  expect(getClaudeAIOAuthTokens()).toBeNull()
  expect(isClaudeAISubscriber()).toBe(false)
})

test('current build accepts an explicit API key without account state', () => {
  process.env.ANTHROPIC_API_KEY = 'third-party-api-key'

  expect(getAnthropicApiKeyWithSource()).toEqual({
    key: 'third-party-api-key',
    source: 'ANTHROPIC_API_KEY',
  })
})
