import { Database } from 'bun:sqlite'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

export const DEFAULT_PROVIDER_CATALOG_DATABASE = resolve(
  homedir(),
  '.cc-switch',
  'cc-switch.db',
)

type CatalogRow = {
  id: string
  name: string
  settings_config: string
  category: string | null
  meta: string | null
  is_current: number
  sort_index: number | null
}

export type ExternalProviderCatalogEntry = {
  id: string
  name: string
  category?: string
  isExternalCurrent: boolean
  baseUrl?: string
  defaultModel?: string
  opusModel?: string
  sonnetModel?: string
  haikuModel?: string
  environment: Record<string, string>
  compatible: boolean
  incompatibilityReason?: string
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try {
    return asObject(JSON.parse(value))
  } catch {
    return null
  }
}

function stringEnvironment(value: unknown): Record<string, string> {
  const object = asObject(value)
  if (!object) return {}

  return Object.fromEntries(
    Object.entries(object).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

function validateCompatibility(
  settings: Record<string, unknown> | null,
  meta: Record<string, unknown> | null,
  environment: Record<string, string>,
): string | undefined {
  if (!settings) return 'Invalid provider configuration'

  const apiFormat = meta?.apiFormat ?? settings.api_format ?? settings.apiFormat
  if (
    typeof apiFormat === 'string' &&
    apiFormat.length > 0 &&
    apiFormat !== 'anthropic'
  ) {
    return `Requires ${apiFormat} protocol conversion`
  }

  const providerType = meta?.providerType
  if (
    providerType === 'github_copilot' ||
    providerType === 'codex_oauth' ||
    providerType === 'official_subscription'
  ) {
    return 'Requires managed account authentication'
  }

  const baseUrl = environment.ANTHROPIC_BASE_URL
  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'Provider URL must use HTTP or HTTPS'
      }
    } catch {
      return 'Provider URL is invalid'
    }
  }

  if (!environment.ANTHROPIC_API_KEY && !environment.ANTHROPIC_AUTH_TOKEN) {
    return 'No API-key authentication is configured'
  }

  return undefined
}

function rowToEntry(row: CatalogRow): ExternalProviderCatalogEntry {
  const settings = parseObject(row.settings_config)
  const meta = parseObject(row.meta)
  const environment = stringEnvironment(settings?.env)
  const incompatibilityReason = validateCompatibility(
    settings,
    meta,
    environment,
  )

  return {
    id: row.id,
    name: row.name,
    ...(row.category ? { category: row.category } : {}),
    isExternalCurrent: row.is_current === 1,
    ...(environment.ANTHROPIC_BASE_URL
      ? { baseUrl: environment.ANTHROPIC_BASE_URL }
      : {}),
    ...(environment.ANTHROPIC_MODEL
      ? { defaultModel: environment.ANTHROPIC_MODEL }
      : {}),
    ...(environment.ANTHROPIC_DEFAULT_OPUS_MODEL
      ? { opusModel: environment.ANTHROPIC_DEFAULT_OPUS_MODEL }
      : {}),
    ...(environment.ANTHROPIC_DEFAULT_SONNET_MODEL
      ? { sonnetModel: environment.ANTHROPIC_DEFAULT_SONNET_MODEL }
      : {}),
    ...(environment.ANTHROPIC_DEFAULT_HAIKU_MODEL
      ? { haikuModel: environment.ANTHROPIC_DEFAULT_HAIKU_MODEL }
      : {}),
    environment,
    compatible: incompatibilityReason === undefined,
    ...(incompatibilityReason ? { incompatibilityReason } : {}),
  }
}

export function getProviderCatalogDatabasePath(explicitPath?: string): string {
  return resolve(
    explicitPath ??
      process.env.RECODE_PROVIDER_CATALOG_DB ??
      DEFAULT_PROVIDER_CATALOG_DATABASE,
  )
}

export function listExternalProviderCatalog(
  explicitPath?: string,
): ExternalProviderCatalogEntry[] {
  const databasePath = getProviderCatalogDatabasePath(explicitPath)
  if (!existsSync(databasePath)) {
    throw new Error(`Provider catalog database not found: ${databasePath}`)
  }

  const database = new Database(databasePath, {
    readonly: true,
    strict: true,
  })
  try {
    const rows = database
      .query(
        `SELECT id, name, settings_config, category, meta, is_current, sort_index
         FROM providers
         WHERE app_type = 'claude'
         ORDER BY is_current DESC, sort_index ASC, name COLLATE NOCASE ASC`,
      )
      .all() as CatalogRow[]
    return rows.map(rowToEntry)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to read provider catalog: ${detail}`)
  } finally {
    database.close()
  }
}

export function getExternalProviderCatalogEntry(
  providerId: string,
  explicitPath?: string,
): ExternalProviderCatalogEntry {
  const provider = listExternalProviderCatalog(explicitPath).find(
    entry => entry.id === providerId,
  )
  if (!provider) {
    throw new Error(`Provider '${providerId}' was not found in the catalog`)
  }
  return provider
}
