import { expect, mock, test } from 'bun:test'
import type { AppState } from '../../../state/AppState.js'
import type { ToolUseContext } from '../../../Tool.js'
import { createWorkflowRun } from '../engine.js'
import { validateWorkflowSpec } from '../validation.js'
import { WorkflowStepExecutionError } from '../errors.js'

let capturedRunAgentInput: Record<string, unknown> | undefined
let sessionHookCountDuringRun = 0
let failAfterFirstResponse = false
let omitStructuredOutput = false
let appState = {
  sessionHooks: new Map(),
  toolPermissionContext: { mode: 'default' },
} as unknown as AppState

mock.module('../../../tools/AgentTool/runAgent.js', () => ({
  filterIncompleteToolCalls(messages: unknown[]) {
    return messages
  },
  async *runAgent(input: Record<string, unknown>) {
    capturedRunAgentInput = input
    sessionHookCountDuringRun = appState.sessionHooks.size
    yield {
      type: 'assistant',
      uuid: '99999999-9999-4999-8999-999999999991',
      timestamp: new Date().toISOString(),
      message: {
        id: 'msg-tool',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        content: [
          {
            type: 'tool_use',
            id: 'structured-output-call',
            name: 'StructuredOutput',
            input: { files: ['src/index.ts'] },
          },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 20, output_tokens: 4 },
      },
    }
    if (failAfterFirstResponse) throw new Error('simulated worker failure')
    if (!omitStructuredOutput) {
      yield {
        type: 'attachment',
        attachment: {
          type: 'structured_output',
          data: { files: ['src/index.ts'] },
        },
      }
    }
    yield {
      type: 'assistant',
      uuid: '99999999-9999-4999-8999-999999999992',
      timestamp: new Date().toISOString(),
      message: {
        id: 'msg-final',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-6',
        content: [{ type: 'text', text: 'Structured result returned.' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 20, output_tokens: 4 },
      },
    }
  },
}))

test('workflow agent injects its schema tool and captures structured output', async () => {
  const { runWorkflowAgentStep } = await import('../agentRunner.js')
  const spec = validateWorkflowSpec({
    version: 1,
    name: 'runner-structured-output',
    objective: 'Return inspected files',
    steps: [
      {
        id: 'inspect',
        title: 'Inspect',
        prompt: 'Inspect files',
        outputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['files'],
          properties: {
            files: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    ],
  })
  const run = createWorkflowRun({
    spec,
    sessionId: 'session',
    projectRoot: '/project',
    runId: '88888888-8888-4888-8888-888888888888',
  })
  appState = {
    sessionHooks: new Map(),
    toolPermissionContext: { mode: 'default' },
  } as unknown as AppState
  const context = {
    options: {
      tools: [],
      mainLoopModel: 'claude-sonnet-4-6',
      agentDefinitions: { activeAgents: [] },
    },
    getAppState: () => appState,
    setAppState: (updater: (previous: AppState) => AppState) => {
      appState = updater(appState)
    },
  } as unknown as ToolUseContext

  const result = await runWorkflowAgentStep({
    run,
    step: spec.steps[0]!,
    dependencyResults: {},
    workingDirectory: '/project/worktree',
    worktreePath: '/project/worktree',
    signal: new AbortController().signal,
    host: {
      toolUseContext: context,
      canUseTool: async () =>
        ({ behavior: 'allow', updatedInput: {} }) as never,
    },
  })

  const tools = capturedRunAgentInput?.availableTools as Array<{
    name: string
    inputJSONSchema?: unknown
  }>
  const structuredTool = tools.find(tool => tool.name === 'StructuredOutput')
  expect(structuredTool?.inputJSONSchema).toEqual(spec.steps[0]?.outputSchema)
  expect(capturedRunAgentInput?.worktreePath).toBe('/project/worktree')
  expect(result).toEqual({
    output: '{"files":["src/index.ts"]}',
    structuredOutput: { files: ['src/index.ts'] },
    tokens: 48,
    toolUses: 1,
    usage: {
      inputTokens: 40,
      outputTokens: 8,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    },
    model: 'claude-sonnet-4-6',
    estimatedCostUsd: 0.00024,
    hasUnknownCost: false,
  })
  expect(sessionHookCountDuringRun).toBe(1)
  expect(appState.sessionHooks.size).toBe(0)

  failAfterFirstResponse = true
  try {
    await runWorkflowAgentStep({
      run,
      step: spec.steps[0]!,
      dependencyResults: {},
      signal: new AbortController().signal,
      host: {
        toolUseContext: context,
        canUseTool: async () =>
          ({ behavior: 'allow', updatedInput: {} }) as never,
      },
    })
    throw new Error('Expected workflow worker failure')
  } catch (error) {
    expect(error).toBeInstanceOf(WorkflowStepExecutionError)
    expect((error as WorkflowStepExecutionError).metrics).toMatchObject({
      tokens: 24,
      toolUses: 1,
      estimatedCostUsd: 0.00012,
      hasUnknownCost: false,
    })
  } finally {
    failAfterFirstResponse = false
  }
  expect(appState.sessionHooks.size).toBe(0)

  omitStructuredOutput = true
  try {
    await runWorkflowAgentStep({
      run,
      step: spec.steps[0]!,
      dependencyResults: {},
      signal: new AbortController().signal,
      host: {
        toolUseContext: context,
        canUseTool: async () =>
          ({ behavior: 'allow', updatedInput: {} }) as never,
      },
    })
    throw new Error('Expected missing structured output failure')
  } catch (error) {
    expect(error).toBeInstanceOf(WorkflowStepExecutionError)
    expect((error as WorkflowStepExecutionError).metrics).toMatchObject({
      tokens: 48,
      toolUses: 1,
      estimatedCostUsd: 0.00024,
      hasUnknownCost: false,
    })
  } finally {
    omitStructuredOutput = false
  }
})
