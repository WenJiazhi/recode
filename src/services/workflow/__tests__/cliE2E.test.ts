import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { WORKFLOW_SCHEMA_VERSION } from '../types.js'

type RequestCounts = {
  mainInitial: number
  mainToolResult: number
  notification: number
  workerInitial: number
  workerToolResult: number
}

const MODEL = 'recode-workflow-e2e-model'
const API_KEY = 'recode-workflow-e2e-key'
const WORKFLOW_TOOL_ID = 'workflow_call_1'
const STRUCTURED_TOOL_ID = 'structured_call_1'
const installedBinary = process.env.RECODE_WORKFLOW_E2E_BINARY

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}`
}

function stream(frames: string[]): Response {
  return new Response(`${frames.join('\n\n')}\n\n`, {
    headers: { 'content-type': 'text/event-stream' },
  })
}

function messageStart(id: string): string {
  return frame('message_start', {
    type: 'message_start',
    message: {
      id,
      type: 'message',
      role: 'assistant',
      content: [],
      model: MODEL,
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 20,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  })
}

function toolResponse(
  id: string,
  name: string,
  input: Record<string, unknown>,
): Response {
  return stream([
    messageStart(`msg_${id}`),
    frame('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'tool_use', id, name, input: {} },
    }),
    frame('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'input_json_delta',
        partial_json: JSON.stringify(input),
      },
    }),
    frame('content_block_stop', { type: 'content_block_stop', index: 0 }),
    frame('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'tool_use', stop_sequence: null },
      usage: { output_tokens: 8 },
    }),
    frame('message_stop', { type: 'message_stop' }),
  ])
}

function textResponse(id: string, text: string): Response {
  return stream([
    messageStart(id),
    frame('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    }),
    frame('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    }),
    frame('content_block_stop', { type: 'content_block_stop', index: 0 }),
    frame('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 5 },
    }),
    frame('message_stop', { type: 'message_stop' }),
  ])
}

function workflowSpec(): Record<string, unknown> {
  return {
    version: 1,
    name: 'structured-cli-e2e',
    objective: 'Return one verified finding as structured output',
    maxConcurrency: 1,
    steps: [
      {
        id: 'inspect',
        title: 'Inspect fixture',
        prompt: 'Return the deterministic verification result.',
        outputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'count'],
          properties: {
            summary: { type: 'string' },
            count: { type: 'number' },
          },
        },
      },
    ],
  }
}

function findToolResult(
  value: unknown,
  toolUseId: string,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findToolResult(item, toolUseId)
      if (found) return found
    }
    return undefined
  }
  const record = value as Record<string, unknown>
  if (record.type === 'tool_result' && record.tool_use_id === toolUseId) {
    return record
  }
  for (const item of Object.values(record)) {
    const found = findToolResult(item, toolUseId)
    if (found) return found
  }
  return undefined
}

function hasToolResult(value: unknown, toolUseId: string): boolean {
  return findToolResult(value, toolUseId) !== undefined
}

function isolatedEnvironment(
  home: string,
  origin: string,
): Record<string, string> {
  const environment = { ...process.env } as Record<string, string>
  for (const key of Object.keys(environment)) {
    if (
      /^(ANTHROPIC|OPENAI|RECODE_PROVIDER|CLAUDE|FEATURE_|AWS_|GOOGLE_|VERTEX_|AZURE_|USER_TYPE)/.test(
        key,
      ) ||
      /^(HTTP|HTTPS|ALL)_PROXY$/i.test(key)
    ) {
      delete environment[key]
    }
  }
  return {
    ...environment,
    ANTHROPIC_API_KEY: API_KEY,
    ANTHROPIC_BASE_URL: origin,
    ANTHROPIC_DEFAULT_SONNET_MODEL: MODEL,
    CI: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CONFIG_DIR: join(home, '.claude'),
    DISABLE_TELEMETRY: '1',
    FORCE_COLOR: '0',
    HOME: home,
    NODE_ENV: 'production',
    NO_COLOR: '1',
    NO_PROXY: '127.0.0.1,localhost',
    RECODE_TELEMETRY_ENABLED: '0',
  }
}

test(`${installedBinary ? 'installed binary' : 'source CLI'} persists validated structured workflow output`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-cli-e2e-'))
  const home = join(root, 'home')
  const worktree = join(root, 'worktree')
  const counts: RequestCounts = {
    mainInitial: 0,
    mainToolResult: 0,
    notification: 0,
    workerInitial: 0,
    workerToolResult: 0,
  }
  const failures: string[] = []
  let workflowToolResult: Record<string, unknown> | undefined

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (request.method === 'HEAD' && url.pathname === '/') {
        return new Response(null, { status: 204 })
      }
      if (request.method !== 'POST' || url.pathname !== '/v1/messages') {
        failures.push(`Unexpected request: ${request.method} ${url.pathname}`)
        return Response.json(
          { error: { message: 'unexpected route' } },
          { status: 404 },
        )
      }
      if (request.headers.get('x-api-key') !== API_KEY) {
        failures.push('Incorrect API key header')
      }
      const body = (await request.json()) as Record<string, unknown>
      if (body.model !== MODEL || body.stream !== true) {
        failures.push('Incorrect model or stream flag')
      }
      const serialized = JSON.stringify(body)
      const isWorker = serialized.includes('<workflow-step')

      if (isWorker) {
        if (hasToolResult(body, STRUCTURED_TOOL_ID)) {
          counts.workerToolResult += 1
          return textResponse('msg_worker_done', 'Structured result recorded.')
        }
        counts.workerInitial += 1
        if (!serialized.includes('"name":"StructuredOutput"')) {
          failures.push('Worker request did not include StructuredOutput')
        }
        return toolResponse(STRUCTURED_TOOL_ID, 'StructuredOutput', {
          summary: 'verified',
          count: 1,
        })
      }

      if (serialized.includes('<workflow_run_id>')) {
        counts.notification += 1
        return textResponse('msg_notification', 'WORKFLOW_E2E_DONE')
      }
      if (hasToolResult(body, WORKFLOW_TOOL_ID)) {
        counts.mainToolResult += 1
        workflowToolResult = findToolResult(body, WORKFLOW_TOOL_ID)
        return textResponse('msg_launched', 'Workflow launched.')
      }

      counts.mainInitial += 1
      return toolResponse(WORKFLOW_TOOL_ID, 'Workflow', {
        action: 'launch',
        spec: workflowSpec(),
      })
    },
  })

  try {
    await mkdir(home, { recursive: true })
    await mkdir(worktree, { recursive: true })
    const projectRoot = resolve(import.meta.dir, '../../../..')
    const command = installedBinary
      ? [resolve(installedBinary)]
      : [process.execPath, join(projectRoot, 'src/entrypoints/cli.tsx')]
    const child = Bun.spawn(
      [
        ...command,
        '--print',
        '--no-session-persistence',
        '--dangerously-skip-permissions',
        '--tools',
        'Workflow',
        '--model',
        'sonnet',
        '--max-turns',
        '10',
        '--output-format',
        'json',
        'Launch the requested structured workflow.',
      ],
      {
        cwd: worktree,
        env: isolatedEnvironment(
          home,
          `http://${server.hostname}:${server.port}`,
        ),
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000)
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    clearTimeout(timeout)
    const output = `${stdout}${stderr}`
    const journalDir = join(worktree, '.recode', 'workflow-runs')
    const journalFiles = await readdir(journalDir)
      .then(files => files.filter(file => file.endsWith('.jsonl')))
      .catch(() => [])
    const events =
      journalFiles.length === 1
        ? (await readFile(join(journalDir, journalFiles[0]!), 'utf8'))
            .trim()
            .split('\n')
            .map(line => JSON.parse(line))
        : []
    const diagnostic = `counts=${JSON.stringify(counts)} failures=${JSON.stringify(failures)} workflowToolResult=${JSON.stringify(workflowToolResult)} events=${JSON.stringify(events)}`

    expect(exitCode, `${output}\n${diagnostic}`).toBe(0)
    expect(output, diagnostic).toContain('WORKFLOW_E2E_DONE')
    expect(failures).toEqual([])
    expect(counts).toEqual({
      mainInitial: 1,
      mainToolResult: 1,
      notification: 1,
      workerInitial: 1,
      workerToolResult: 1,
    })

    expect(journalFiles).toHaveLength(1)
    const created = events.find(event => event.type === 'run_created')
    const completedStep = events.findLast(
      event =>
        event.type === 'step_updated' && event.step?.status === 'completed',
    )
    expect(created?.run?.schemaVersion).toBe(WORKFLOW_SCHEMA_VERSION)
    expect(created?.run?.concurrencyLimit).toBe(1)
    expect(created?.run?.tokenBudget).toBeNull()
    expect(completedStep?.step?.output).toBe('{"summary":"verified","count":1}')
    expect(completedStep?.step?.structuredOutput).toEqual({
      summary: 'verified',
      count: 1,
    })
    expect(completedStep?.step?.tokens).toBe(53)
    expect(completedStep?.step?.usage).toEqual({
      inputTokens: 40,
      outputTokens: 13,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    })
    expect(completedStep?.step?.models).toEqual([MODEL])
    expect(completedStep?.step?.hasUnknownCost).toBe(true)
  } finally {
    server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})
