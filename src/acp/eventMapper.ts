import {
  methods,
  type AgentContext,
  type SessionUpdate,
  type StopReason,
} from '@agentclientprotocol/sdk'
import { randomUUID } from 'node:crypto'
import {
  getPlanEntries,
  getRecodeToolInfo,
  toolResultContent,
} from './toolInfo.js'

type JsonObject = Record<string, unknown>

type ToolState = {
  name: string
  input: JsonObject
  emitted: boolean
}

export type RecodeTurnResult = {
  stopReason: StopReason
  errors: string[]
}

export class RecodeAcpEventMapper {
  private readonly tools = new Map<string, ToolState>()
  private readonly blockTools = new Map<number, string>()
  private readonly partialInputs = new Map<number, string>()
  private streamingActive = false
  private messageId: string | undefined

  constructor(
    private readonly sessionId: string,
    private readonly cwd: string,
  ) {}

  async handle(
    rawMessage: unknown,
    client: AgentContext,
  ): Promise<RecodeTurnResult | undefined> {
    if (!rawMessage || typeof rawMessage !== 'object') return undefined
    const message = rawMessage as JsonObject

    switch (message.type) {
      case 'stream_event':
        await this.handleStreamEvent(message, client)
        return undefined
      case 'assistant':
        await this.handleAssistant(message, client)
        return undefined
      case 'user':
        await this.handleUserContent(message, client, false)
        return undefined
      case 'tool_progress':
        await this.handleToolProgress(message, client)
        return undefined
      case 'system':
        await this.handleSystem(message, client)
        return undefined
      case 'result':
        return await this.handleResult(message, client)
      default:
        return undefined
    }
  }

  async replay(rawMessage: unknown, client: AgentContext): Promise<void> {
    if (!rawMessage || typeof rawMessage !== 'object') return
    const message = rawMessage as JsonObject
    this.streamingActive = false
    this.messageId =
      typeof message.uuid === 'string' ? message.uuid : randomUUID()

    if (message.type === 'assistant') {
      await this.handleAssistant(message, client)
    } else if (message.type === 'user') {
      await this.handleUserContent(message, client, true)
    }
  }

  private async notify(
    client: AgentContext,
    update: SessionUpdate,
  ): Promise<void> {
    await client.notify(methods.client.session.update, {
      sessionId: this.sessionId,
      update,
    })
  }

  private currentMessageId(): string {
    this.messageId ??= randomUUID()
    return this.messageId
  }

  private async handleStreamEvent(
    message: JsonObject,
    client: AgentContext,
  ): Promise<void> {
    const event = message.event as JsonObject | undefined
    if (!event || typeof event.type !== 'string') return

    if (event.type === 'message_start') {
      this.messageId = randomUUID()
      this.streamingActive = false
      this.blockTools.clear()
      this.partialInputs.clear()
      return
    }

    if (event.type === 'content_block_start') {
      const block = event.content_block as JsonObject | undefined
      if (!block) return
      this.streamingActive = true
      const index = typeof event.index === 'number' ? event.index : -1
      if (
        block.type === 'text' &&
        typeof block.text === 'string' &&
        block.text
      ) {
        await this.emitText(client, block.text, false)
      } else if (
        block.type === 'thinking' &&
        typeof block.thinking === 'string' &&
        block.thinking
      ) {
        await this.emitText(client, block.thinking, true)
      } else if (
        block.type === 'tool_use' ||
        block.type === 'server_tool_use' ||
        block.type === 'mcp_tool_use'
      ) {
        const id = typeof block.id === 'string' ? block.id : randomUUID()
        const name = typeof block.name === 'string' ? block.name : 'UnknownTool'
        const input = this.asObject(block.input)
        if (index >= 0) this.blockTools.set(index, id)
        await this.handleToolUse(id, name, input, client)
      }
      return
    }

    if (event.type === 'content_block_delta') {
      const delta = event.delta as JsonObject | undefined
      if (!delta) return
      this.streamingActive = true
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        await this.emitText(client, delta.text, false)
      } else if (
        delta.type === 'thinking_delta' &&
        typeof delta.thinking === 'string'
      ) {
        await this.emitText(client, delta.thinking, true)
      } else if (
        delta.type === 'input_json_delta' &&
        typeof delta.partial_json === 'string' &&
        typeof event.index === 'number'
      ) {
        this.partialInputs.set(
          event.index,
          `${this.partialInputs.get(event.index) ?? ''}${delta.partial_json}`,
        )
      }
      return
    }

