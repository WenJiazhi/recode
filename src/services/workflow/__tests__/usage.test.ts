import { expect, test } from 'bun:test'
import type { Message } from '../../../types/message.js'
import { addWorkflowUsage, summarizeWorkflowUsage } from '../usage.js'

function assistant(
  id: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): Message {
  return {
    type: 'assistant',
    uuid: crypto.randomUUID(),
    message: {
      id,
      model,
      content: [{ type: 'text', text: id }],
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: 2,
        cache_creation_input_tokens: 3,
      },
    },
  }
}

test('workflow usage deduplicates split responses and marks unknown pricing', () => {
  const first = assistant('response-a', 'claude-sonnet-4-6', 10, 4)
  const split = { ...first, uuid: crypto.randomUUID() }
  const unknown = assistant('response-b', 'custom-model', 20, 5)

  const summary = summarizeWorkflowUsage(
    [first, split, unknown],
    'claude-sonnet-4-6',
  )

  expect(summary.tokens).toBe(49)
  expect(summary.usage).toEqual({
    inputTokens: 30,
    outputTokens: 9,
    cacheReadInputTokens: 4,
    cacheCreationInputTokens: 6,
  })
  expect(summary.estimatedCostUsd).toBeCloseTo(0.00010185, 10)
  expect(summary.hasUnknownCost).toBe(true)
})

test('workflow usage addition preserves each token class', () => {
  expect(
    addWorkflowUsage(
      {
        inputTokens: 1,
        outputTokens: 2,
        cacheReadInputTokens: 3,
        cacheCreationInputTokens: 4,
      },
      {
        inputTokens: 10,
        outputTokens: 20,
        cacheReadInputTokens: 30,
        cacheCreationInputTokens: 40,
      },
    ),
  ).toEqual({
    inputTokens: 11,
    outputTokens: 22,
    cacheReadInputTokens: 33,
    cacheCreationInputTokens: 44,
  })
})

test('workflow usage tolerates incomplete third-party usage without NaN values', () => {
  const message = assistant('response-a', 'claude-sonnet-4-6', 10, 4)
  ;(message.message.usage as { input_tokens?: number }).input_tokens = undefined

  const summary = summarizeWorkflowUsage([message], 'claude-sonnet-4-6')

  expect(summary).toMatchObject({
    tokens: 9,
    usage: {
      inputTokens: 0,
      outputTokens: 4,
      cacheReadInputTokens: 2,
      cacheCreationInputTokens: 3,
    },
    estimatedCostUsd: 0,
    hasUnknownCost: true,
  })
  expect(Number.isFinite(summary.tokens)).toBe(true)
})
