import { describe, expect, test } from 'bun:test'
import { formatErrorMessage, getErrorGuidance } from './PluginErrors.js'

describe('PluginErrors LSP formatting', () => {
  test('formats lsp server start failures with server name and reason', () => {
    expect(
      formatErrorMessage({
        type: 'lsp-server-start-failed',
        source: 'plugin:typescript-lsp',
        plugin: 'typescript-lsp',
        serverName: 'tsserver',
        reason: 'spawn bunx ENOENT',
      }),
    ).toBe('LSP server "tsserver" failed to start: spawn bunx ENOENT')
  })

  test('formats lsp crashes with signal or exit code', () => {
    expect(
      formatErrorMessage({
        type: 'lsp-server-crashed',
        source: 'plugin:typescript-lsp',
        plugin: 'typescript-lsp',
        serverName: 'tsserver',
        exitCode: null,
        signal: 'SIGTERM',
      }),
    ).toBe('LSP server "tsserver" crashed with signal SIGTERM')

    expect(
      formatErrorMessage({
        type: 'lsp-server-crashed',
        source: 'plugin:typescript-lsp',
        plugin: 'typescript-lsp',
        serverName: 'tsserver',
        exitCode: 137,
      }),
    ).toBe('LSP server "tsserver" crashed with exit code 137')
  })

  test('formats lsp request timeout and failure details', () => {
    expect(
      formatErrorMessage({
        type: 'lsp-request-timeout',
        source: 'plugin:typescript-lsp',
        plugin: 'typescript-lsp',
        serverName: 'tsserver',
        method: 'textDocument/definition',
        timeoutMs: 5000,
      }),
    ).toBe(
      'LSP server "tsserver" timed out on textDocument/definition after 5000ms',
    )

    expect(
      formatErrorMessage({
        type: 'lsp-request-failed',
        source: 'plugin:typescript-lsp',
        plugin: 'typescript-lsp',
        serverName: 'tsserver',
        method: 'textDocument/hover',
        error: 'connection closed',
      }),
    ).toBe(
      'LSP server "tsserver" textDocument/hover failed: connection closed',
    )
  })

  test('returns stable guidance for LSP runtime failures', () => {
    expect(
      getErrorGuidance({
        type: 'lsp-config-invalid',
        source: 'plugin:typescript-lsp',
        plugin: 'typescript-lsp',
        serverName: 'tsserver',
        validationError: 'language map missing',
      }),
    ).toBe('Check LSP server configuration in the plugin manifest')

    expect(
      getErrorGuidance({
        type: 'lsp-server-start-failed',
        source: 'plugin:typescript-lsp',
        plugin: 'typescript-lsp',
        serverName: 'tsserver',
        reason: 'spawn bunx ENOENT',
      }),
    ).toBe('Check LSP server logs with --debug for details')
  })
})
