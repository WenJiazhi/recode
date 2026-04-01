import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import {
  getFlagSettingsInline,
  setApiKeyFromFd,
  setFlagSettingsInline,
} from '../bootstrap/state.js'
import { logForDebugging } from './debug.js'
import { errorMessage } from './errors.js'
import {
  DEFAULT_LOCAL_PROVIDER_CONFIG_RELATIVE_PATH,
  readLocalProviderConfig,
} from './portableProviderConfig.js'

export { DEFAULT_LOCAL_PROVIDER_CONFIG_RELATIVE_PATH }

function readTrimmedFileIfExists(path: string): string | null {
  try {
    const value = readFileSync(path, 'utf8').trim()
    return value.length > 0 ? value : null
  } catch {
    return null
  }
}

export function applyLocalProviderConfig(baseDir = process.cwd()): {
  configPath: string
  loaded: boolean
  hasApiKey: boolean
  providerType?: string
  baseURL?: string
} {
  const { configPath, config } = readLocalProviderConfig(baseDir)

  if (!configPath || !config || config.enabled === false) {
    return {
      configPath,
      loaded: false,
      hasApiKey: false,
    }
  }

  try {
    // When the project-local provider config is active, it is the single
    // source of truth for provider routing. Clear conflicting ambient provider
    // selectors before applying the local values.
    process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST = '1'
    delete process.env.CLAUDE_CODE_USE_BEDROCK
    delete process.env.CLAUDE_CODE_USE_VERTEX
    delete process.env.CLAUDE_CODE_USE_FOUNDRY
    delete process.env.RECODE_PROVIDER_TYPE

    if (config.baseURL) {
      process.env.ANTHROPIC_BASE_URL = config.baseURL
    }
    if (config.providerType) {
      process.env.RECODE_PROVIDER_TYPE = config.providerType
    }

    let apiKey = config.apiKey?.trim() || null
    if (!apiKey && config.apiKeyFile) {
      const apiKeyPath = resolve(dirname(configPath), config.apiKeyFile)
      apiKey = readTrimmedFileIfExists(apiKeyPath)
    }

    if (apiKey) {
      process.env.ANTHROPIC_API_KEY = apiKey
      setApiKeyFromFd(apiKey)
    } else {
      setApiKeyFromFd(null)
    }

    const nextInlineSettings = config.settings
      ? {
          ...(getFlagSettingsInline() ?? {}),
          ...config.settings,
        }
      : null
    setFlagSettingsInline(nextInlineSettings)

    logForDebugging(
      `[local-provider] loaded config from ${configPath} (baseURL=${config.baseURL ?? 'unset'}, hasApiKey=${Boolean(apiKey)}, hasSettings=${Boolean(config.settings)})`,
    )

    return {
      configPath:
        configPath || DEFAULT_LOCAL_PROVIDER_CONFIG_RELATIVE_PATH,
      loaded: true,
      hasApiKey: Boolean(apiKey),
      providerType: config.providerType,
      baseURL: config.baseURL,
    }
  } catch (error) {
    logForDebugging(
      `[local-provider] failed to load config from ${configPath}: ${errorMessage(error)}`,
      { level: 'error' },
    )
    return { configPath, loaded: false, hasApiKey: false }
  }
}
