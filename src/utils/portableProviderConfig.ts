import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs'
import { homedir } from 'os'
import { dirname, join, resolve } from 'path'
import { updateSettingsForSource } from './settings/settings.js'
import type { SettingsJson } from './settings/types.js'

export const DEFAULT_LOCAL_PROVIDER_CONFIG_RELATIVE_PATH =
  '.recode/local-provider.json'

export type LocalProviderConfig = {
  enabled?: boolean
  configSource?: 'claude' | 'recode'
  catalogProviderId?: string
  catalogDatabasePath?: string
  providerType?: string
  baseURL?: string
  apiKey?: string
  apiKeyFile?: string
  settings?: SettingsJson
}

export type PortableSettingsTarget = 'auto' | 'portableConfig' | 'userSettings'

const LOCAL_PROVIDER_TYPES = new Set(['anthropic', 'cpa', 'openai'])

function assertOptionalFieldType(
  config: Record<string, unknown>,
  field: string,
  expectedType: 'boolean' | 'string',
): void {
  const value = config[field]
  if (value !== undefined && typeof value !== expectedType) {
    throw new Error(`${field} must be a ${expectedType}`)
  }
}

function hasProjectMarkers(path: string): boolean {
  return existsSync(join(path, 'package.json')) && existsSync(join(path, 'src'))
}

function detectInstallRoot(): string | null {
  const entry = process.argv[1]
  if (!entry) {
    return null
  }

  let current = resolve(dirname(entry))
  const resolvedEntry = resolve(entry)
  if (resolvedEntry.endsWith(`${join('dist', 'cli.js')}`)) {
    current = dirname(current)
  } else if (
    resolvedEntry.endsWith(`${join('src', 'entrypoints', 'cli.tsx')}`) ||
    resolvedEntry.endsWith(`${join('src', 'entrypoints', 'cli.js')}`)
  ) {
    current = resolve(current, '../..')
  }

  let cursor = current
  while (true) {
    if (hasProjectMarkers(cursor)) {
      return cursor
    }
    const parent = dirname(cursor)
    if (parent === cursor) {
      return null
    }
    cursor = parent
  }
}

function normalizeConfig(raw: unknown): LocalProviderConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('the root value must be a JSON object')
  }

  const config = raw as Record<string, unknown>
  assertOptionalFieldType(config, 'enabled', 'boolean')
  assertOptionalFieldType(config, 'configSource', 'string')
  assertOptionalFieldType(config, 'catalogProviderId', 'string')
  assertOptionalFieldType(config, 'catalogDatabasePath', 'string')
  assertOptionalFieldType(config, 'providerType', 'string')
  assertOptionalFieldType(config, 'provider', 'string')
  assertOptionalFieldType(config, 'baseURL', 'string')
  assertOptionalFieldType(config, 'baseUrl', 'string')
  assertOptionalFieldType(config, 'apiKey', 'string')
  assertOptionalFieldType(config, 'apiKeyFile', 'string')

  const normalized: LocalProviderConfig = {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : undefined,
    configSource:
      config.configSource === 'claude' || config.configSource === 'recode'
        ? config.configSource
        : undefined,
    catalogProviderId:
      typeof config.catalogProviderId === 'string'
        ? config.catalogProviderId.trim()
        : undefined,
    catalogDatabasePath:
      typeof config.catalogDatabasePath === 'string'
        ? config.catalogDatabasePath.trim()
        : undefined,
    providerType:
      typeof config.providerType === 'string'
        ? config.providerType.trim().toLowerCase()
        : typeof config.provider === 'string'
          ? config.provider.trim().toLowerCase()
          : undefined,
    baseURL:
      typeof config.baseURL === 'string'
        ? config.baseURL.trim()
        : typeof config.baseUrl === 'string'
          ? config.baseUrl.trim()
          : undefined,
    apiKey:
      typeof config.apiKey === 'string' ? config.apiKey.trim() : undefined,
    apiKeyFile:
      typeof config.apiKeyFile === 'string'
        ? config.apiKeyFile.trim()
        : undefined,
    settings:
      config.settings &&
      typeof config.settings === 'object' &&
      !Array.isArray(config.settings)
        ? (config.settings as SettingsJson)
        : undefined,
  }

  if (
    config.configSource !== undefined &&
    normalized.configSource === undefined
  ) {
    throw new Error('configSource must be one of: claude, recode')
  }

  if (config.catalogProviderId !== undefined && !normalized.catalogProviderId) {
    throw new Error('catalogProviderId must not be empty')
  }

  if (
    config.catalogDatabasePath !== undefined &&
    !normalized.catalogDatabasePath
  ) {
    throw new Error('catalogDatabasePath must not be empty')
  }

  if (
    normalized.providerType &&
    !LOCAL_PROVIDER_TYPES.has(normalized.providerType)
  ) {
    throw new Error(
      `providerType must be one of: ${[...LOCAL_PROVIDER_TYPES].join(', ')}`,
    )
  }

  if (
    (config.providerType !== undefined || config.provider !== undefined) &&
    !normalized.providerType
  ) {
    throw new Error('providerType must not be empty')
  }

  if (normalized.baseURL) {
    let url: URL
    try {
      url = new URL(normalized.baseURL)
    } catch {
      throw new Error('baseURL must be a valid absolute URL')
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('baseURL must use http or https')
    }
    if (url.username || url.password) {
      throw new Error('baseURL must not contain embedded credentials')
    }
  }

  if (
    (config.baseURL !== undefined || config.baseUrl !== undefined) &&
    !normalized.baseURL
  ) {
    throw new Error('baseURL must not be empty')
  }

  if (config.apiKeyFile !== undefined && !normalized.apiKeyFile) {
    throw new Error('apiKeyFile must not be empty')
  }

  if (config.settings !== undefined && normalized.settings === undefined) {
    throw new Error('settings must be a JSON object')
  }

  return normalized
}

