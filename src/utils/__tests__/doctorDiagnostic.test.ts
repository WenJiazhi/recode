import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtempSync } from 'fs'
import { afterEach, expect, test } from 'bun:test'
import { runWithCwdOverride } from '../cwd.js'
import {
  LOCAL_LSP_CONFIG_RELATIVE_PATH,
  LOCAL_LSP_EXAMPLE_CONFIG_RELATIVE_PATH,
} from '../../services/lsp/localConfig.js'
import { getLspDiagnosticSummary } from '../doctorDiagnostic.js'

const createdDirs: string[] = []

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('reports configured local LSP launcher availability', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-lsp-diagnostic-'))
  createdDirs.push(dir)
  mkdirSync(join(dir, '.recode'), { recursive: true })
  writeFileSync(
    join(dir, LOCAL_LSP_CONFIG_RELATIVE_PATH),
    JSON.stringify({
      tsserver: {
        command: 'definitely-missing-lsp-launcher',
        args: ['typescript-language-server', '--stdio'],
        extensionToLanguage: {
          '.ts': 'typescript',
        },
      },
    }),
  )

  const summary = await runWithCwdOverride(dir, () => getLspDiagnosticSummary())

  expect(summary.configuredLocalServers).toEqual([
    {
      name: 'local:tsserver',
      commandLine: 'definitely-missing-lsp-launcher typescript-language-server --stdio',
      launcherInstalled: false,
    },
  ])
})

test('reports example server commands and quickstart hint when only example config exists', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-lsp-example-'))
  createdDirs.push(dir)
  mkdirSync(join(dir, '.recode'), { recursive: true })
  writeFileSync(
    join(dir, LOCAL_LSP_EXAMPLE_CONFIG_RELATIVE_PATH),
    JSON.stringify({
      tsserver: {
        command: 'definitely-missing-example-launcher',
        args: ['typescript-language-server', '--stdio'],
        extensionToLanguage: {
          '.ts': 'typescript',
        },
      },
    }),
  )

  const summary = await runWithCwdOverride(dir, () => getLspDiagnosticSummary())

  expect(summary.localConfigPresent).toBe(false)
  expect(summary.localExamplePresent).toBe(true)
  expect(summary.configuredServers).toBe(0)
  expect(summary.exampleServers).toEqual([
    {
      name: 'tsserver',
      commandLine: 'definitely-missing-example-launcher typescript-language-server --stdio',
      launcherInstalled: false,
    },
  ])
  expect(summary.quickstartHint).toBe(
    `Copy ${join(dir, LOCAL_LSP_EXAMPLE_CONFIG_RELATIVE_PATH)} to ${join(dir, LOCAL_LSP_CONFIG_RELATIVE_PATH)} and adjust the server command for your machine.`,
  )
})

test('reports invalid local config details in the LSP diagnostic summary', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-lsp-invalid-'))
  createdDirs.push(dir)
  mkdirSync(join(dir, '.recode'), { recursive: true })
  writeFileSync(
    join(dir, LOCAL_LSP_CONFIG_RELATIVE_PATH),
    JSON.stringify({
      tsserver: {
        args: ['typescript-language-server', '--stdio'],
        extensionToLanguage: {
          '.ts': 'typescript',
        },
      },
    }),
  )

  const summary = await runWithCwdOverride(dir, () => getLspDiagnosticSummary())

  expect(summary.localConfigPresent).toBe(true)
  expect(summary.localConfigValid).toBe(false)
  expect(summary.localConfigError).toContain('Local LSP config validation failed')
  expect(summary.localConfigError).toContain('command')
})
