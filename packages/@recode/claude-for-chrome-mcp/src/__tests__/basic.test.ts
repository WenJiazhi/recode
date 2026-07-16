import { expect, test } from 'bun:test'

import {
  BROWSER_TOOLS,
  createClaudeForChromeMcpServer,
} from '../index.js'
import type { ClaudeForChromeContext, SocketClient } from '../types.js'

function createSocketClient(): SocketClient {
  return {
    ensureConnected: async () => true,
    callTool: async () => ({}),
    isConnected: () => true,
    disconnect() {},
    setNotificationHandler() {},
  }
}

function createContext(): ClaudeForChromeContext {
  return {
    serverName: 'test-chrome',
    logger: {
      info() {},
      error() {},
      warn() {},
      debug() {},
      silly() {},
    },
    socketPath: '\\\\.\\pipe\\test-chrome',
    clientTypeId: 'claude-code',
    onToolCallDisconnected: () => 'disconnected',
    onAuthenticationError() {},
    isDisabled: () => false,
  }
}

test('BROWSER_TOOLS exports a populated browser tool list', () => {
  expect(BROWSER_TOOLS.length).toBeGreaterThan(0)
  expect(BROWSER_TOOLS.some(tool => tool.name === 'navigate')).toBe(true)
})

test('createClaudeForChromeMcpServer returns a live MCP server instead of a null stub', () => {
  const server = createClaudeForChromeMcpServer(
    createContext(),
    createSocketClient(),
  )

  expect(server).toBeTruthy()
  expect(typeof server.connect).toBe('function')
  expect(typeof server.setRequestHandler).toBe('function')
})
