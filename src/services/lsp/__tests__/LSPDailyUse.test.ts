import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

type MockScopedServerConfig = {
  command: string
  args?: string[]
  extensionToLanguage: Record<string, string>
  workspaceFolder?: string
  startupTimeout?: number
}

let mockServerConfigs: Record<string, MockScopedServerConfig> = {}
const createdDirs: string[] = []

mock.module('../config.js', () => ({
  getAllLspServers: async () => ({
    servers: mockServerConfigs,
  }),
}))

afterEach(async () => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop()
    if (dir) {
      let removed = false
      for (let attempt = 0; attempt < 10 && !removed; attempt++) {
        try {
          rmSync(dir, { recursive: true, force: true })
          removed = true
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !('code' in error) ||
            (error as NodeJS.ErrnoException).code !== 'EBUSY'
          ) {
            throw error
          }
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
    }
  }
})

beforeEach(() => {
  mockServerConfigs = {}
})

test('project-local LSP server can start, open a file, and answer a definition request', async () => {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'recode-lsp-daily-use-'))
  createdDirs.push(workspaceDir)

  const serverScriptPath = join(workspaceDir, 'fake-lsp-server.js')
  const sourceFilePath = join(workspaceDir, 'example.ts')
  mkdirSync(join(workspaceDir, '.recode'), { recursive: true })
  writeFileSync(
    sourceFilePath,
    'export const answer = 42\nconsole.log(answer)\n',
  )

  writeFileSync(
    serverScriptPath,
    `
const openedUris = new Set();
let buffer = '';

function send(message) {
  const payload = JSON.stringify(message);
  process.stdout.write('Content-Length: ' + Buffer.byteLength(payload, 'utf8') + '\\r\\n\\r\\n' + payload);
}

function handle(message) {
  if (message.method === 'initialized') return;
  if (message.method === 'textDocument/didOpen') {
    openedUris.add(message.params.textDocument.uri);
    return;
  }
  if (message.method === 'exit') {
    process.exit(0);
    return;
  }
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        capabilities: {
          definitionProvider: true,
          textDocumentSync: 1
        }
      }
    });
    return;
  }
  if (message.method === 'shutdown') {
    send({ jsonrpc: '2.0', id: message.id, result: null });
    return;
  }
  if (message.method === 'textDocument/definition') {
    const uri = message.params?.textDocument?.uri;
    if (!openedUris.has(uri)) {
      send({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32602, message: 'file not opened' }
      });
      return;
    }
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: [{
        uri,
        range: {
          start: { line: 0, character: 13 },
          end: { line: 0, character: 19 }
        }
      }]
    });
    return;
  }
  if (message.id !== undefined) {
    send({ jsonrpc: '2.0', id: message.id, result: null });
  }
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  while (true) {
    const headerEnd = buffer.indexOf('\\r\\n\\r\\n');
    if (headerEnd === -1) break;
    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length: (\\d+)/i);
    if (!match) {
      process.exit(1);
    }
    const length = Number(match[1]);
    const messageStart = headerEnd + 4;
    if (buffer.length < messageStart + length) break;
    const payload = buffer.slice(messageStart, messageStart + length);
    buffer = buffer.slice(messageStart + length);
    handle(JSON.parse(payload));
  }
});
`,
  )

  mockServerConfigs = {
    'local:tsserver': {
      command: process.execPath,
      args: [resolve(serverScriptPath)],
      extensionToLanguage: {
        '.ts': 'typescript',
      },
      workspaceFolder: workspaceDir,
      startupTimeout: 5_000,
    },
  }

  const { createLSPServerManager } = await import('../LSPServerManager.js')
  const manager = createLSPServerManager()
  const fileUri = pathToFileURL(sourceFilePath).href

  try {
    await manager.initialize()
    await manager.openFile(
      sourceFilePath,
      'export const answer = 42\nconsole.log(answer)\n',
    )

    const result = await manager.sendRequest<
      Array<{
        uri: string
        range: {
          start: { line: number; character: number }
          end: { line: number; character: number }
        }
      }>
    >(sourceFilePath, 'textDocument/definition', {
      textDocument: { uri: fileUri },
      position: { line: 1, character: 12 },
    })

    expect(result).toBeArray()
    expect(result?.[0]?.uri).toBe(fileUri)
    expect(result?.[0]?.range.start.line).toBe(0)
    expect(result?.[0]?.range.start.character).toBe(13)
  } finally {
    await manager.shutdown()
  }
})
