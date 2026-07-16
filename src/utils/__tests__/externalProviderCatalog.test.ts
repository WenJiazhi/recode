import { afterEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  getExternalProviderCatalogEntry,
  listExternalProviderCatalog,
} from '../externalProviderCatalog.js'
import {
  activateCatalogProviderSource,
  replaceProviderRuntimeEnvironment,
} from '../providerRuntime.js'

const originalEnvironment = { ...process.env }
const tempDirectories: string[] = []

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key]
  }
  Object.assign(process.env, originalEnvironment)
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createCatalog(
  providers: Array<{
    id: string
    name: string
    settings: unknown
    meta?: unknown
    current?: boolean
    sortIndex?: number
  }>,
): string {
  const directory = mkdtempSync(join(tmpdir(), 'recode-provider-catalog-'))
  const databasePath = join(directory, 'catalog.db')
  tempDirectories.push(directory)

  const database = new Database(databasePath)
  database.run(`
    CREATE TABLE providers (
      id TEXT NOT NULL,
      app_type TEXT NOT NULL,
      name TEXT NOT NULL,
      settings_config TEXT NOT NULL,
      category TEXT,
      meta TEXT NOT NULL DEFAULT '{}',
      is_current INTEGER NOT NULL DEFAULT 0,
      sort_index INTEGER,
      PRIMARY KEY (id, app_type)
    )
  `)
  const insert = database.query(`
    INSERT INTO providers (
      id, app_type, name, settings_config, category, meta, is_current, sort_index
    ) VALUES (?, 'claude', ?, ?, 'custom', ?, ?, ?)
  `)
  for (const provider of providers) {
    insert.run(
      provider.id,
      provider.name,
      JSON.stringify(provider.settings),
      JSON.stringify(provider.meta ?? {}),
      provider.current ? 1 : 0,
      provider.sortIndex ?? 0,
    )
  }
  database.close()
  return databasePath
}

describe('external provider catalog', () => {
  test('lists Claude providers in catalog order without merging model routes', () => {
    const databasePath = createCatalog([
      {
        id: 'secondary',
        name: 'Secondary',
        sortIndex: 2,
        settings: {
          env: {
            ANTHROPIC_BASE_URL: 'https://secondary.example',
            ANTHROPIC_AUTH_TOKEN: 'secondary-secret',
            ANTHROPIC_MODEL: 'secondary-default',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'secondary-opus[1M]',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'secondary-sonnet',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'secondary-haiku',
          },
        },
      },
      {
        id: 'current',
        name: 'Current',
        current: true,
        sortIndex: 9,
        settings: {
          env: {
            ANTHROPIC_BASE_URL: 'https://current.example',
            ANTHROPIC_API_KEY: 'current-secret',
            ANTHROPIC_MODEL: 'current-default',
          },
        },
      },
    ])

    const providers = listExternalProviderCatalog(databasePath)

    expect(providers.map(provider => provider.id)).toEqual([
      'current',
      'secondary',
    ])
    expect(providers[1]).toMatchObject({
      defaultModel: 'secondary-default',
      opusModel: 'secondary-opus[1M]',
      sonnetModel: 'secondary-sonnet',
      haikuModel: 'secondary-haiku',
      compatible: true,
    })
  })

  test('marks providers requiring protocol conversion as unavailable', () => {
    const databasePath = createCatalog([
      {
        id: 'converted',
        name: 'Converted',
        settings: {
          env: {
            ANTHROPIC_BASE_URL: 'https://converted.example',
            ANTHROPIC_AUTH_TOKEN: 'secret',
          },
        },
        meta: { apiFormat: 'openai_responses' },
      },
    ])

    const provider = getExternalProviderCatalogEntry('converted', databasePath)
    expect(provider.compatible).toBe(false)
    expect(provider.incompatibilityReason).toContain(
      'openai_responses protocol conversion',
    )
  })

  test('hot switching replaces stale provider values', () => {
    replaceProviderRuntimeEnvironment(
      {
        ANTHROPIC_BASE_URL: 'https://first.example',
        ANTHROPIC_AUTH_TOKEN: 'first-secret',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'first-opus',
      },
      'recode',
    )

    replaceProviderRuntimeEnvironment(
      {
        ANTHROPIC_BASE_URL: 'https://second.example',
        ANTHROPIC_API_KEY: 'second-secret',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'second-sonnet',
      },
      'recode',
    )

    expect(process.env.ANTHROPIC_BASE_URL).toBe('https://second.example')
    expect(process.env.ANTHROPIC_API_KEY).toBe('second-secret')
    expect(process.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(process.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBeUndefined()
    expect(process.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('second-sonnet')
    expect(process.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST).toBe('1')
  })

  test('activates a compatible provider directly from the database', () => {
    const databasePath = createCatalog([
      {
        id: 'direct',
        name: 'Direct Provider',
        settings: {
          env: {
            ANTHROPIC_BASE_URL: 'https://direct.example',
            ANTHROPIC_AUTH_TOKEN: 'direct-secret',
            ANTHROPIC_MODEL: 'direct-default',
          },
        },
      },
    ])

    const provider = activateCatalogProviderSource('direct', databasePath)

    expect(provider.name).toBe('Direct Provider')
    expect(process.env.ANTHROPIC_BASE_URL).toBe('https://direct.example')
    expect(process.env.ANTHROPIC_MODEL).toBe('direct-default')
  })
})
