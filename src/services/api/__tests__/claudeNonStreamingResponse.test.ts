import { describe, expect, test } from 'bun:test'
import { normalizeNonStreamingResponse } from '../claude.js'

describe('normalizeNonStreamingResponse', () => {
  test('rejects stream-like or empty HTTP 200 responses clearly', () => {
    expect(() => normalizeNonStreamingResponse({}, 'fallback-model')).toThrow(
      'API returned an empty or malformed response (HTTP 200)',
    )
  })

  test('fills missing usage without discarding valid content', () => {
    const response = normalizeNonStreamingResponse(
      {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'provider-model',
        content: [{ type: 'text', text: 'OK' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
      },
      'fallback-model',
    )

    expect(response.content[0]?.type).toBe('text')
    expect((response.content[0] as { type: 'text'; text: string }).text).toBe(
      'OK',
    )
    expect(response.usage.input_tokens).toBe(0)
    expect(response.usage.output_tokens).toBe(0)
  })
})