    if (
      event.type === 'content_block_stop' &&
      typeof event.index === 'number'
    ) {
      const toolId = this.blockTools.get(event.index)
      const partial = this.partialInputs.get(event.index)
      const state = toolId ? this.tools.get(toolId) : undefined
      if (toolId && state && partial) {
        try {
          const parsed = JSON.parse(partial)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            state.input = parsed as JsonObject
            await this.emitToolUpdate(toolId, state, client)
          }
        } catch {
          // The complete assistant message carries a validated input fallback.
        }
      }
    }
  }

  private async handleAssistant(
    message: JsonObject,
    client: AgentContext,
  ): Promise<void> {
    const assistant = message.message as JsonObject | undefined
    const content = assistant?.content
    const wasStreaming = this.streamingActive

    if (typeof content === 'string') {
      if (!wasStreaming && content) await this.emitText(client, content, false)
    } else if (Array.isArray(content)) {
      for (const rawBlock of content) {
        if (!rawBlock || typeof rawBlock !== 'object') continue
        const block = rawBlock as JsonObject
        if (block.type === 'text' && typeof block.text === 'string') {
          if (!wasStreaming) await this.emitText(client, block.text, false)
        } else if (
          block.type === 'thinking' &&
          typeof block.thinking === 'string'
        ) {
          if (!wasStreaming) await this.emitText(client, block.thinking, true)
        } else if (
          block.type === 'tool_use' ||
          block.type === 'server_tool_use' ||
          block.type === 'mcp_tool_use'
        ) {
          const id = typeof block.id === 'string' ? block.id : randomUUID()
          const name =
            typeof block.name === 'string' ? block.name : 'UnknownTool'
          await this.handleToolUse(id, name, this.asObject(block.input), client)
        }
      }
    }

    if (message.error) {
      await this.emitText(
        client,
        `\nRecode assistant error: ${String(message.error)}`,
        false,
      )
    }
    this.streamingActive = false
    this.messageId = undefined
  }

  private async handleUserContent(
    message: JsonObject,
    client: AgentContext,
    replayText: boolean,
  ): Promise<void> {
    const user = message.message as JsonObject | undefined
    const content = user?.content
    if (typeof content === 'string') {
      if (replayText && content) {
        await this.notify(client, {
          sessionUpdate: 'user_message_chunk',
          messageId: this.currentMessageId(),
          content: { type: 'text', text: content },
        })
      }
      return
    }
    if (!Array.isArray(content)) return

    for (const rawBlock of content) {
      if (!rawBlock || typeof rawBlock !== 'object') continue
      const block = rawBlock as JsonObject
      if (
        block.type === 'text' &&
        replayText &&
        typeof block.text === 'string'
      ) {
        await this.notify(client, {
          sessionUpdate: 'user_message_chunk',
          messageId: this.currentMessageId(),
          content: { type: 'text', text: block.text },
        })
      } else if (
        block.type === 'tool_result' ||
        block.type === 'mcp_tool_result'
      ) {
        const id =
          typeof block.tool_use_id === 'string' ? block.tool_use_id : undefined
        if (!id || !this.tools.has(id)) continue
        await this.notify(client, {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          status: block.is_error === true ? 'failed' : 'completed',
          rawOutput: block.content,
          content: toolResultContent(block.content),
        })
      }
    }
  }

  private async handleToolUse(
    id: string,
    name: string,
    input: JsonObject,
    client: AgentContext,
  ): Promise<void> {
    const existing = this.tools.get(id)
    const state: ToolState = existing ?? { name, input, emitted: false }
    state.name = name
    state.input = input
    this.tools.set(id, state)

    const plan = getPlanEntries(name, input)
    if (plan) {
      await this.notify(client, { sessionUpdate: 'plan', entries: plan })
      return
    }

    if (state.emitted) {
      await this.emitToolUpdate(id, state, client)
      return
    }

    state.emitted = true
    await this.notify(client, {
      sessionUpdate: 'tool_call',
      toolCallId: id,
      status: 'pending',
      rawInput: input,
      ...getRecodeToolInfo(name, input, this.cwd),
      _meta: { recode: { toolName: name } },
    })
  }

  private async emitToolUpdate(
    id: string,
    state: ToolState,
    client: AgentContext,
  ): Promise<void> {
    await this.notify(client, {
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      status: 'in_progress',
      rawInput: state.input,
      ...getRecodeToolInfo(state.name, state.input, this.cwd),
      _meta: { recode: { toolName: state.name } },
    })
  }

  private async handleToolProgress(
    message: JsonObject,
    client: AgentContext,
  ): Promise<void> {
    if (typeof message.tool_use_id !== 'string') return
    const elapsed =
      typeof message.elapsed_time_seconds === 'number'
        ? ` (${message.elapsed_time_seconds}s)`
        : ''
    await this.notify(client, {
      sessionUpdate: 'tool_call_update',
      toolCallId: message.tool_use_id,
      status: 'in_progress',
      title: `${String(message.tool_name ?? 'Tool')}${elapsed}`,
    })
  }

  private async handleSystem(
    message: JsonObject,
    client: AgentContext,
  ): Promise<void> {
    if (
      message.subtype === 'local_command_output' &&
      typeof message.content === 'string'
    ) {
      await this.emitText(client, message.content, false)
    } else if (message.subtype === 'compact_boundary') {
      await this.emitText(client, '\n[Context compacted]\n', false)
    }
  }

  private async handleResult(
    message: JsonObject,
    client: AgentContext,
  ): Promise<RecodeTurnResult> {
    const errors = Array.isArray(message.errors)
      ? message.errors.filter(
          (error): error is string => typeof error === 'string',
        )
      : []
    if (errors.length > 0) {
      await this.emitText(
        client,
        `\nRecode turn failed: ${errors.join('; ')}`,
        false,
      )
    }

    const usage = this.asObject(message.usage)
    const used = [
      usage.input_tokens,
      usage.output_tokens,
      usage.cache_read_input_tokens,
      usage.cache_creation_input_tokens,
    ].reduce<number>(
      (sum, value) => sum + (typeof value === 'number' ? value : 0),
      0,
    )
    const modelUsage = this.asObject(message.modelUsage)
    const contextSize = Object.values(modelUsage).find(
      value => value && typeof value === 'object' && 'contextWindow' in value,
    ) as JsonObject | undefined
    if (used > 0) {
      await this.notify(client, {
        sessionUpdate: 'usage_update',
        used,
        size:
          typeof contextSize?.contextWindow === 'number'
            ? contextSize.contextWindow
            : Math.max(used, 200_000),
      })
    }

    let stopReason: StopReason = 'end_turn'
    if (message.stop_reason === 'max_tokens') stopReason = 'max_tokens'
    else if (message.stop_reason === 'refusal') stopReason = 'refusal'
    else if (
      message.subtype === 'error_max_turns' ||
      message.subtype === 'error_max_budget_usd' ||
      message.subtype === 'error_max_structured_output_retries'
    ) {
      stopReason = 'max_turn_requests'
    }
    return { stopReason, errors }
  }

  private async emitText(
    client: AgentContext,
    text: string,
    thinking: boolean,
  ): Promise<void> {
    if (!text) return
    await this.notify(client, {
      sessionUpdate: thinking ? 'agent_thought_chunk' : 'agent_message_chunk',
      messageId: this.currentMessageId(),
      content: { type: 'text', text },
    })
  }

  private asObject(value: unknown): JsonObject {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonObject)
      : {}
  }
}
