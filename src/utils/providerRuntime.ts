import { setApiKeyFromFd } from '../bootstrap/state.js'
import { clearOpenAIClientCache } from '../services/api/openai/client.js'
import {
  clearApiKeyHelperCache,
  clearAwsCredentialsCache,
  clearGcpCredentialsCache,
} from './auth.js'
import {
  getExternalProviderCatalogEntry,
  type ExternalProviderCatalogEntry,
} from './externalProviderCatalog.js'
import { clearProxyCache, configureGlobalAgents } from './proxy.js'
import { getSettingsForSource } from './settings/settings.js'
import { resetSettingsCache } from './settings/settingsCache.js'

export type ProviderConfigSource = 'claude' | 'recode'

let activeProviderConfigSource: ProviderConfigSource | undefined

const PROVIDER_RUNTIME_KEYS = new Set([
  'AWS_BEARER_TOKEN_BEDROCK',
  'AWS_DEFAULT_REGION',
  'AWS_PROFILE',
  'AWS_REGION',
  'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
  'CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY',
  'CLAUDE_CODE_MAX_CONTEXT_TOKENS',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_SKIP_BEDROCK_AUTH',
  'CLAUDE_CODE_SKIP_FOUNDRY_AUTH',
  'CLAUDE_CODE_SKIP_VERTEX_AUTH',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_OPENAI',
  'CLAUDE_CODE_USE_VERTEX',
  'CLOUD_ML_REGION',
  'GCLOUD_PROJECT',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_CLOUD_PROJECT',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_ORG_ID',
  'OPENAI_PROJECT_ID',
  'RECODE_PROVIDER_TYPE',
])

function isProviderRuntimeKey(key: string): boolean {
  const upper = key.toUpperCase()
  return (
    upper.startsWith('ANTHROPIC_') ||
    upper.startsWith('VERTEX_REGION_CLAUDE_') ||
    PROVIDER_RUNTIME_KEYS.has(upper)
  )
}

export function filterProviderRuntimeEnvironment(
  environment: Record<string, string> | undefined,
): Record<string, string> {
  if (!environment) return {}
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => isProviderRuntimeKey(key)),
  )
}

export function replaceProviderRuntimeEnvironment(
  environment: Record<string, string>,
  source: ProviderConfigSource,
): void {
  const nextEnvironment = filterProviderRuntimeEnvironment(environment)

  for (const key of Object.keys(process.env)) {
    if (isProviderRuntimeKey(key)) {
      delete process.env[key]
    }
  }

  Object.assign(process.env, nextEnvironment)
  activeProviderConfigSource = source
  if (source === 'recode') {
    process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST = '1'
  } else {
    delete process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST
  }

  setApiKeyFromFd(nextEnvironment.ANTHROPIC_API_KEY ?? null)
  clearApiKeyHelperCache()
  clearAwsCredentialsCache()
  clearGcpCredentialsCache()
  clearOpenAIClientCache()
  clearProxyCache()
  configureGlobalAgents()
}

export function getActiveProviderConfigSource(): ProviderConfigSource {
  return (
    activeProviderConfigSource ??
    (process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST ? 'recode' : 'claude')
  )
}

export function activateClaudeProviderSource(): {
  source: 'claude'
  environment: Record<string, string>
} {
  resetSettingsCache()
  const environment = filterProviderRuntimeEnvironment(
    getSettingsForSource('userSettings')?.env,
  )
  replaceProviderRuntimeEnvironment(environment, 'claude')
  return { source: 'claude', environment }
}

export function activateCatalogProviderSource(
  providerId: string,
  databasePath?: string,
): ExternalProviderCatalogEntry {
  const provider = getExternalProviderCatalogEntry(providerId, databasePath)
  if (!provider.compatible) {
    throw new Error(
      `${provider.name} cannot be used directly: ${provider.incompatibilityReason}`,
    )
  }
  replaceProviderRuntimeEnvironment(provider.environment, 'recode')
  return provider
}
