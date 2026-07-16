import { beforeEach, expect, mock, test } from 'bun:test'

type MockScopedServerConfig = {
  command?: string
  extensionToLanguage?: Record<string, string>
}

type MockLspServerInstance = {
  name: string
  config: Required<MockScopedServerConfig>
  state: 'stopped' | 'running' | 'error'
  startCalls: number
  start: () => Promise<void>
  stop: () => Promise<void>
  onRequest: () => void
}

let mockServerConfigs: Record<string, MockScopedServerConfig> = {}
let createdInstances: Map<string, MockLspServerInstance> = new Map()

mock.module('../config.js', () => ({
  getAllLspServers: async () => ({
    servers: mockServerConfigs,
  }),
}))

mock.module('../LSPServerInstance.js', () => ({
  createLSPServerInstance: (
    name: string,
    config: Required<MockScopedServerConfig>,
  ) => {
    const instance: MockLspServerInstance = {
      name,
      config,
      state: 'stopped',
      startCalls: 0,
      async start() {
        instance.startCalls += 1
        instance.state = 'running'
      },
      async stop() {
        instance.state = 'stopped'
      },
      onRequest() {},
    }
    createdInstances.set(name, instance)
    return instance
  },
}))

beforeEach(() => {
  mockServerConfigs = {}
  createdInstances = new Map()
})

test('manager routes files to configured project-local server by extension', async () => {
  mockServerConfigs = {
    'local:tsserver': {
      command: 'bunx',
      extensionToLanguage: {
        '.ts': 'typescript',
        '.tsx': 'typescriptreact',
      },
    },
  }

  const { createLSPServerManager } = await import('../LSPServerManager.js')
  const manager = createLSPServerManager()
  await manager.initialize()

  const tsServer = manager.getServerForFile('src/example.ts')
  const tsxServer = manager.getServerForFile('src/example.tsx')
  const pyServer = manager.getServerForFile('src/example.py')

  expect(tsServer?.name).toBe('local:tsserver')
  expect(tsxServer?.name).toBe('local:tsserver')
  expect(pyServer).toBeUndefined()
})

test('manager skips invalid server config and keeps valid servers available', async () => {
  mockServerConfigs = {
    broken: {
      extensionToLanguage: {
        '.py': 'python',
      },
    },
    'local:tsserver': {
      command: 'bunx',
      extensionToLanguage: {
        '.ts': 'typescript',
      },
    },
  }

  const { createLSPServerManager } = await import('../LSPServerManager.js')
  const manager = createLSPServerManager()
  await manager.initialize()

  expect(createdInstances.has('broken')).toBe(false)
  expect(manager.getServerForFile('src/example.ts')?.name).toBe('local:tsserver')
  expect(manager.getServerForFile('src/example.py')).toBeUndefined()
})

test('ensureServerStarted starts a stopped server once and reuses it afterward', async () => {
  mockServerConfigs = {
    'local:tsserver': {
      command: 'bunx',
      extensionToLanguage: {
        '.ts': 'typescript',
      },
    },
  }

  const { createLSPServerManager } = await import('../LSPServerManager.js')
  const manager = createLSPServerManager()
  await manager.initialize()

  const first = await manager.ensureServerStarted('src/example.ts')
  const second = await manager.ensureServerStarted('src/example.ts')

  expect(first?.name).toBe('local:tsserver')
  expect(second?.name).toBe('local:tsserver')
  expect(createdInstances.get('local:tsserver')?.startCalls).toBe(1)
  expect(createdInstances.get('local:tsserver')?.state).toBe('running')
})
