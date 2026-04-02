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
  expect(message).toContain('plugin-provided LSP server')
})

test('buildLspManagerUnavailableMessage includes failed error details', () => {
  const message = buildLspManagerUnavailableMessage(
    { status: 'failed', error: new Error('boom') },
    'E:\\appdev\\claudecode-rebuild\\.recode\\lsp.json',
  )

  expect(message).toContain('failed to initialize: boom')
  expect(message).toContain('/doctor')
  expect(message).toContain('.recode\\lsp.json')
})
