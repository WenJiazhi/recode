import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getApiKeyFromFd,
  getFlagSettingsInline,
  setApiKeyFromFd,
  setFlagSettingsInline,
} from '../../bootstrap/state'
import { applyLocalProviderConfig } from '../localProviderConfig'
import { persistPortableSettingsOrFallback } from '../portableProviderConfig'

const envSnapshot = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL,
  claudeCodeProviderManagedByHost:
    process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST,
  claudeCodeUseBedrock: process.env.CLAUDE_CODE_USE_BEDROCK,
  claudeCodeUseVertex: process.env.CLAUDE_CODE_USE_VERTEX,
  claudeCodeUseFoundry: process.env.CLAUDE_CODE_USE_FOUNDRY,
  recodeProviderType: process.env.RECODE_PROVIDER_TYPE,
  recodeLocalProviderConfig: process.env.RECODE_LOCAL_PROVIDER_CONFIG,
}

const tempDirs: string[] = []

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = envSnapshot.anthropicApiKey
  process.env.ANTHROPIC_BASE_URL = envSnapshot.anthropicBaseUrl
  process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST =
    envSnapshot.claudeCodeProviderManagedByHost
  process.env.CLAUDE_CODE_USE_BEDROCK = envSnapshot.claudeCodeUseBedrock
  process.env.CLAUDE_CODE_USE_VERTEX = envSnapshot.claudeCodeUseVertex
  process.env.CLAUDE_CODE_USE_FOUNDRY = envSnapshot.claudeCodeUseFoundry
  process.env.RECODE_PROVIDER_TYPE = envSnapshot.recodeProviderType
  process.env.RECODE_LOCAL_PROVIDER_CONFIG = envSnapshot.recodeLocalProviderConfig
  setApiKeyFromFd(null)
  setFlagSettingsInline(null)
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function createProviderFiles(
  config: Record<string, unknown>,
  apiKey = 'test-key',
): string {
  const dir = mkdtempSync(join(tmpdir(), 'recode-local-provider-'))
  const recodeDir = join(dir, '.recode')
  mkdirSync(recodeDir, { recursive: true })
  writeFileSync(
    join(recodeDir, 'local-provider.json'),
    JSON.stringify(config),
    'utf8',
  )
  writeFileSync(join(recodeDir, 'api-key.txt'), apiKey, 'utf8')
  tempDirs.push(dir)
  return dir
}

