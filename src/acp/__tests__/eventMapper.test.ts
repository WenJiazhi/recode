import { describe, expect, test } from 'bun:test'
import type {
  AgentContext,
  SessionNotification,
} from '@agentclientprotocol/sdk'
import { RecodeAcpEventMapper } from '../eventMapper.js'

function fakeClient() {
  const notifications: SessionNotification[] = []
  const client = {
    notify: async (_method: string, params: SessionNotification) => {
      notifications.push(params)
    },
    request: async () => ({
      outcome: { outcome: 'selected', optionId: 'allow_once' },
    }),
  } as unknown as AgentContext
  return { client, notifications }
}

describe('RecodeAcpEventMapper', () => {
  test('streams text once and exposes a complete tool lifecycle', async () => {
    const { client, notifications } = fakeClient()
    const mapper = new RecodeAcpEventMapper('session-1', '/workspace')

    await mapper.handle(
      { type: 'stream_event', event: { type: 'message_start' } },
      client,
    )
    await mapper.handle(
      {
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'hello' },
        },
      },
      client,
    )
    await mapper.handle(
      {
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 1,
          content_block: {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Read',
            input: {},
          },
        },
      },
      client,
    )
    await mapper.handle(
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'hello' },
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: 'README.md' },
            },
          ],
        },
      },
      client,
    )
    await mapper.handle(
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-1',
              content: 'contents',
            },
          ],
        },
      },
      client,
    )

    const updates = notifications.map(notification => notification.update)
    expect(
      updates.filter(update => update.sessionUpdate === 'agent_message_chunk'),
    ).toHaveLength(1)
    expect(updates).toContainEqual(
      expect.objectContaining({
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-1',
        status: 'pending',
      }),
    )
    expect(updates).toContainEqual(
      expect.objectContaining({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-1',
        status: 'in_progress',
        rawInput: { file_path: 'README.md' },
      }),
    )
    expect(updates).toContainEqual(
      expect.objectContaining({
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-1',
        status: 'completed',
      }),
    )
  })

  test('maps TodoWrite and result usage to typed ACP updates', async () => {
    const { client, notifications } = fakeClient()
    const mapper = new RecodeAcpEventMapper('session-2', '/workspace')

    await mapper.handle(
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'todo-1',
              name: 'TodoWrite',
              input: {
                todos: [
                  { content: 'Inspect code', status: 'completed' },
                  { content: 'Add tests', status: 'in_progress' },
                ],
              },
            },
          ],
        },
      },
      client,
    )
    const result = await mapper.handle(
      {
        type: 'result',
        subtype: 'success',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 4 },
        modelUsage: { model: { contextWindow: 128_000 } },
      },
      client,
    )

    expect(result?.stopReason).toBe('end_turn')
    expect(notifications.map(item => item.update)).toContainEqual({
      sessionUpdate: 'plan',
      entries: [
        { content: 'Inspect code', priority: 'medium', status: 'completed' },
        { content: 'Add tests', priority: 'medium', status: 'in_progress' },
      ],
    })
    expect(notifications.map(item => item.update)).toContainEqual({
      sessionUpdate: 'usage_update',
      used: 14,
      size: 128_000,
    })
  })
})
