import type { BetaUsage } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { Message } from '../../types/message.js'
import { calculateKnownUSDCost } from '../../utils/modelCost.js'
import { getTokenUsage } from '../../utils/tokens.js'
import type { WorkflowAttemptMetrics, WorkflowTokenUsage } from './types.js'

const EMPTY_USAGE: WorkflowTokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
}

const MAX_USAGE_COMPONENT = Math.floor(Number.MAX_SAFE_INTEGER / 4)

function tokenCount(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? Math.min(value as number, MAX_USAGE_COMPONENT)
    : null
}

function addTokenCount(current: number, value: number): number {
  return Math.min(MAX_USAGE_COMPONENT, current + value)
}

export function summarizeWorkflowUsage(
  messages: readonly Message[],
  fallbackModel: string,
): Omit<WorkflowAttemptMetrics, 'toolUses'> {
  const usage = { ...EMPTY_USAGE }
  const responseIds = new Set<string>()
  let tokens = 0
  let estimatedCostUsd = 0
  let hasUnknownCost = false
  let responseCount = 0

  for (const [index, message] of messages.entries()) {
    const responseUsage = getTokenUsage(message)
    if (!responseUsage) continue
    const responseId =
      typeof message.message?.id === 'string'
        ? message.message.id
        : `${message.uuid ?? 'message'}:${index}`
    if (responseIds.has(responseId)) continue
    responseIds.add(responseId)
    responseCount += 1

    const inputTokens = tokenCount(responseUsage.input_tokens)
    const outputTokens = tokenCount(responseUsage.output_tokens)
    const cacheReadInputTokens =
      tokenCount(responseUsage.cache_read_input_tokens ?? 0) ?? 0
    const cacheCreationInputTokens =
      tokenCount(responseUsage.cache_creation_input_tokens ?? 0) ?? 0
    const hasCompleteUsage = inputTokens !== null && outputTokens !== null
    usage.inputTokens = addTokenCount(usage.inputTokens, inputTokens ?? 0)
    usage.outputTokens = addTokenCount(usage.outputTokens, outputTokens ?? 0)
    usage.cacheReadInputTokens = addTokenCount(
      usage.cacheReadInputTokens,
      cacheReadInputTokens,
    )
    usage.cacheCreationInputTokens = addTokenCount(
      usage.cacheCreationInputTokens,
      cacheCreationInputTokens,
    )

    const responseModel =
      typeof message.message?.model === 'string'
        ? message.message.model
        : fallbackModel
    const responseCost = hasCompleteUsage
      ? calculateKnownUSDCost(responseModel, {
          ...responseUsage,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_input_tokens: cacheReadInputTokens,
          cache_creation_input_tokens: cacheCreationInputTokens,
        } as BetaUsage)
      : null
    if (responseCost === null) hasUnknownCost = true
    else estimatedCostUsd += responseCost
  }

  tokens =
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens
  if (responseCount === 0) hasUnknownCost = true
  return {
    tokens,
    usage,
    model: fallbackModel,
    estimatedCostUsd,
    hasUnknownCost,
  }
}

export function addWorkflowUsage(
  left: WorkflowTokenUsage | undefined,
  right: WorkflowTokenUsage | undefined,
): WorkflowTokenUsage | undefined {
  if (!left && !right) return undefined
  return {
    inputTokens: addTokenCount(left?.inputTokens ?? 0, right?.inputTokens ?? 0),
    outputTokens: addTokenCount(
      left?.outputTokens ?? 0,
      right?.outputTokens ?? 0,
    ),
    cacheReadInputTokens: addTokenCount(
      left?.cacheReadInputTokens ?? 0,
      right?.cacheReadInputTokens ?? 0,
    ),
    cacheCreationInputTokens: addTokenCount(
      left?.cacheCreationInputTokens ?? 0,
      right?.cacheCreationInputTokens ?? 0,
    ),
  }
}

export function workflowTokenUsageTotal(usage: WorkflowTokenUsage): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheCreationInputTokens
  )
}

function normalizeTokenUsage(value: unknown): WorkflowTokenUsage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined
  const raw = value as Partial<WorkflowTokenUsage>
  const inputTokens = tokenCount(raw.inputTokens)
  const outputTokens = tokenCount(raw.outputTokens)
  const cacheReadInputTokens = tokenCount(raw.cacheReadInputTokens)
  const cacheCreationInputTokens = tokenCount(raw.cacheCreationInputTokens)
  if (
    inputTokens === null ||
    outputTokens === null ||
    cacheReadInputTokens === null ||
    cacheCreationInputTokens === null
  ) {
    return undefined
  }
  return {
    inputTokens,
    outputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens,
  }
}

export function normalizeWorkflowAttemptMetrics(
  value: WorkflowAttemptMetrics,
): WorkflowAttemptMetrics {
  const raw = value as Partial<WorkflowAttemptMetrics>
  const usage = normalizeTokenUsage(raw.usage)
  const reportedTokens = tokenCount(raw.tokens) ?? 0
  const tokens = usage ? workflowTokenUsageTotal(usage) : reportedTokens
  const toolUses = tokenCount(raw.toolUses) ?? 0
  const model =
    typeof raw.model === 'string' &&
    raw.model.length > 0 &&
    raw.model.length <= 160
      ? raw.model
      : undefined
  const estimatedCostUsd =
    typeof raw.estimatedCostUsd === 'number' &&
    Number.isFinite(raw.estimatedCostUsd) &&
    raw.estimatedCostUsd >= 0
      ? raw.estimatedCostUsd
      : undefined
  return {
    tokens,
    toolUses,
    ...(usage === undefined ? {} : { usage }),
    ...(model === undefined ? {} : { model }),
    ...(estimatedCostUsd === undefined ? {} : { estimatedCostUsd }),
    hasUnknownCost:
      raw.hasUnknownCost === true ||
      (tokens > 0 && estimatedCostUsd === undefined),
  }
}
