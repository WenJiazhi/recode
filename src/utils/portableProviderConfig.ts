import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { updateSettingsForSource } from './settings/settings.js'
import type { SettingsJson } from './settings/types.js'

export const DEFAULT_LOCAL_PROVIDER_CONFIG_RELATIVE_PATH =
  '.recode/local-provider.json'

export type LocalProviderConfig = {
  enabled?: boolean
  providerType?: string
  baseURL?: string
  apiKey?: string
  apiKeyFile?: string
  settings?: SettingsJson
}

export type PortableSettingsTarget =
  | 'auto'
  | 'portableConfig'
  | 'userSettings'

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
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const config = raw as Record<string, unknown>
  return {
    enabled:
      typeof config.enabled === 'boolean' ? config.enabled : undefined,
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
      config.settings && typeof config.settings === 'object'
        ? (config.settings as SettingsJson)
        : undefined,
  }
}

function getCandidateConfigPaths(baseDir: string): string[] {
  const explicitConfigPath = process.env.RECODE_LOCAL_PROVIDER_CONFIG
  if (explicitConfigPath) {
    return [resolve(baseDir, explicitConfigPath)]
  }

  return Array.from(
    new Set(
      [baseDir, detectInstallRoot()]
        .filter((value): value is string => Boolean(value))
        .map(root => resolve(root, DEFAULT_LOCAL_PROVIDER_CONFIG_RELATIVE_PATH)),
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
    findLocalProviderConfigPath(baseDir) ?? getCandidateConfigPaths(baseDir)[0] ?? ''

  if (!configPath || !existsSync(configPath)) {
    return { configPath, config: null }
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf8'))
  return {
    configPath,
    config: normalizeConfig(raw),
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
  const { configPath, config } = readLocalProviderConfig(baseDir)
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
      writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')
      return { error: null, target: 'portableConfig' }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error(String(error)),
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
