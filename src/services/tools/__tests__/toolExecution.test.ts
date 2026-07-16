import { expect, test } from 'bun:test'
import type { Tool } from '../../../Tool.js'
import { TOOL_SEARCH_TOOL_NAME } from '../../../tools/ToolSearchTool/prompt.js'
import { buildSchemaNotSentHint } from '../toolExecution.js'

function makeDeferredTool(name: string, userFacingName = name): Tool {
  return {
    name,
    userFacingName: () => userFacingName,
    isEnabled: () => true,
    isReadOnly: () => false,
    isConcurrencySafe: () => false,
    isDestructive: () => false,
    checkPermissions: async input => ({ behavior: 'allow', updatedInput: input }),
    toAutoClassifierInput: () => '',
    prompt: async () => '',
    inputSchema: { safeParse: () => ({ success: true, data: {} }) } as any,
    renderResultForAssistant: async () => '',
    renderToolUseMessage: async () => '',
    renderToolUseRejectedMessage: async () => '',
    renderResultForUser: async () => '',
    call: async () => ({}),
    validateInput: async () => ({ result: true }),
    shouldDefer: true,
  } as unknown as Tool
}

test('buildSchemaNotSentHint returns an OpenAI-compatible retry hint for deferred task tools', () => {
  const prev = process.env.ENABLE_TOOL_SEARCH
  process.env.ENABLE_TOOL_SEARCH = 'true'

  try {
    const hint = buildSchemaNotSentHint(
      makeDeferredTool('TaskCreate'),
      [],
      [{ name: TOOL_SEARCH_TOOL_NAME }],
    )

    expect(hint).toContain('deferred-loading')
    expect(hint).toContain(`${TOOL_SEARCH_TOOL_NAME}("select:TaskCreate")`)
    expect(hint).toContain('camelCase')
    expect(hint).toContain(
      `${TOOL_SEARCH_TOOL_NAME}("select:TaskGet,TaskCreate,TaskUpdate,TaskList")`,
    )
  } finally {
    process.env.ENABLE_TOOL_SEARCH = prev
  }
})

test('buildSchemaNotSentHint omits task-family preload guidance for non-task tools', () => {
  const prev = process.env.ENABLE_TOOL_SEARCH
  process.env.ENABLE_TOOL_SEARCH = 'true'

  try {
    const hint = buildSchemaNotSentHint(
      makeDeferredTool('ProjectSearch'),
      [],
      [{ name: TOOL_SEARCH_TOOL_NAME }],
    )

    expect(hint).toContain(`${TOOL_SEARCH_TOOL_NAME}("select:ProjectSearch")`)
    expect(hint).not.toContain('TaskGet,TaskCreate,TaskUpdate,TaskList')
  } finally {
    process.env.ENABLE_TOOL_SEARCH = prev
  }
})

test('buildSchemaNotSentHint returns null when the deferred tool was already discovered', () => {
  const prev = process.env.ENABLE_TOOL_SEARCH
  process.env.ENABLE_TOOL_SEARCH = 'true'

  try {
    const hint = buildSchemaNotSentHint(
      makeDeferredTool('TaskCreate'),
      [
        {
          type: 'user',
          uuid: 'u1',
          message: {
            content: [
              {
                type: 'tool_result',
                content: [{ type: 'tool_reference', tool_name: 'TaskCreate' }],
              },
            ],
          },
        } as any,
      ],
      [{ name: TOOL_SEARCH_TOOL_NAME }],
    )

    expect(hint).toBeNull()
  } finally {
    process.env.ENABLE_TOOL_SEARCH = prev
  }
})
