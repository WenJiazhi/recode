import { afterEach, expect, mock, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runWithCwdOverride } from '../../../utils/cwd.js'
import { LOCAL_LSP_CONFIG_RELATIVE_PATH } from '../localConfig.js'

const createdDirs: string[] = []

mock.module('../../../utils/plugins/pluginLoader.js', () => ({
  loadAllPluginsCacheOnly: async () => ({
    enabled: [],
    disabled: [],
    errors: [],
  }),
}))

mock.module('../../../utils/plugins/lspPluginIntegration.js', () => ({
  getPluginLspServers: async () => ({}),
}))

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('getAllLspServers includes project-local servers before plugin results', async () => {
  const { getAllLspServers } = await import('../config.js')
  const dir = mkdtempSync(join(tmpdir(), 'recode-lsp-config-'))
  createdDirs.push(dir)
  mkdirSync(join(dir, '.recode'), { recursive: true })
  writeFileSync(
    join(dir, LOCAL_LSP_CONFIG_RELATIVE_PATH),
    JSON.stringify({
      tsserver: {
        command: 'bunx',
        args: ['typescript-language-server', '--stdio'],
        extensionToLanguage: {
          '.ts': 'typescript',
        },
      },
    }),
  )

  const result = await runWithCwdOverride(dir, () => getAllLspServers())

  expect(Object.keys(result.servers)).toEqual(['local:tsserver'])
  expect(result.servers['local:tsserver']?.scope).toBe('dynamic')
  expect(result.servers['local:tsserver']?.source).toBe('project-local')
})
