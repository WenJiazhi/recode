#!/usr/bin/env bun

import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  type SessionNotification,
} from '@agentclientprotocol/sdk'
import { spawn } from 'node:child_process'
import { chmod, cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { startMockProvider } from './provider-e2e/mock-provider.js'

type RuntimeKind = 'source' | 'bundle' | 'binary'
type Runtime = { kind: RuntimeKind; label: string; command: string[] }

const ROOT = resolve(import.meta.dir, '..')
const API_KEY = 'recode-acp-e2e-key'
const MODEL = 'recode-acp-e2e-model'
const TIMEOUT = 45_000

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index >= 0) return process.argv[index + 1]
  return process.argv
    .find(value => value.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

async function runtimes(): Promise<Runtime[]> {
  const kinds = (option('--runtimes') ?? 'source,bundle')
    .split(',')
    .map(value => value.trim()) as RuntimeKind[]
  const output: Runtime[] = []
  for (const kind of kinds) {
    if (kind === 'source') {
      output.push({
        kind,
        label: 'source CLI',
        command: [process.execPath, join(ROOT, 'src/entrypoints/cli.tsx')],
      })
    } else if (kind === 'bundle') {
      output.push({
        kind,
        label: 'dist bundle',
        command: [process.execPath, join(ROOT, 'dist/cli.js')],
      })
    } else if (kind === 'binary') {
      const binary = option('--binary')
      if (!binary) throw new Error('--binary is required for binary ACP E2E')
      output.push({
        kind,
        label: `installed binary (${basename(binary)})`,
        command: [resolve(binary)],
      })
    } else {
      throw new Error(`Unknown ACP E2E runtime: ${kind}`)
    }
  }
  return output
}

function environment(home: string, origin: string) {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^(ANTHROPIC|OPENAI|RECODE_PROVIDER|CLAUDE|AWS_|GOOGLE_)/.test(key)) {
      delete env[key]
    }
  }
  return {
    ...env,
    ANTHROPIC_API_KEY: API_KEY,
    ANTHROPIC_BASE_URL: origin,
    ANTHROPIC_MODEL: MODEL,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: MODEL,
    ANTHROPIC_DEFAULT_OPUS_MODEL: MODEL,
    ANTHROPIC_DEFAULT_SONNET_MODEL: MODEL,
    CI: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_SIMPLE: '1',
    CLAUDE_CONFIG_DIR: join(home, '.claude'),
    DISABLE_TELEMETRY: '1',
    FORCE_COLOR: '0',
    HOME: home,
    NO_COLOR: '1',
    NO_PROXY: '127.0.0.1,localhost',
    RECODE_TELEMETRY_ENABLED: '0',
  }
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), TIMEOUT),
    ),
  ])
}

async function stageRuntime(runtime: Runtime, root: string): Promise<Runtime> {
  if (runtime.kind !== 'binary') return runtime
  const target = join(root, 'install', 'recode')
  await mkdir(join(root, 'install'), { recursive: true })
  await cp(runtime.command[0]!, target)
  await chmod(target, 0o755)
  return { ...runtime, command: [target] }
}

async function runClient(options: {
  runtime: Runtime
  cwd: string
  env: Record<string, string | undefined>
  sessionId?: string
  prompt: string
  cancelAfterRequest?: () => Promise<void>
}) {
  const child = spawn(options.runtime.command[0]!, [
    ...options.runtime.command.slice(1),
    '--acp',
  ], {
    cwd: options.cwd,
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', chunk => {
    stderr += String(chunk)
  })
  const updates: SessionNotification[] = []
  let permissionRequests = 0
  const app = client({ name: 'recode-acp-e2e' })
    .onRequest(methods.client.session.requestPermission, context => {
      permissionRequests++
      const selected = context.params.options.find(
        item => item.kind === 'allow_once',
      )
      if (!selected) return { outcome: { outcome: 'cancelled' as const } }
      return {
        outcome: {
          outcome: 'selected' as const,
          optionId: selected.optionId,
        },
      }
    })
    .onNotification(methods.client.session.update, context => {
      updates.push(context.params)
    })
  const stream = ndJsonStream(
    Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
    Readable.toWeb(child.stdout) as unknown as ReadableStream<Uint8Array>,
  )

  try {
    const result = await withTimeout(
      app.connectWith(stream, async context => {
        await context.request(methods.agent.initialize, {
          protocolVersion: PROTOCOL_VERSION,
          clientCapabilities: {},
          clientInfo: { name: 'recode-acp-e2e', version: '1' },
        })
        let sessionId = options.sessionId
        if (sessionId) {
          await context.request(methods.agent.session.load, {
            sessionId,
            cwd: options.cwd,
            mcpServers: [],
          })
        } else {
          const created = await context.request(methods.agent.session.new, {
            cwd: options.cwd,
            mcpServers: [],
          })
          sessionId = created.sessionId
        }
        const prompt = context.request(methods.agent.session.prompt, {
          sessionId,
          prompt: [{ type: 'text', text: options.prompt }],
        })
        if (options.cancelAfterRequest) {
          await options.cancelAfterRequest()
          await context.notify(methods.agent.session.cancel, { sessionId })
        }
        return { sessionId, response: await prompt }
      }),
      `${options.runtime.label} ACP client`,
    )
    return { ...result, updates, permissionRequests, stderr }
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM')
    await Promise.race([
      new Promise<void>(resolve => child.once('exit', () => resolve())),
      new Promise<void>(resolve => setTimeout(resolve, 2_000)),
    ])
  }
}