function getCandidateConfigPaths(baseDir: string): string[] {
  const explicitConfigPath = process.env.RECODE_LOCAL_PROVIDER_CONFIG
  if (explicitConfigPath) {
    return [resolve(baseDir, explicitConfigPath)]
  }

  return Array.from(
    new Set(
      [baseDir, homedir(), detectInstallRoot()]
        .filter((value): value is string => Boolean(value))
        .map(root =>
          resolve(root, DEFAULT_LOCAL_PROVIDER_CONFIG_RELATIVE_PATH),
        ),
    ),
  )
}

export function findLocalProviderConfigPath(
  baseDir = process.cwd(),
): string | null {
  return getCandidateConfigPaths(baseDir).find(path => existsSync(path)) ?? null
}

export function readLocalProviderConfig(baseDir = process.cwd()): {
  configPath: string
  config: LocalProviderConfig | null
} {
  const configPath =
    findLocalProviderConfigPath(baseDir) ??
    getCandidateConfigPaths(baseDir)[0] ??
    ''

  if (!configPath || !existsSync(configPath)) {
    return { configPath, config: null }
  }

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`invalid JSON in ${configPath}: ${detail}`)
  }

  let config: LocalProviderConfig | null
  try {
    config = normalizeConfig(raw)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`invalid provider config in ${configPath}: ${detail}`)
  }

  return {
    configPath,
    config,
  }
}

export function persistLocalProviderConfig(
  updates: Partial<LocalProviderConfig>,
  baseDir = process.cwd(),
  fallbackScope: 'project' | 'user' = 'project',
): { configPath: string; error: Error | null } {
  let configPath: string
  let config: LocalProviderConfig | null
  try {
    ;({ configPath, config } = readLocalProviderConfig(baseDir))
    if (!config && fallbackScope === 'user') {
      configPath = resolve(
        homedir(),
        DEFAULT_LOCAL_PROVIDER_CONFIG_RELATIVE_PATH,
      )
    }
  } catch (error) {
    return {
      configPath: findLocalProviderConfigPath(baseDir) ?? '',
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }

  try {
    mkdirSync(dirname(configPath), { recursive: true })
    const nextConfig: LocalProviderConfig = {
      enabled: true,
      ...(config ?? {}),
      ...updates,
    }
    const temporaryPath = `${configPath}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(
      temporaryPath,
      `${JSON.stringify(nextConfig, null, 2)}\n`,
      'utf8',
    )
    renameSync(temporaryPath, configPath)
    return { configPath, error: null }
  } catch (error) {
    return {
      configPath,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

function mergePortableSettings(
  current: SettingsJson | undefined,
  updates: SettingsJson,
): SettingsJson {
  const next: SettingsJson = {
    ...(current ?? {}),
  }

  for (const [key, value] of Object.entries(updates) as Array<
    [keyof SettingsJson, SettingsJson[keyof SettingsJson]]
  >) {
    if (value === undefined) {
      delete next[key]
      continue
    }
    next[key] = value
  }

  return next
}

export function persistPortableSettingsOrFallback(
  updates: SettingsJson,
  baseDir = process.cwd(),
  target: PortableSettingsTarget = 'auto',
): {
  error: Error | null
  target: 'portableConfig' | 'userSettings'
} {
  let configPath: string
  let config: LocalProviderConfig | null
  try {
    ;({ configPath, config } = readLocalProviderConfig(baseDir))
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      target: 'portableConfig',
    }
  }
  const canUsePortableConfig = Boolean(
    configPath && config && config.enabled !== false,
  )

  if (target === 'portableConfig' && !canUsePortableConfig) {
    return {
      error: new Error(
        'No enabled project-local provider config found at .recode/local-provider.json.',
      ),
      target: 'portableConfig',
    }
  }

  if (target !== 'userSettings' && canUsePortableConfig) {
    try {
      const nextConfig: LocalProviderConfig = {
        ...config,
        settings: mergePortableSettings(config.settings, updates),
      }
      writeFileSync(
        configPath,
        `${JSON.stringify(nextConfig, null, 2)}\n`,
        'utf8',
      )
      return { error: null, target: 'portableConfig' }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error(String(error)),
        target: 'portableConfig',
      }
    }
  }

  const result = updateSettingsForSource('userSettings', updates)
  return {
    error: result.error,
    target: 'userSettings',
  }
}
