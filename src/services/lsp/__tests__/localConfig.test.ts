import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtempSync } from 'fs'
import { afterEach, expect, test } from 'bun:test'
import { runWithCwdOverride } from '../../../utils/cwd.js'
import {
  inspectLocalLspConfig,
  loadLocalLspServers,
  LOCAL_LSP_CONFIG_RELATIVE_PATH,
} from '../localConfig.js'

const createdDirs: string[] = []

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('loads project-local LSP servers from .recode/lsp.json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-lsp-local-'))
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
          '.tsx': 'typescriptreact',
        },
      },
    }),
  )

  const servers = await runWithCwdOverride(dir, () => loadLocalLspServers())

  expect(Object.keys(servers)).toEqual(['local:tsserver'])
  expect(servers['local:tsserver']?.command).toBe('bunx')
  expect(servers['local:tsserver']?.source).toBe('project-local')
})

test('returns empty object when no local LSP config exists', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-lsp-empty-'))
  createdDirs.push(dir)

  const servers = await runWithCwdOverride(dir, () => loadLocalLspServers())

  expect(servers).toEqual({})
})

test('reports invalid local LSP config details', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-lsp-invalid-'))
  createdDirs.push(dir)
  mkdirSync(join(dir, '.recode'), { recursive: true })
  writeFileSync(
    join(dir, LOCAL_LSP_CONFIG_RELATIVE_PATH),
    JSON.stringify({
      tsserver: {
        args: ['typescript-language-server', '--stdio'],
      },
    }),
  )

  const inspection = await runWithCwdOverride(dir, () => inspectLocalLspConfig())
  const servers = await runWithCwdOverride(dir, () => loadLocalLspServers())

  expect(inspection.present).toBe(true)
  expect(inspection.valid).toBe(false)
  expect(inspection.error).toContain('validation failed')
  expect(servers).toEqual({})
})

test('project-local servers are normalized with dynamic scope metadata', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-lsp-scope-'))
  createdDirs.push(dir)
  mkdirSync(join(dir, '.recode'), { recursive: true })
  writeFileSync(
    join(dir, LOCAL_LSP_CONFIG_RELATIVE_PATH),
    JSON.stringify({
      pyright: {
        command: 'pyright-langserver',
        args: ['--stdio'],
        extensionToLanguage: {
          '.py': 'python',
        },
      },
    }),
  )

  const inspection = await runWithCwdOverride(dir, () => inspectLocalLspConfig())
  const server = inspection.servers['local:pyright']

  expect(inspection.valid).toBe(true)
  expect(server?.scope).toBe('dynamic')
  expect(server?.source).toBe('project-local')
  expect(server?.command).toBe('pyright-langserver')
})
