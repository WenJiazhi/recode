export type MockProviderKind = 'anthropic' | 'openai'
export type MockScenario = 'flow' | 'http-error' | 'stream-error' | 'slow'

export type MockRequest = {
  body: Record<string, unknown>
  headers: Headers
  pathname: string
}

export type MockProvider = {
  failures: string[]
  origin: string
  requests: MockRequest[]
  stop(): void
}

type StartMockProviderOptions = {
  expectedApiKey: string
  expectedModel: string
  fixtureFile: string
  kind: MockProviderKind
  scenario: MockScenario
}

const TOOL_CALL_ID = 'recode_e2e_read_1'
const TOOL_RESULT_SENTINEL = 'RECODE_PROVIDER_TOOL_RESULT_OK'

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

function sseResponse(frames: string[]): Response {
  return new Response(`${frames.join('\n\n')}\n\n`, {
    headers: {
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'content-type': 'text/event-stream',
    },
  })
}

function anthropicFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}`
}

function openAIFrame(data: unknown | '[DONE]'): string {
  return `data: ${data === '[DONE]' ? data : JSON.stringify(data)}`
}

function anthropicMessageStart(model: string, withUsage: boolean): string {
  return anthropicFrame('message_start', {
    type: 'message_start',
    message: {
      id: 'msg_recode_e2e',
      type: 'message',
      role: 'assistant',
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      ...(withUsage
        ? {
            usage: {
              input_tokens: 17,
              output_tokens: 0,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            },
          }
        : {}),
    },
  })
}

function anthropicToolResponse(model: string, fixtureFile: string): Response {
  return sseResponse([
    anthropicMessageStart(model, true),
    anthropicFrame('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'tool_use',
        id: TOOL_CALL_ID,
        name: 'Read',
        input: {},
      },
    }),
    anthropicFrame('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'input_json_delta',
        partial_json: JSON.stringify({ file_path: fixtureFile }),
      },
    }),
    anthropicFrame('content_block_stop', {
      type: 'content_block_stop',
      index: 0,
    }),
    anthropicFrame('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'tool_use', stop_sequence: null },
      usage: { output_tokens: 8 },
    }),
    anthropicFrame('message_stop', { type: 'message_stop' }),
  ])
}

function anthropicFinalResponse(model: string): Response {
  const text = 'RECODE_PROVIDER_E2E_OK anthropic'
  return sseResponse([
    anthropicMessageStart(model, false),
    anthropicFrame('content_block_start', {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    }),
    anthropicFrame('content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    }),
    anthropicFrame('content_block_stop', {
      type: 'content_block_stop',
      index: 0,
    }),
    anthropicFrame('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
    }),
    anthropicFrame('message_stop', { type: 'message_stop' }),
  ])
}

function openAIChunk(
  model: string,
  choices: unknown[],
  usage?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    id: 'chatcmpl-recode-e2e',
    object: 'chat.completion.chunk',
    created: 1_784_000_000,
    model,
    choices,
    ...(usage ? { usage } : {}),
  }
}

function openAIToolResponse(model: string, fixtureFile: string): Response {
  return sseResponse([
    openAIFrame(
      openAIChunk(model, [
        {
          index: 0,
          delta: {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: TOOL_CALL_ID,
                type: 'function',
                function: {
                  name: 'Read',
                  arguments: JSON.stringify({ file_path: fixtureFile }),
                },
              },
            ],
          },
          finish_reason: null,
        },
      ]),
    ),
    openAIFrame(
      openAIChunk(model, [
        { index: 0, delta: {}, finish_reason: 'tool_calls' },
      ]),
    ),
    openAIFrame(
      openAIChunk(model, [], {
        prompt_tokens: 19,
        completion_tokens: 7,
        total_tokens: 26,
        prompt_tokens_details: { cached_tokens: 3 },
      }),
    ),
    openAIFrame('[DONE]'),
  ])
}

function openAIFinalResponse(model: string): Response {
  return sseResponse([
    openAIFrame(
      openAIChunk(model, [
        {
          index: 0,
          delta: {
            role: 'assistant',
            content: 'RECODE_PROVIDER_E2E_OK openai',
          },
          finish_reason: null,
        },
      ]),
    ),
    openAIFrame(
      openAIChunk(model, [
        { index: 0, delta: {}, finish_reason: 'stop' },
      ]),
    ),
    openAIFrame('[DONE]'),
  ])
}

function findAnthropicToolResult(body: Record<string, unknown>): unknown {
  const messages = Array.isArray(body.messages) ? body.messages : []
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue
    const content = (message as Record<string, unknown>).content
    if (!Array.isArray(content)) continue
    const result = content.find(
      block =>
        block &&
        typeof block === 'object' &&
        (block as Record<string, unknown>).type === 'tool_result' &&
        (block as Record<string, unknown>).tool_use_id === TOOL_CALL_ID,
    )
    if (result) return result
  }
  return undefined
}

function findOpenAIToolResult(body: Record<string, unknown>): unknown {
  const messages = Array.isArray(body.messages) ? body.messages : []
  return messages.find(
    message =>
      message &&
      typeof message === 'object' &&
      (message as Record<string, unknown>).role === 'tool' &&
      (message as Record<string, unknown>).tool_call_id === TOOL_CALL_ID,
  )
}

function requestHasToolResult(
  kind: MockProviderKind,
  body: Record<string, unknown>,
): boolean {
  const result =
    kind === 'anthropic'
      ? findAnthropicToolResult(body)
      : findOpenAIToolResult(body)
  return (
    result !== undefined &&
    JSON.stringify(result).includes(TOOL_RESULT_SENTINEL)
  )
}

function providerPath(kind: MockProviderKind): string {
  return kind === 'anthropic' ? '/v1/messages' : '/v1/chat/completions'
}

function expectedAuthHeader(kind: MockProviderKind): string {
  return kind === 'anthropic' ? 'x-api-key' : 'authorization'
}

function httpErrorResponse(kind: MockProviderKind): Response {
  const message = `RECODE_PROVIDER_HTTP_ERROR ${kind}`
  if (kind === 'anthropic') {
    return jsonResponse(
      {
        type: 'error',
        error: { type: 'invalid_request_error', message },
      },
      400,
    )
  }
  return jsonResponse(
    {
      error: {
        type: 'invalid_request_error',
        code: 'recode_e2e_http_error',
        message,
      },
    },
    400,
  )
}

function streamErrorResponse(kind: MockProviderKind): Response {
  const message = `RECODE_PROVIDER_STREAM_ERROR ${kind}`
  if (kind === 'anthropic') {
    return sseResponse([
      anthropicFrame('error', {
        type: 'error',
        error: { type: 'invalid_request_error', message },
      }),
    ])
  }
  return sseResponse([
    openAIFrame({
      error: {
        type: 'invalid_request_error',
        code: 'recode_e2e_stream_error',
        message,
      },
    }),
    openAIFrame('[DONE]'),
  ])
}

export function startMockProvider(
  options: StartMockProviderOptions,
): MockProvider {
  const failures: string[] = []
  const requests: MockRequest[] = []
  let providerRequestCount = 0

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)

      if (request.method === 'HEAD' && url.pathname === '/') {
        return new Response(null, { status: 204 })
      }

      if (request.method === 'GET' && url.pathname === '/v1/models') {
        return jsonResponse({
          object: 'list',
          data: [{ id: options.expectedModel, object: 'model' }],
        })
      }

      if (
        request.method !== 'POST' ||
        url.pathname !== providerPath(options.kind)
      ) {
        failures.push(`Unexpected request: ${request.method} ${url.pathname}`)
        return jsonResponse({ error: { message: 'Unexpected mock route' } }, 404)
      }

      let body: Record<string, unknown>
      try {
        body = (await request.json()) as Record<string, unknown>
      } catch {
        failures.push('Provider request body was not valid JSON')
        return jsonResponse({ error: { message: 'Invalid JSON' } }, 400)
      }

      requests.push({ body, headers: request.headers, pathname: url.pathname })
      providerRequestCount++

      const authHeader = expectedAuthHeader(options.kind)
      const expectedAuth =
        options.kind === 'anthropic'
          ? options.expectedApiKey
          : `Bearer ${options.expectedApiKey}`
      if (request.headers.get(authHeader) !== expectedAuth) {
        failures.push(`Incorrect ${authHeader} authentication header`)
      }
      if (body.model !== options.expectedModel) {
        failures.push(
          `Expected model ${options.expectedModel}, received ${String(body.model)}`,
        )
      }
      if (body.stream !== true) {
        failures.push('Provider request did not enable streaming')
      }

      if (options.scenario === 'http-error') {
        return httpErrorResponse(options.kind)
      }
      if (options.scenario === 'stream-error') {
        return streamErrorResponse(options.kind)
      }
      if (options.scenario === 'slow') {
        await new Promise<void>(resolve => {
          const timeout = setTimeout(resolve, 20_000)
          request.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timeout)
              resolve()
            },
            { once: true },
          )
        })
        return options.kind === 'anthropic'
          ? anthropicFinalResponse(options.expectedModel)
          : openAIFinalResponse(options.expectedModel)
      }

      if (providerRequestCount === 1) {
        const tools = Array.isArray(body.tools) ? body.tools : []
        if (!JSON.stringify(tools).includes('Read')) {
          failures.push('Read tool schema was not sent to the provider')
        }
        return options.kind === 'anthropic'
          ? anthropicToolResponse(options.expectedModel, options.fixtureFile)
          : openAIToolResponse(options.expectedModel, options.fixtureFile)
      }

      if (providerRequestCount === 2) {
        if (!requestHasToolResult(options.kind, body)) {
          failures.push('Read tool_result was not returned to the provider')
        }
        return options.kind === 'anthropic'
          ? anthropicFinalResponse(options.expectedModel)
          : openAIFinalResponse(options.expectedModel)
      }

      failures.push(`Unexpected provider request #${providerRequestCount}`)
      return httpErrorResponse(options.kind)
    },
  })

  return {
    failures,
    origin: `http://${server.hostname}:${server.port}`,
    requests,
    stop() {
      server.stop(true)
    },
  }
}

export { TOOL_RESULT_SENTINEL }
