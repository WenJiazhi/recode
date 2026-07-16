import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import {
  completeGoal,
  formatGoalElapsed,
  formatGoalStatusLabel,
  getGoal,
  recordBlockedAttempt,
  recordGoalCheckpoint,
} from '../../services/goal/goalState.js'
import { persistCurrentGoal } from '../../services/goal/goalStorage.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { GOAL_TOOL_NAME } from './constants.js'
import { DESCRIPTION, PROMPT } from './prompt.js'
import {
  renderToolResultMessage,
  renderToolUseMessage,
  renderToolUseRejectedMessage,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['get', 'checkpoint', 'update']).optional(),
    status: z.enum(['complete', 'blocked']).optional(),
    summary: z.string().optional(),
    reason: z.string().optional(),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const goalSnapshotSchema = z.object({
  objective: z.string(),
  status: z.string(),
  tokensUsed: z.number(),
  tokenBudget: z.number().nullable(),
  elapsed: z.string(),
  turnsExecuted: z.number(),
  latestCheckpoint: z.string().optional(),
})

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean(),
    goal: goalSnapshotSchema.optional(),
    message: z.string().optional(),
    report: z.string().optional(),
    error: z.string().optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Input = z.infer<InputSchema>
export type Output = z.infer<OutputSchema>

function resolveAction(input: Input): 'get' | 'checkpoint' | 'update' {
  return (
    input.action ??
    (input.status ? 'update' : input.summary ? 'checkpoint' : 'get')
  )
}

function snapshotGoal(): z.infer<typeof goalSnapshotSchema> | undefined {
  const goal = getGoal()
  if (!goal) return undefined
  return {
    objective: goal.objective,
    status: formatGoalStatusLabel(goal.status),
    tokensUsed: goal.tokensUsed,
    tokenBudget: goal.tokenBudget,
    elapsed: formatGoalElapsed(goal),
    turnsExecuted: goal.turnsExecuted,
    latestCheckpoint: goal.checkpoints.at(-1)?.summary,
  }
}

function completionReport(): string {
  const goal = getGoal()
  if (!goal) return ''
  return [
    'Goal achieved:',
    `Token usage: ${goal.tokensUsed}${goal.tokenBudget === null ? '' : ` / ${goal.tokenBudget}`}`,
    `Active time: ${formatGoalElapsed(goal)}`,
    `Automatic continuations: ${goal.turnsExecuted}`,
  ].join('\n')
}

export const GoalTool = buildTool({
  name: GOAL_TOOL_NAME,
  searchHint: 'read, checkpoint, complete, or block the active Goal',
  maxResultSizeChars: 10_000,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName() {
    return 'Goal'
  },
  shouldDefer: false,
  isEnabled() {
    return getGoal() !== null
  },
  isConcurrencySafe(input) {
    return resolveAction(input) === 'get'
  },
  isReadOnly(input) {
    return resolveAction(input) === 'get'
  },
  toAutoClassifierInput(input) {
    return `${resolveAction(input)} ${input.status ?? ''} ${input.reason ?? input.summary ?? ''}`.trim()
  },
  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },
  renderToolUseMessage,
  renderToolResultMessage,
  renderToolUseRejectedMessage,
  async call(input): Promise<{ data: Output }> {
    const action = resolveAction(input)
    if (action === 'get') {
      const goal = snapshotGoal()
      return goal
        ? { data: { success: true, goal } }
        : { data: { success: true, message: 'No Goal is active.' } }
    }

    if (action === 'checkpoint') {
      const summary = input.summary?.trim()
      if (!summary) {
        return {
          data: { success: false, error: 'Checkpoint summary is required.' },
        }
      }
      try {
        const goal = recordGoalCheckpoint(summary)
        if (!goal) {
          return {
            data: {
              success: false,
              error: 'Only an active Goal accepts checkpoints.',
            },
          }
        }
        persistCurrentGoal()
        return {
          data: {
            success: true,
            goal: snapshotGoal(),
            message: 'Goal checkpoint saved.',
          },
        }
      } catch (error) {
        return {
          data: {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        }
      }
    }

    if (!input.status) {
      return {
        data: { success: false, error: 'Update status is required.' },
      }
    }
    const reason = input.reason?.trim()
    if (!reason) {
      return {
        data: { success: false, error: 'Update reason is required.' },
      }
    }
    const currentGoal = getGoal()
    if (!currentGoal) {
      return { data: { success: false, error: 'No Goal is active.' } }
    }
    if (input.status === 'complete') {
      if (
        currentGoal.status !== 'active' &&
        currentGoal.status !== 'budget_limited'
      ) {
        return {
          data: {
            success: false,
            error: `The Goal is ${currentGoal.status} and cannot be completed by the model.`,
          },
        }
      }
      try {
        completeGoal(undefined, reason)
        persistCurrentGoal()
        return {
          data: {
            success: true,
            goal: snapshotGoal(),
            report: completionReport(),
          },
        }
      } catch (error) {
        return {
          data: {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
        }
      }
    }

    if (currentGoal.status !== 'active') {
      return {
        data: {
          success: false,
          error: `The Goal is ${currentGoal.status} and cannot be updated by the model.`,
        },
      }
    }

    let result: ReturnType<typeof recordBlockedAttempt>
    try {
      result = recordBlockedAttempt(reason)
    } catch (error) {
      return {
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }
    if (!result) {
      return {
        data: {
          success: false,
          error:
            'The Goal cannot accept a blocked report in its current state.',
        },
      }
    }
    persistCurrentGoal()
    return {
      data: {
        success: true,
        goal: snapshotGoal(),
        message: !result.recorded
          ? `A blocked report was already recorded for continuation ${currentGoal.turnsExecuted}; the Goal remains active.`
          : result.status === 'blocked'
            ? `Goal blocked after ${result.attempts} consecutive reports: ${reason}`
            : `Blocked report ${result.attempts}/3 recorded; the Goal remains active.`,
      },
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    if (output.error) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseID,
        content: `Error: ${output.error}`,
        is_error: true,
      }
    }
    const parts = [output.message, output.report]
    if (output.goal) parts.push(jsonStringify(output.goal))
    return {
      type: 'tool_result',
      tool_use_id: toolUseID,
      content: parts.filter(Boolean).join('\n') || 'Done',
    }
  },
} satisfies ToolDef<InputSchema, Output>)
