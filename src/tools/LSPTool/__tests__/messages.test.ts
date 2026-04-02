import { expect, test } from 'bun:test'
import {
  buildLspManagerUnavailableMessage,
  buildNoLspServerMessage,
} from '../messages.js'

test('buildNoLspServerMessage points to local config path', () => {
  const message = buildNoLspServerMessage(
    '.ts',
    'E:\\appdev\\claudecode-rebuild\\.recode\\lsp.json',
  )

  expect(message).toContain('No LSP server available for file type: .ts')
  expect(message).toContain('.recode\\lsp.json')
  expect(message).toContain('.recode\\lsp.example.json')
  expect(message).toContain('plugin-provided LSP server')
})

test('buildNoLspServerMessage includes matching plugin recommendations', () => {
  const message = buildNoLspServerMessage(
    '.ts',
    'E:\\appdev\\claudecode-rebuild\\.recode\\lsp.json',
    [
      {
        pluginId: 'typescript-lsp@official',
        pluginName: 'TypeScript LSP',
        marketplaceName: 'official',
        isOfficial: true,
        extensions: ['.ts'],
        command: 'typescript-language-server',
      },
      {
        pluginId: 'vtsls@community',
        pluginName: 'vtsls',
        marketplaceName: 'community',
        isOfficial: false,
        extensions: ['.ts'],
        command: 'vtsls',
      },
    ],
  )

  expect(message).toContain('Detected a matching installed LSP binary')
  expect(message).toContain('typescript-language-server')
  expect(message).toContain('typescript-lsp@official')
  expect(message).toContain('vtsls@community')
})

test('buildLspManagerUnavailableMessage includes failed error details', () => {
  const message = buildLspManagerUnavailableMessage(
    { status: 'failed', error: new Error('boom') },
    'E:\\appdev\\claudecode-rebuild\\.recode\\lsp.json',
  )

  expect(message).toContain('failed to initialize: boom')
  expect(message).toContain('/doctor')
  expect(message).toContain('.recode\\lsp.json')
  expect(message).toContain('.recode\\lsp.example.json')
})
