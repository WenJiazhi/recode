import { MAX_GOAL_OBJECTIVE_CHARS } from './goalState.js'
import { parseTokenBudgetValue } from '../../utils/tokenBudget.js'

export type ParsedGoalCommand =
  | { action: 'status' }
  | { action: 'clear' }
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'continue' }
  | { action: 'complete' }
  | { action: 'checkpoint'; summary: string }
  | { action: 'budget'; tokenBudget: number | null }
  | { action: 'set'; objective: string; tokenBudget: number | null }
  | { action: 'error'; message: string }

export function parseGoalTokenBudget(value: string): number | null {
  return parseTokenBudgetValue(value)
}

function parseSetCommand(input: string): ParsedGoalCommand {
  let rest = input.trim()
  let tokenBudget: number | null = null

  const budgetMatch = rest.match(/^--(?:budget|tokens)(?:=|\s+)(\S+)\s*/i)
  if (budgetMatch) {
    const parsed = parseGoalTokenBudget(budgetMatch[1]!)
    if (parsed === null) {
      return {
        action: 'error',
        message:
          'Invalid token budget. Use a positive value such as 50000, 80k, or 1m.',
      }
    }
    tokenBudget = parsed
    rest = rest.slice(budgetMatch[0].length).trim()
  } else if (rest.startsWith('--')) {
    return {
      action: 'error',
      message: `Unknown Goal option: ${rest.split(/\s+/)[0]}`,
    }
  }

  if (!rest) {
    return { action: 'error', message: 'Goal objective must not be empty.' }
  }
  if (rest.length > MAX_GOAL_OBJECTIVE_CHARS) {
    return {
      action: 'error',
      message: `Goal objective is too long (${rest.length} characters; maximum ${MAX_GOAL_OBJECTIVE_CHARS}).`,
    }
  }
  return { action: 'set', objective: rest, tokenBudget }
}

export function parseGoalCommand(args: string): ParsedGoalCommand {
  const trimmed = args.trim()
  if (!trimmed) return { action: 'status' }

  const [head = '', ...tail] = trimmed.split(/\s+/)
  const lower = head.toLowerCase()
  const rest = tail.join(' ').trim()

  if (lower === 'status') return { action: 'status' }
  if (lower === 'clear') return { action: 'clear' }
  if (lower === 'pause') return { action: 'pause' }
  if (lower === 'resume') return { action: 'resume' }
  if (lower === 'continue') return { action: 'continue' }
  if (lower === 'complete') return { action: 'complete' }
  if (lower === 'start' || lower === 'create') return parseSetCommand(rest)

  if (lower === 'checkpoint' || lower === 'note') {
    return rest
      ? { action: 'checkpoint', summary: rest }
      : { action: 'error', message: 'Checkpoint summary must not be empty.' }
  }

  if (lower === 'budget') {
    if (!rest) {
      return {
        action: 'error',
        message: 'Usage: /goal budget <tokens|none>',
      }
    }
    if (rest.toLowerCase() === 'none' || rest.toLowerCase() === 'unlimited') {
      return { action: 'budget', tokenBudget: null }
    }
    const tokenBudget = parseGoalTokenBudget(rest)
    return tokenBudget === null
      ? {
          action: 'error',
          message:
            'Invalid token budget. Use a positive value such as 50000, 80k, or 1m.',
        }
      : { action: 'budget', tokenBudget }
  }

  return parseSetCommand(trimmed)
}
