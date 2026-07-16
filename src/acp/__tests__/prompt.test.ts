import { describe, expect, test } from 'bun:test'
import type { ContentBlock } from '@agentclientprotocol/sdk'
import { convertAcpPrompt } from '../prompt.js'

describe('convertAcpPrompt', () => {
  test('preserves baseline text, links, and embedded text resources', () => {
    const result = convertAcpPrompt([
      { type: 'text', text: 'Review this file.' },
      {
        type: 'resource_link',
        name: 'README',
        uri: 'file:///workspace/README.md',
      },
      {
        type: 'resource',
        resource: {
          uri: 'file:///workspace/context.txt',
          text: 'embedded context',
        },
      },
    ] as ContentBlock[])

    expect(result.text).toContain('Review this file.')
    expect(result.text).toContain('file:///workspace/README.md')
    expect(result.text).toContain('embedded context')
    expect(result.degradedContentTypes).toEqual([])
  })

  test('marks unsupported media instead of silently dropping it', () => {
    const result = convertAcpPrompt([
      { type: 'image', data: 'AA==', mimeType: 'image/png' },
      {
        type: 'resource',
        resource: {
          uri: 'file:///workspace/archive.bin',
          blob: 'AA==',
          mimeType: 'application/octet-stream',
        },
      },
    ] as ContentBlock[])

    expect(result.text).toContain('Unsupported ACP image content omitted')
    expect(result.text).toContain('Unsupported binary resource omitted')
    expect(result.degradedContentTypes).toEqual(['image', 'resource:blob'])
  })
})
