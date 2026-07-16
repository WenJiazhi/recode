import {
  methods,
  type AgentContext,
  type McpServer,
  type PermissionOption,
  type RequestPermissionRequest,
  type StopReason,
} from '@agentclientprotocol/sdk'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, realpath } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { createInterface } from 'node:readline'
import { isInBundledMode } from '../utils/bundledMode.js'
import { loadTranscriptFromFile } from '../utils/sessionStorage.js'
import {
  findProjectDir,
  getProjectDir,
} from '../utils/sessionStoragePortable.js'
import { RecodeAcpEventMapper, type RecodeTurnResult } from './eventMapper.js'

type JsonObject = Record<string, unknown>

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

type PendingTurn = Deferred<StopReason> & {
  cancelled: boolean
  timeout?: ReturnType<typeof setTimeout>
}

type SessionConfig = {
  sessionId: string
  cwd: string
  additionalDirectories: string[]
  mcpServers: McpServer[]
  resume: boolean
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function currentCliCommand(): { command: string; args: string[] } {
  if (isInBundledMode()) return { command: process.execPath, args: [] }
  if (!process.argv[1]) {
    throw new Error('Unable to locate the Recode CLI entrypoint for ACP')
  }
  return { command: process.execPath, args: [process.argv[1]] }
}

function entriesToObject(
  entries: Array<{ name: string; value: string }> | undefined,
): Record<string, string> | undefined {
  if (!entries || entries.length === 0) return undefined
  return Object.fromEntries(entries.map(entry => [entry.name, entry.value]))
}

export function convertAcpMcpServers(
  servers: McpServer[],
): Record<string, JsonObject> {
  const output: Record<string, JsonObject> = {}
  for (const server of servers) {
    if ('command' in server) {
      output[server.name] = {
        type: 'stdio',
        command: server.command,
        args: server.args,
        ...(entriesToObject(server.env)
          ? { env: entriesToObject(server.env) }
          : {}),
      }
    } else if (server.type === 'http' || server.type === 'sse') {
      output[server.name] = {
        type: server.type,
        url: server.url,
        ...(entriesToObject(server.headers)
          ? { headers: entriesToObject(server.headers) }
          : {}),
      }
    } else {
      throw new Error(
        `ACP-transport MCP server ${JSON.stringify(server.name)} is not supported`,
      )
    }
  }
  return output
}

export class RecodeAcpSession {
  readonly sessionId: string
  readonly cwd: string
  private readonly mapper: RecodeAcpEventMapper
  private child: ChildProcessWithoutNullStreams | undefined
  private startPromise: Promise<void> | undefined
  private dispatchChain = Promise.resolve()
  private readonly controls = new Map<string, Deferred<JsonObject>>()
  private readonly permissionRequests = new Map<string, AbortController>()
  private activeClient: AgentContext | undefined
  private pendingTurn: PendingTurn | undefined
  private resumeOnNextSpawn: boolean
  private closed = false
  private stderrTail: string[] = []

  constructor(private readonly config: SessionConfig) {
    this.sessionId = config.sessionId
    this.cwd = config.cwd
    this.resumeOnNextSpawn = config.resume
    this.mapper = new RecodeAcpEventMapper(config.sessionId, config.cwd)
  }

  async prompt(text: string, client: AgentContext): Promise<StopReason> {
    if (this.closed) throw new Error(`ACP session ${this.sessionId} is closed`)
    if (this.pendingTurn) {
      throw new Error(
        `ACP session ${this.sessionId} already has an active prompt`,
      )
    }

    this.activeClient = client
    await this.ensureStarted()
    const turn = deferred<StopReason>() as PendingTurn
    turn.cancelled = false
    this.pendingTurn = turn

    try {
      this.write({
        type: 'user',
        uuid: randomUUID(),
        session_id: this.sessionId,
        parent_tool_use_id: null,
        message: { role: 'user', content: text },
      })
    } catch (error) {
      this.pendingTurn = undefined
      this.activeClient = undefined
      throw error
    }

    try {
      return await turn.promise
    } finally {
      if (this.pendingTurn === turn) this.pendingTurn = undefined
      if (turn.timeout) clearTimeout(turn.timeout)
      this.activeClient = undefined
    }
  }

  async replayHistory(client: AgentContext): Promise<void> {
    const transcriptPath = await this.transcriptPath()
    await access(transcriptPath)
    const log = await loadTranscriptFromFile(transcriptPath)
    for (const message of log.messages) {
      await this.mapper.replay(message, client)
    }
  }

  cancel(): void {
    const turn = this.pendingTurn
    if (!turn || turn.cancelled) return
    turn.cancelled = true
    for (const controller of this.permissionRequests.values())
      controller.abort()
    void this.sendControl({ subtype: 'interrupt' }).catch(() => {})

    turn.timeout = setTimeout(() => {
      if (this.pendingTurn !== turn) return
      turn.resolve('cancelled')
      this.terminateChild()
    }, 10_000)
    turn.timeout.unref?.()
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    if (!this.child) return

    try {
      await Promise.race([
        this.sendControl({ subtype: 'end_session', reason: 'acp_disconnect' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('end_session timeout')), 2_000),
        ),
      ])
    } catch {
      // Closing is best effort; stdin close and SIGTERM remain as fallbacks.
    }
    this.child.stdin.end()
    await Promise.race([
      new Promise<void>(resolve => this.child?.once('exit', () => resolve())),
      new Promise<void>(resolve => setTimeout(resolve, 2_000)),
    ])
    this.terminateChild()
  }

  private async ensureStarted(): Promise<void> {
    if (this.child && this.child.exitCode === null) return
    if (this.startPromise) return await this.startPromise

    this.startPromise = this.startChild()
    try {
      await this.startPromise
    } finally {
      this.startPromise = undefined
    }
  }

  private async startChild(): Promise<void> {
    const { command, args } = currentCliCommand()
    const childArgs = [
      ...args,
      '--print',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-prompt-tool',
      'stdio',
    ]
    if (this.resumeOnNextSpawn) {
      childArgs.push('--resume', this.sessionId)
    } else {
      childArgs.push('--session-id', this.sessionId)
    }
    if (this.config.additionalDirectories.length > 0) {
      childArgs.push('--add-dir', ...this.config.additionalDirectories)
    }
    if (this.config.mcpServers.length > 0) {
      childArgs.push(
        '--mcp-config',
        JSON.stringify({
          mcpServers: convertAcpMcpServers(this.config.mcpServers),
        }),
        '--strict-mcp-config',
      )
    }

    const child = spawn(command, childArgs, {
      cwd: this.cwd,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        RECODE_ACP_CHILD: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child = child
    this.resumeOnNextSpawn = true

    const stdout = createInterface({ input: child.stdout })
    stdout.on('line', line => {
      this.dispatchChain = this.dispatchChain
        .then(() => this.handleLine(line))
        .catch(error => this.fail(error))
    })
    const stderr = createInterface({ input: child.stderr })
    stderr.on('line', line => {
      this.stderrTail.push(line)
      if (this.stderrTail.length > 30) this.stderrTail.shift()
      process.stderr.write(
        `[recode:acp:${this.sessionId.slice(0, 8)}] ${line}\n`,
      )
    })
    child.once('error', error => this.fail(error))
    child.once('exit', (code, signal) => {
      if (this.child === child) this.child = undefined
      if (!this.closed && (this.pendingTurn || this.controls.size > 0)) {
        this.fail(
          new Error(
            `Recode ACP worker exited (${signal ?? code ?? 'unknown'})${this.stderrTail.length ? `\n${this.stderrTail.join('\n')}` : ''}`,
          ),
        )
      }
    })

    await Promise.race([
      this.sendControl({ subtype: 'initialize' }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Recode ACP worker initialization timed out')),
          30_000,
        ),
      ),
    ])
  }

  private async handleLine(line: string): Promise<void> {
    if (!line.trim()) return
    let message: JsonObject
    try {
      message = JSON.parse(line) as JsonObject
    } catch {
      throw new Error(`Invalid stream-json output from Recode worker: ${line}`)
    }

    if (message.type === 'control_response') {
      const response = message.response as JsonObject | undefined
      const requestId = response?.request_id
      if (typeof requestId !== 'string') return
      const pending = this.controls.get(requestId)
      if (!pending) return
      this.controls.delete(requestId)
      if (response.subtype === 'error') {
        pending.reject(
          new Error(String(response.error ?? 'Control request failed')),
        )
      } else {
        pending.resolve(this.asObject(response.response))
      }
      return
    }

    if (message.type === 'control_request') {
      await this.handleControlRequest(message)
      return
    }
    if (message.type === 'control_cancel_request') {
      const requestId = message.request_id
      if (typeof requestId === 'string') {
        this.permissionRequests.get(requestId)?.abort()
        this.permissionRequests.delete(requestId)
      }
      return
    }

    const client = this.activeClient
    if (!client) return
    const result = await this.mapper.handle(message, client)
    if (result) this.finishTurn(result)
  }

  private async handleControlRequest(message: JsonObject): Promise<void> {
    const requestId = message.request_id
    const request = message.request as JsonObject | undefined
    if (typeof requestId !== 'string' || !request) return

    if (request.subtype !== 'can_use_tool') {
      this.write({
        type: 'control_response',
        response: {
          subtype: 'error',
          request_id: requestId,
          error: `Unsupported worker control request: ${String(request.subtype)}`,
        },
      })
      return
    }

    const client = this.activeClient
    const input = this.asObject(request.input)
    const toolName =
      typeof request.tool_name === 'string' ? request.tool_name : 'UnknownTool'
    const toolUseId =
      typeof request.tool_use_id === 'string'
        ? request.tool_use_id
        : randomUUID()
    if (!client) {
      this.sendPermissionDecision(requestId, {
        behavior: 'deny',
        message: 'No active ACP prompt can answer this permission request',
        toolUseID: toolUseId,
      })
      return
    }

    const controller = new AbortController()
    this.permissionRequests.set(requestId, controller)
    try {
      const suggestions = Array.isArray(request.permission_suggestions)
        ? request.permission_suggestions
        : []
      const options: PermissionOption[] = [
        {
          kind: 'allow_once' as const,
          name: 'Allow once',
          optionId: 'allow_once',
        },
        ...(suggestions.length > 0
          ? [
              {
                kind: 'allow_always' as const,
                name: 'Always allow',
                optionId: 'allow_always',
              },
            ]
          : []),
        {
          kind: 'reject_once' as const,
          name: 'Reject',
          optionId: 'reject_once',
        },
      ]
      const permissionRequest: RequestPermissionRequest = {
        sessionId: this.sessionId,
        toolCall: {
          toolCallId: toolUseId,
          title: String(request.description ?? request.title ?? toolName),
          status: 'pending',
          rawInput: input,
          _meta: { recode: { toolName } },
        },
        options,
      }
      const response = await client.request(
        methods.client.session.requestPermission,
        permissionRequest,
        { cancellationSignal: controller.signal },
      )

      if (response.outcome.outcome === 'cancelled') {
        this.pendingTurn && (this.pendingTurn.cancelled = true)
        this.sendPermissionDecision(requestId, {
          behavior: 'deny',
          message: 'Permission request cancelled by ACP client',
          interrupt: true,
          toolUseID: toolUseId,
          decisionClassification: 'user_reject',
        })
        void this.sendControl({ subtype: 'interrupt' }).catch(() => {})
      } else if (
        response.outcome.optionId === 'allow_once' ||
        response.outcome.optionId === 'allow_always'
      ) {
        this.sendPermissionDecision(requestId, {
          behavior: 'allow',
          updatedInput: input,
          ...(response.outcome.optionId === 'allow_always'
            ? { updatedPermissions: suggestions }
            : {}),
          toolUseID: toolUseId,
          decisionClassification:
            response.outcome.optionId === 'allow_always'
              ? 'user_permanent'
              : 'user_temporary',
        })
      } else {
        this.sendPermissionDecision(requestId, {
          behavior: 'deny',
          message: 'Permission denied by ACP client',
          toolUseID: toolUseId,
          decisionClassification: 'user_reject',
        })
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.sendPermissionDecision(requestId, {
          behavior: 'deny',
          message: `ACP permission request failed: ${String(error)}`,
          toolUseID: toolUseId,
        })
      }
    } finally {
      this.permissionRequests.delete(requestId)
    }
  }

  private sendPermissionDecision(
    requestId: string,
    response: JsonObject,
  ): void {
    this.write({
      type: 'control_response',
      response: { subtype: 'success', request_id: requestId, response },
    })
  }

  private finishTurn(result: RecodeTurnResult): void {
    const turn = this.pendingTurn
    if (!turn) return
    if (turn.timeout) clearTimeout(turn.timeout)
    turn.resolve(turn.cancelled ? 'cancelled' : result.stopReason)
  }

  private sendControl(request: JsonObject): Promise<JsonObject> {
    const requestId = randomUUID()
    const pending = deferred<JsonObject>()
    this.controls.set(requestId, pending)
    try {
      this.write({ type: 'control_request', request_id: requestId, request })
    } catch (error) {
      this.controls.delete(requestId)
      pending.reject(error)
    }
    return pending.promise
  }

  private write(message: JsonObject): void {
    if (
      !this.child ||
      this.child.exitCode !== null ||
      !this.child.stdin.writable
    ) {
      throw new Error(`Recode ACP worker for ${this.sessionId} is not running`)
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private fail(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error))
    this.pendingTurn?.reject(normalized)
    this.pendingTurn = undefined
    for (const pending of this.controls.values()) pending.reject(normalized)
    this.controls.clear()
  }

  private terminateChild(): void {
    const child = this.child
    if (!child) return
    this.child = undefined
    if (child.exitCode === null) child.kill('SIGTERM')
  }

  private async transcriptPath(): Promise<string> {
    const projectDir =
      (await findProjectDir(this.cwd)) ?? getProjectDir(this.cwd)
    return join(projectDir, `${this.sessionId}.jsonl`)
  }

  private asObject(value: unknown): JsonObject {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonObject)
      : {}
  }
}

