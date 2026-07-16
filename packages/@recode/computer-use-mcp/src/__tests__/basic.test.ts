import { expect, test } from 'bun:test'

import { buildComputerUseTools, createComputerUseMcpServer } from '../index.js'
import type { ComputerUseHostAdapter } from '../types.js'

function createTestAdapter(): ComputerUseHostAdapter {
  return {
    serverName: 'test-cu',
    logger: {
      info() {},
      error() {},
      warn() {},
      debug() {},
      silly() {},
    },
    executor: {
      capabilities: {
        screenshotFiltering: 'none',
        platform: 'win32',
      },
    } as any,
    ensureOsPermissions: async () => ({ granted: true }),
    isDisabled: () => false,
    getAutoUnhideEnabled: () => false,
    getSubGates: () => ({
      pixelValidation: false,
      clipboardPasteMultiline: false,
      mouseAnimation: false,
      hideBeforeAction: false,
      autoTargetDisplay: false,
      clipboardGuard: false,
    }),
    cropRawPatch: async () => null,
  }
}

test('buildComputerUseTools returns a populated tool set for a normal capability surface', () => {
  const tools = buildComputerUseTools(
    {
      screenshotFiltering: 'none',
      platform: 'win32',
    } as any,
    'pixels',
    ['Notepad'],
  )

  expect(tools.length).toBeGreaterThan(0)
  expect(tools.some(tool => tool.name === 'request_access')).toBe(true)
  expect(tools.some(tool => tool.name === 'screenshot')).toBe(true)
})

test('createComputerUseMcpServer returns a live MCP server object instead of a null stub', () => {
  const server = createComputerUseMcpServer(createTestAdapter(), 'pixels')

  expect(server).toBeTruthy()
  expect(typeof server.connect).toBe('function')
  expect(typeof server.setRequestHandler).toBe('function')
})
