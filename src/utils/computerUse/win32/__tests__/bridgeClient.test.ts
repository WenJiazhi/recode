import { afterEach, describe, expect, test } from 'bun:test'
import { _test, parseBridgeResponseFromStdout } from '../bridgeClient.js'

afterEach(() => {
  _test.resetStateForTest()
})

describe('parseBridgeResponseFromStdout', () => {
  test('parses a plain single-line bridge response', () => {
    const response = parseBridgeResponseFromStdout(
      '{"id":1,"result":{"ok":true}}',
    )
    expect(response).not.toBeNull()
    expect(response?.id).toBe(1)
    expect(response?.result).toEqual({ ok: true })
  })

  test('ignores non-json log lines and picks the last valid response line', () => {
    const response = parseBridgeResponseFromStdout(
      'hookify: debug noise\n{"id":1,"result":{"first":true}}\n{"id":2,"result":{"second":true}}',
    )
    expect(response).not.toBeNull()
    expect(response?.id).toBe(2)
    expect(response?.result).toEqual({ second: true })
  })

  test('parses a response line with prefixed noise before the JSON object', () => {
    const response = parseBridgeResponseFromStdout(
      'WARNING: fallback parser {"id":7,"error":"boom"}',
    )
    expect(response).not.toBeNull()
    expect(response?.id).toBe(7)
    expect(response?.error).toBe('boom')
  })

  test('returns null when no valid bridge response object exists', () => {
    const response = parseBridgeResponseFromStdout(
      'not json\n{"hello":"world"}\n[]',
    )
    expect(response).toBeNull()
  })

  test('invalidateBridge clears the active proc and rejects pending requests', async () => {
    const proc = {} as ReturnType<typeof Bun.spawn>
    let rejectedMessage: string | null = null

    _test.setBridgeProcForTest(proc)
    _test.addPendingRequestForTest(1, {
      resolve: () => {},
      reject: error => {
        rejectedMessage = error.message
      },
    })

    _test.invalidateBridge(proc, new Error('Python bridge exited unexpectedly'))
    await Promise.resolve()

    expect(_test.getBridgeProcForTest()).toBeNull()
    expect(_test.getPendingRequestCountForTest()).toBe(0)
    expect(rejectedMessage).toBe('Python bridge exited unexpectedly')
  })

  test('invalidateBridge ignores stale termination from an older proc', async () => {
    const oldProc = {} as ReturnType<typeof Bun.spawn>
    const newProc = {} as ReturnType<typeof Bun.spawn>
    let rejectedMessage: string | null = null

    _test.setBridgeProcForTest(newProc)
    _test.addPendingRequestForTest(2, {
      resolve: () => {},
      reject: error => {
        rejectedMessage = error.message
      },
    })

    _test.invalidateBridge(oldProc, new Error('old bridge exited'))
    await Promise.resolve()

    expect(_test.getBridgeProcForTest()).toBe(newProc)
    expect(_test.getPendingRequestCountForTest()).toBe(1)
    expect(rejectedMessage).toBeNull()
  })
})
