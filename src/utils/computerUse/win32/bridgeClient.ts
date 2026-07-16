/**
 * Python Bridge Client — manages a long-lived Python subprocess for Windows
 * Computer Use operations.
 *
 * Replaces per-call PowerShell spawning with a persistent Python process
 * that communicates via JSON lines over stdin/stdout.
 *
 * Performance: ~1-5ms per call vs ~200-500ms per PowerShell spawn.
 */

import * as path from 'path'

interface BridgeRequest {
  id: number
  method: string
  params: Record<string, unknown>
}

interface BridgeResponse {
  id: number
  result?: unknown
  error?: string
}

function isBridgeResponse(value: unknown): value is BridgeResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as BridgeResponse).id === 'number'
  )
}

function tryParseBridgeResponse(text: string): BridgeResponse | null {
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as unknown
    return isBridgeResponse(parsed) ? parsed : null
  } catch {
    const firstBrace = text.indexOf('{')
    if (firstBrace === -1) return null
    try {
      const parsed = JSON.parse(text.slice(firstBrace)) as unknown
      return isBridgeResponse(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

export function parseBridgeResponseFromStdout(stdout: string): BridgeResponse | null {
  const trimmed = stdout.trim()
  if (!trimmed) return null

  const lines = trimmed
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  for (let i = lines.length - 1; i >= 0; i--) {
    const parsed = tryParseBridgeResponse(lines[i]!)
    if (parsed) return parsed
  }

  return tryParseBridgeResponse(trimmed)
}

let bridgeProc: ReturnType<typeof Bun.spawn> | null = null
let requestId = 0
const pendingRequests = new Map<
  number,
  {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }
>()
let outputBuffer = ''

function rejectPendingRequests(error: Error): void {
  if (pendingRequests.size === 0) return

  const entries = [...pendingRequests.values()]
  pendingRequests.clear()
  for (const pending of entries) {
    pending.reject(error)
  }
}

function invalidateBridge(
  proc: ReturnType<typeof Bun.spawn> | null,
  error: Error,
): void {
  if (proc && bridgeProc !== proc) return

  bridgeProc = null
  outputBuffer = ''
  rejectPendingRequests(error)
}

/**
 * Start the Python bridge process if not already running.
 */
export function ensureBridge(): boolean {
  if (bridgeProc) return true
  try {
    const scriptPath = path.join(__dirname, 'bridge.py')
    const proc = Bun.spawn(['python', '-u', scriptPath], {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'ignore',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
    })
    bridgeProc = proc
    outputBuffer = ''

    void proc.exited
      .then(() => {
        invalidateBridge(proc, new Error('Python bridge exited unexpectedly'))
      })
      .catch(() => {
        invalidateBridge(proc, new Error('Python bridge exited unexpectedly'))
      })

    // Read stdout lines asynchronously
    const reader = proc.stdout.getReader()
    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            invalidateBridge(
              proc,
              new Error('Python bridge stdout closed unexpectedly'),
            )
            break
          }
          outputBuffer += new TextDecoder().decode(value)
          // Process complete lines
          let newlineIdx: number
          while ((newlineIdx = outputBuffer.indexOf('\n')) !== -1) {
            const line = outputBuffer.slice(0, newlineIdx).trim()
            outputBuffer = outputBuffer.slice(newlineIdx + 1)
            if (!line) continue
            const resp = tryParseBridgeResponse(line)
            if (!resp) continue
            const pending = pendingRequests.get(resp.id)
            if (pending) {
              pendingRequests.delete(resp.id)
              if (resp.error) {
                pending.reject(new Error(resp.error))
              } else {
                pending.resolve(resp.result)
              }
            }
          }
        }
      } catch (error) {
        invalidateBridge(
          proc,
          new Error(
            `Python bridge stdout read failed: ${error instanceof Error ? error.message : String(error)}`,
          ),
        )
      }
    }
    void readLoop()

    return true
  } catch {
    bridgeProc = null
    return false
  }
}

/**
 * Send a request to the Python bridge and wait for the response.
 */
export async function call<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs: number = 10000,
): Promise<T> {
  if (!ensureBridge()) {
    throw new Error('Python bridge not available')
  }

  const id = ++requestId
  const req: BridgeRequest = { id, method, params }

  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
    })

    // Timeout
    const timer = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error(`Bridge call ${method} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    // Clear timeout on resolve/reject
    const origResolve = resolve
    const origReject = reject
    pendingRequests.set(id, {
      resolve: v => {
        clearTimeout(timer)
        ;(origResolve as any)(v)
      },
      reject: e => {
        clearTimeout(timer)
        origReject(e)
      },
    })

    try {
      const stdin = bridgeProc!.stdin
      if (typeof stdin === 'number') {
        throw new Error('Bridge stdin is not writable')
      }
      stdin.write(JSON.stringify(req) + '\n')
      stdin.flush()
    } catch (err) {
      clearTimeout(timer)
      pendingRequests.delete(id)
      reject(new Error(`Bridge write failed: ${err}`))
    }
  })
}

/**
 * Synchronous call — blocks the event loop. Use sparingly.
 * Falls back to PowerShell if bridge is not available.
 */
export function callSync<T = unknown>(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs: number = 10000,
): T | null {
  // For sync calls, spawn a one-shot Python process.
  // SECURITY: JSON is passed via stdin (not embedded in -c) to prevent code injection.
  try {
    const scriptPath = path.join(__dirname, 'bridge.py')
    const req = JSON.stringify({ id: 1, method, params })
    const result = Bun.spawnSync({
      cmd: ['python', '-u', scriptPath],
      stdin: Buffer.from(req + '\n'),
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      timeout: timeoutMs,
    })
    const out = new TextDecoder().decode(result.stdout).trim()
    if (!out) return null
    const resp = parseBridgeResponseFromStdout(out)
    if (!resp) return null
    if (resp.error) throw new Error(resp.error)
    return resp.result as T
  } catch {
    return null
  }
}

/**
 * Kill the bridge process.
 */
export function stopBridge(): void {
  if (bridgeProc) {
    const proc = bridgeProc
    try {
      if (typeof proc.stdin !== 'number') proc.stdin.end()
      proc.kill()
    } catch {}
    bridgeProc = null
  }
  outputBuffer = ''
  pendingRequests.clear()
}

// NOTE: No process exit handlers here — the platform-level win32.ts
// already registers exit/SIGINT/SIGTERM handlers that call cleanupAll(),
// which includes stopBridge(). Adding handlers here would cause double
// cleanup and duplicate process.exit() calls.

export const _test = {
  invalidateBridge,
  rejectPendingRequests,
  setBridgeProcForTest(proc: ReturnType<typeof Bun.spawn> | null) {
    bridgeProc = proc
  },
  getBridgeProcForTest() {
    return bridgeProc
  },
  addPendingRequestForTest(
    id: number,
    handlers: {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
    },
  ) {
    pendingRequests.set(id, handlers)
  },
  getPendingRequestCountForTest() {
    return pendingRequests.size
  },
  resetStateForTest() {
    bridgeProc = null
    outputBuffer = ''
    pendingRequests.clear()
  },
}