describe('applyLocalProviderConfig', () => {
  test('loads base URL and api key from project-local files', () => {
    const dir = createProviderFiles({
      providerType: 'cpa',
      baseURL: 'https://cpa.cpapi.app',
      apiKeyFile: './api-key.txt',
    })
    process.env.RECODE_LOCAL_PROVIDER_CONFIG = join(
      dir,
      '.recode',
      'local-provider.json',
    )

    const result = applyLocalProviderConfig(dir)

    expect(result.loaded).toBe(true)
    expect(result.hasApiKey).toBe(true)
    expect(result.providerType).toBe('cpa')
    expect(process.env.ANTHROPIC_BASE_URL).toBe('https://cpa.cpapi.app')
    expect(process.env.ANTHROPIC_API_KEY).toBe('test-key')
    expect(process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST).toBe('1')
    expect(process.env.RECODE_PROVIDER_TYPE).toBe('cpa')
    expect(getApiKeyFromFd()).toBe('test-key')
  })

  test('accepts inline apiKey in config file', () => {
    const dir = createProviderFiles({
      providerType: 'cpa',
      baseURL: 'https://cpa.cpapi.app',
      apiKey: 'inline-key',
    })
    process.env.RECODE_LOCAL_PROVIDER_CONFIG = join(
      dir,
      '.recode',
      'local-provider.json',
    )

    const result = applyLocalProviderConfig(dir)

    expect(result.loaded).toBe(true)
    expect(result.hasApiKey).toBe(true)
    expect(process.env.ANTHROPIC_API_KEY).toBe('inline-key')
    expect(getApiKeyFromFd()).toBe('inline-key')
  })

  test('loads from an explicit portable config path outside the current cwd', () => {
    const dir = createProviderFiles({
      providerType: 'cpa',
      baseURL: 'https://cpa.cpapi.app',
      apiKeyFile: './api-key.txt',
    })
    process.env.RECODE_LOCAL_PROVIDER_CONFIG = join(
      dir,
      '.recode',
      'local-provider.json',
    )

    const result = applyLocalProviderConfig(join(tmpdir(), 'unrelated-cwd'))
    expect(result.loaded).toBe(true)
    expect(process.env.ANTHROPIC_BASE_URL).toBe('https://cpa.cpapi.app')
    expect(getApiKeyFromFd()).toBe('test-key')
  })

  test('loads inline settings from portable config', () => {
    const dir = createProviderFiles({
      providerType: 'cpa',
      baseURL: 'https://cpapi.app',
      apiKeyFile: './api-key.txt',
      settings: {
        effortLevel: 'high',
        customModelAliasMappings: {
          opus: { model: 'gpt-5.4', thinking: 'high' },
          sonnet: { model: 'gpt-5.4', thinking: 'medium' },
          haiku: { model: 'gpt-5.4-mini', thinking: 'minimal' },
        },
      },
    })
    process.env.RECODE_LOCAL_PROVIDER_CONFIG = join(
      dir,
      '.recode',
      'local-provider.json',
    )

    const result = applyLocalProviderConfig(dir)

    expect(result.loaded).toBe(true)
    expect(getFlagSettingsInline()).toEqual({
      effortLevel: 'high',
      customModelAliasMappings: {
        opus: { model: 'gpt-5.4', thinking: 'high' },
        sonnet: { model: 'gpt-5.4', thinking: 'medium' },
        haiku: { model: 'gpt-5.4-mini', thinking: 'minimal' },
      },
    })
  })

  test('persists command-side settings into portable config instead of user settings', () => {
    const dir = createProviderFiles({
      providerType: 'cpa',
      baseURL: 'https://cpapi.app',
      apiKeyFile: './api-key.txt',
      settings: {
        effortLevel: 'high',
      },
    })
    process.env.RECODE_LOCAL_PROVIDER_CONFIG = join(
      dir,
      '.recode',
      'local-provider.json',
    )

    const result = persistPortableSettingsOrFallback(
      {
        customModelAliasMappings: {
          opus: { model: 'gpt-5.4', thinking: 'high' },
        },
      },
      dir,
    )

    expect(result.error).toBeNull()
    expect(result.target).toBe('portableConfig')

    const saved = JSON.parse(
      readFileSync(join(dir, '.recode', 'local-provider.json'), 'utf8'),
    ) as {
      settings: Record<string, unknown>
    }

    expect(saved.settings).toEqual({
      effortLevel: 'high',
      customModelAliasMappings: {
        opus: { model: 'gpt-5.4', thinking: 'high' },
      },
    })
  })

  test('returns a clear error when portable-only persistence is requested without config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'recode-local-provider-empty-'))
    tempDirs.push(dir)

    const result = persistPortableSettingsOrFallback(
      {
        customModelAliasMappings: {
          opus: { model: 'gpt-5.4', thinking: 'high' },
        },
      },
      dir,
      'portableConfig',
    )

    expect(result.target).toBe('portableConfig')
    expect(result.error?.message).toContain(
      '.recode/local-provider.json',
    )
  })

  test('local provider config overrides ambient provider selection', () => {
    const dir = createProviderFiles({
      providerType: 'cpa',
      baseURL: 'https://cpa.cpapi.app',
      apiKeyFile: './api-key.txt',
    })
    process.env.RECODE_LOCAL_PROVIDER_CONFIG = join(
      dir,
      '.recode',
      'local-provider.json',
    )
    process.env.CLAUDE_CODE_USE_BEDROCK = '1'
    process.env.CLAUDE_CODE_USE_VERTEX = '1'
    process.env.CLAUDE_CODE_USE_FOUNDRY = '1'

    const result = applyLocalProviderConfig(dir)

    expect(result.loaded).toBe(true)
    expect(process.env.CLAUDE_CODE_USE_BEDROCK).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_VERTEX).toBeUndefined()
    expect(process.env.CLAUDE_CODE_USE_FOUNDRY).toBeUndefined()
    expect(process.env.RECODE_PROVIDER_TYPE).toBe('cpa')
  })
})
