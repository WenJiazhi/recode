import {
  agent,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
} from '@agentclientprotocol/sdk'
import { Readable, Writable } from 'node:stream'
import { convertAcpPrompt } from './prompt.js'
import { RecodeAcpSessionManager } from './sessionProcess.js'

export async function runAcpServer(): Promise<void> {
  const sessions = new RecodeAcpSessionManager()
  const app = agent({ name: 'recode' })
    .onRequest(methods.agent.initialize, context => ({
      protocolVersion:
        context.params.protocolVersion === PROTOCOL_VERSION
          ? context.params.protocolVersion
          : PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: { embeddedContext: true },
        mcpCapabilities: { http: true, sse: true },
        sessionCapabilities: { additionalDirectories: {} },
      },
      authMethods: [],
      agentInfo: { name: 'recode', version: MACRO.VERSION },
    }))
    .onRequest(methods.agent.session.new, async context => {
      const session = await sessions.create(context.params)
      return { sessionId: session.sessionId }
    })
    .onRequest(methods.agent.session.load, async context => {
      await sessions.load({ ...context.params, client: context.client })
      return {}
    })
    .onRequest(methods.agent.session.prompt, async context => {
      const session = sessions.get(context.params.sessionId)
      const converted = convertAcpPrompt(context.params.prompt)
      if (converted.degradedContentTypes.length > 0) {
        process.stderr.write(
          `[recode:acp] Prompt content degraded: ${converted.degradedContentTypes.join(', ')}\n`,
        )
      }
      if (!converted.text.trim()) {
        throw new Error('ACP prompt did not contain usable content')
      }

      const onAbort = () => session.cancel()
      context.signal.addEventListener('abort', onAbort, { once: true })
      try {
        return {
          stopReason: await session.prompt(converted.text, context.client),
        }
      } finally {
        context.signal.removeEventListener('abort', onAbort)
      }
    })
    .onNotification(methods.agent.session.cancel, context => {
      sessions.cancel(context.params.sessionId)
    })

  const writable = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>
  const readable = Readable.toWeb(
    process.stdin,
  ) as unknown as ReadableStream<Uint8Array>
  const connection = app.connect(ndJsonStream(writable, readable))

  try {
    await connection.closed
  } finally {
    await sessions.closeAll()
  }
}