export class RecodeAcpSessionManager {
  private readonly sessions = new Map<string, RecodeAcpSession>()

  async create(config: {
    cwd: string
    additionalDirectories?: string[]
    mcpServers: McpServer[]
  }): Promise<RecodeAcpSession> {
    const cwd = await this.validatePaths(
      config.cwd,
      config.additionalDirectories,
    )
    const session = new RecodeAcpSession({
      sessionId: randomUUID(),
      cwd,
      additionalDirectories: config.additionalDirectories ?? [],
      mcpServers: config.mcpServers,
      resume: false,
    })
    this.sessions.set(session.sessionId, session)
    return session
  }

  async load(config: {
    sessionId: string
    cwd: string
    additionalDirectories?: string[]
    mcpServers: McpServer[]
    client: AgentContext
  }): Promise<RecodeAcpSession> {
    const cwd = await this.validatePaths(
      config.cwd,
      config.additionalDirectories,
    )
    await this.sessions.get(config.sessionId)?.close()
    const session = new RecodeAcpSession({
      sessionId: config.sessionId,
      cwd,
      additionalDirectories: config.additionalDirectories ?? [],
      mcpServers: config.mcpServers,
      resume: true,
    })
    await session.replayHistory(config.client)
    this.sessions.set(session.sessionId, session)
    return session
  }

  get(sessionId: string): RecodeAcpSession {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Unknown ACP session: ${sessionId}`)
    return session
  }

  cancel(sessionId: string): void {
    this.sessions.get(sessionId)?.cancel()
  }

  async closeAll(): Promise<void> {
    await Promise.allSettled(
      [...this.sessions.values()].map(session => session.close()),
    )
    this.sessions.clear()
  }

  private async validatePaths(
    cwd: string,
    additionalDirectories: string[] = [],
  ): Promise<string> {
    if (!isAbsolute(cwd)) throw new Error(`ACP cwd must be absolute: ${cwd}`)
    for (const directory of additionalDirectories) {
      if (!isAbsolute(directory)) {
        throw new Error(
          `ACP additional directory must be absolute: ${directory}`,
        )
      }
    }
    await access(cwd)
    return await realpath(cwd)
  }
}
