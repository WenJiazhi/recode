import { afterEach, beforeEach, expect, mock, test } from 'bun:test'

type GlobalConfigState = {
  lspRecommendationDisabled?: boolean
  lspRecommendationNeverPlugins?: string[]
  lspRecommendationIgnoredCount?: number
}

let globalConfigState: GlobalConfigState = {}
let installedPlugins = new Set<string>()
let installedBinaries = new Set<string>()

const marketplaces = {
  'claude-code-plugins': {
    plugins: [
      {
        name: 'typescript-official',
        description: 'Official TypeScript LSP',
        lspServers: {
          tsserver: {
            command: 'typescript-language-server',
            extensionToLanguage: {
              '.ts': 'typescript',
            },
          },
        },
      },
      {
        name: 'external-config-plugin',
        description: 'Uses external lsp config path',
        lspServers: './.lsp.json',
      },
    ],
  },
  'community-marketplace': {
    plugins: [
      {
        name: 'typescript-community',
        description: 'Community TypeScript LSP',
        lspServers: {
          vtsls: {
            command: 'vtsls',
            extensionToLanguage: {
              '.ts': 'typescript',
            },
          },
        },
      },
      {
        name: 'typescript-installed',
        description: 'Already installed plugin',
        lspServers: {
          installed: {
            command: 'already-installed-lsp',
            extensionToLanguage: {
              '.ts': 'typescript',
            },
          },
        },
      },
      {
        name: 'typescript-missing-binary',
        description: 'Binary not installed',
        lspServers: {
          missing: {
            command: 'missing-lsp-binary',
            extensionToLanguage: {
              '.ts': 'typescript',
            },
          },
        },
      },
      {
        name: 'python-community',
        description: 'Community Python LSP',
        lspServers: {
          pyright: {
            command: 'pyright-langserver',
            extensionToLanguage: {
              '.py': 'python',
            },
          },
        },
      },
    ],
  },
}

mock.module('../../config.js', () => ({
  getGlobalConfig: () => globalConfigState,
  saveGlobalConfig: (
    updater: (config: GlobalConfigState) => GlobalConfigState,
  ) => {
    globalConfigState = updater(globalConfigState)
  },
}))

mock.module('../installedPluginsManager.js', () => ({
  isPluginInstalled: (pluginId: string) => installedPlugins.has(pluginId),
}))

mock.module('../../binaryCheck.js', () => ({
  isBinaryInstalled: async (command: string) => installedBinaries.has(command),
}))

mock.module('../marketplaceManager.js', () => ({
  loadKnownMarketplacesConfig: async () => ({
    'claude-code-plugins': {},
    'community-marketplace': {},
  }),
  getMarketplace: async (name: string) => {
    const marketplace = marketplaces[name as keyof typeof marketplaces]
    if (!marketplace) {
      throw new Error(`Unknown marketplace: ${name}`)
    }
    return marketplace
  },
}))

beforeEach(() => {
  globalConfigState = {}
  installedPlugins = new Set()
  installedBinaries = new Set([
    'typescript-language-server',
    'vtsls',
    'already-installed-lsp',
  ])
})

afterEach(() => {
  globalConfigState = {}
  installedPlugins = new Set()
  installedBinaries = new Set()
})

test('getMatchingLspPlugins filters and sorts recommendations with official first', async () => {
  installedPlugins.add('typescript-installed@community-marketplace')

  const { getMatchingLspPlugins } = await import('../lspRecommendation.js')
  const recommendations = await getMatchingLspPlugins('src/example.ts')

  expect(recommendations.map(item => item.pluginId)).toEqual([
    'typescript-official@claude-code-plugins',
    'typescript-community@community-marketplace',
  ])
  expect(recommendations[0]).toMatchObject({
    isOfficial: true,
    command: 'typescript-language-server',
  })
  expect(recommendations[1]).toMatchObject({
    isOfficial: false,
    command: 'vtsls',
  })
})

test('getMatchingLspPlugins respects never-suggest list and ignores external config paths', async () => {
  globalConfigState = {
    lspRecommendationNeverPlugins: ['typescript-community@community-marketplace'],
  }
  installedPlugins.add('typescript-installed@community-marketplace')

  const { getMatchingLspPlugins } = await import('../lspRecommendation.js')
  const recommendations = await getMatchingLspPlugins('src/example.ts')

  expect(recommendations.map(item => item.pluginId)).toEqual([
    'typescript-official@claude-code-plugins',
  ])
})

test('getMatchingLspPlugins returns empty when disabled or ignore threshold is reached', async () => {
  const { getMatchingLspPlugins } = await import('../lspRecommendation.js')

  globalConfigState = {
    lspRecommendationDisabled: true,
  }
  expect(await getMatchingLspPlugins('src/example.ts')).toEqual([])

  globalConfigState = {
    lspRecommendationIgnoredCount: 5,
  }
  expect(await getMatchingLspPlugins('src/example.ts')).toEqual([])
})

test('recommendation preference helpers update config state', async () => {
  const {
    addToNeverSuggest,
    incrementIgnoredCount,
    isLspRecommendationsDisabled,
    resetIgnoredCount,
  } = await import('../lspRecommendation.js')

  addToNeverSuggest('typescript-community@community-marketplace')
  addToNeverSuggest('typescript-community@community-marketplace')
  expect(globalConfigState.lspRecommendationNeverPlugins).toEqual([
    'typescript-community@community-marketplace',
  ])

  incrementIgnoredCount()
  incrementIgnoredCount()
  expect(globalConfigState.lspRecommendationIgnoredCount).toBe(2)
  expect(isLspRecommendationsDisabled()).toBe(false)

  globalConfigState = {
    ...globalConfigState,
    lspRecommendationIgnoredCount: 5,
  }
  expect(isLspRecommendationsDisabled()).toBe(true)

  resetIgnoredCount()
  expect(globalConfigState.lspRecommendationIgnoredCount).toBe(0)
  expect(isLspRecommendationsDisabled()).toBe(false)
})