function textFrom(updates: SessionNotification[]): string {
  return updates
    .map(item => item.update)
    .filter(item => item.sessionUpdate === 'agent_message_chunk')
    .map(item => (item.content.type === 'text' ? item.content.text : ''))
    .join('')
}

async function runRuntime(runtime: Runtime, root: string): Promise<void> {
  const home = join(root, runtime.kind, 'home')
  const cwd = join(root, runtime.kind, 'workspace')
  const outside = join(root, runtime.kind, 'outside')
  await Promise.all([
    mkdir(home, { recursive: true }),
    mkdir(cwd, { recursive: true }),
    mkdir(outside, { recursive: true }),
  ])
  const fixture = join(outside, 'permission-fixture.txt')
  await writeFile(fixture, 'RECODE_PROVIDER_TOOL_RESULT_OK\n')

  const firstProvider = startMockProvider({
    expectedApiKey: API_KEY,
    expectedModel: MODEL,
    fixtureFile: fixture,
    kind: 'anthropic',
    scenario: 'flow',
  })
  let first: Awaited<ReturnType<typeof runClient>>
  try {
    first = await runClient({
      runtime,
      cwd,
      env: environment(home, firstProvider.origin),
      prompt: 'Run ACP permission verification.',
    })
  } finally {
    firstProvider.stop()
  }
  if (!textFrom(first.updates).includes('RECODE_PROVIDER_E2E_OK anthropic')) {
    throw new Error(`${runtime.label}: ACP text response missing\n${first.stderr}`)
  }
  if (first.permissionRequests < 1) {
    throw new Error(`${runtime.label}: ACP permission request was not observed`)
  }
  if (firstProvider.failures.length > 0) {
    throw new Error(`${runtime.label}: ${firstProvider.failures.join('; ')}`)
  }

  const resumeProvider = startMockProvider({
    expectedApiKey: API_KEY,
    expectedModel: MODEL,
    fixtureFile: fixture,
    kind: 'anthropic',
    scenario: 'flow',
  })
  let resumed: Awaited<ReturnType<typeof runClient>>
  try {
    resumed = await runClient({
      runtime,
      cwd,
      env: environment(home, resumeProvider.origin),
      sessionId: first.sessionId,
      prompt: 'Run ACP resume verification.',
    })
  } finally {
    resumeProvider.stop()
  }
  const replayedUser = resumed.updates.some(
    item => item.update.sessionUpdate === 'user_message_chunk',
  )
  if (!replayedUser || resumed.response.stopReason !== 'end_turn') {
    throw new Error(`${runtime.label}: ACP session/load did not replay and resume`)
  }

  const slowProvider = startMockProvider({
    expectedApiKey: API_KEY,
    expectedModel: MODEL,
    fixtureFile: fixture,
    kind: 'anthropic',
    scenario: 'slow',
  })
  try {
    const cancelled = await runClient({
      runtime,
      cwd,
      env: environment(home, slowProvider.origin),
      prompt: 'Run ACP cancellation verification.',
      cancelAfterRequest: async () => {
        const deadline = Date.now() + 10_000
        while (slowProvider.requests.length === 0 && Date.now() < deadline) {
          await Bun.sleep(25)
        }
      },
    })
    if (cancelled.response.stopReason !== 'cancelled') {
      throw new Error(`${runtime.label}: ACP cancellation returned ${cancelled.response.stopReason}`)
    }
  } finally {
    slowProvider.stop()
  }
}

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'recode-acp-e2e-'))
  try {
    for (const requested of await runtimes()) {
      const runtime = await stageRuntime(requested, root)
      await runRuntime(runtime, root)
      console.log(`[OK] ${runtime.label} / ACP new + permission + load + cancel`)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

await main()
