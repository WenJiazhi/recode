import type { ContentBlock } from '@agentclientprotocol/sdk'

export type ConvertedPrompt = {
  text: string
  degradedContentTypes: string[]
}

function describeResourceLink(block: Record<string, unknown>): string {
  const name = typeof block.name === 'string' ? block.name : 'resource'
  const uri = typeof block.uri === 'string' ? block.uri : '(missing URI)'
  return `[Resource: ${name} | ${uri}]`
}

export function convertAcpPrompt(prompt: ContentBlock[]): ConvertedPrompt {
  const parts: string[] = []
  const degradedContentTypes = new Set<string>()

  for (const rawBlock of prompt) {
    const block = rawBlock as unknown as Record<string, unknown>
    switch (block.type) {
      case 'text':
        parts.push(typeof block.text === 'string' ? block.text : '')
        break
      case 'resource_link':
        parts.push(describeResourceLink(block))
        break
      case 'resource': {
        const resource = block.resource as Record<string, unknown> | undefined
        if (typeof resource?.text === 'string') {
          parts.push(
            `[Embedded resource: ${String(resource.uri ?? '(missing URI)')}]\n${resource.text}`,
          )
        } else {
          const type = 'resource:blob'
          degradedContentTypes.add(type)
          parts.push(
            `[Unsupported binary resource omitted: ${String(resource?.uri ?? '(missing URI)')}]`,
          )
        }
        break
      }
      case 'image':
      case 'audio':
        degradedContentTypes.add(String(block.type))
        parts.push(
          `[Unsupported ACP ${String(block.type)} content omitted (${String(block.mimeType ?? 'unknown MIME type')})]`,
        )
        break
      default: {
        const type =
          typeof block.type === 'string' ? block.type : 'unknown-content'
        degradedContentTypes.add(type)
        parts.push(`[Unsupported ACP content omitted: ${type}]`)
      }
    }
  }

  return {
    text: parts.filter(Boolean).join('\n'),
    degradedContentTypes: [...degradedContentTypes],
  }
}
