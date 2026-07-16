import { describe, expect, test } from 'bun:test'
import type { McpServer } from '@agentclientprotocol/sdk'
import { convertAcpMcpServers } from '../sessionProcess.js'

describe('convertAcpMcpServers', () => {
  test('converts standard stdio, HTTP, and SSE transports', () => {
    const result = convertAcpMcpServers([
      {
        name: 'local',
        command: '/usr/bin/example-mcp',
        args: ['--stdio'],
        env: [{ name: 'TOKEN', value: 'secret' }],
      },
      {
        type: 'http',
        name: 'remote',
        url: 'https://example.test/mcp',
        headers: [{ name: 'Authorization', value: 'Bearer token' }],
      },
      {
        type: 'sse',
        name: 'legacy',
        url: 'https://example.test/sse',
        headers: [],
      },
    ] as McpServer[])

    expect(result.local).toEqual({
      type: 'stdio',
      command: '/usr/bin/example-mcp',
      args: ['--stdio'],
      env: { TOKEN: 'secret' },
    })
    expect(result.remote).toEqual({
      type: 'http',
      url: 'https://example.test/mcp',
      headers: { Authorization: 'Bearer token' },
    })
    expect(result.legacy).toEqual({
      type: 'sse',
      url: 'https://example.test/sse',
    })
  })

  test('rejects ACP-transport MCP until message tunneling exists', () => {
    expect(() =>
      convertAcpMcpServers([
        { type: 'acp', name: 'nested', serverId: 'server-1' },
      ] as McpServer[]),
    ).toThrow('is not supported')
  })
})
