import { expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

mock.module('../../../services/goal/goalStorage.js', () => ({
  persistCurrentGoal: () => {},
  persistGoalClear: () => {},
}))

test('/goal budget removes a queued continuation when the new budget is exhausted', async () => {
  const configDir = mkdtempSync(join(tmpdir(), 'recode-goal-command-'))
  const previousConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = configDir

  const sessionStorage = await import('../../../utils/sessionStorage.js')
  const queue = await import('../../../utils/messageQueueManager.js')
  const goalState = await import('../../../services/goal/goalState.js')
  const { call } = await import('../goal.js')

  sessionStorage.resetProjectForTesting()
  sessionStorage.setSessionFileForTesting(join(configDir, 'queue.jsonl'))
  queue.resetCommandQueue()
  goalState._clearAllGoalsForTesting()

  try {
    goalState.setGoal('finish the lifecycle')
    goalState.updateGoalTokens(100)
    queue.enqueue({
      value: 'continue the Goal',
      mode: 'prompt',
      priority: 'later',
      origin: 'goal-continuation',
    })
    queue.enqueue({
      value: 'user input',
      mode: 'prompt',
      priority: 'next',
    })

    await call(() => {}, {} as never, 'budget 50')

    expect(goalState.getGoal()?.status).toBe('budget_limited')
    expect(
      queue.getCommandQueueSnapshot().map(command => command.value),
    ).toEqual(['user input'])
  } finally {
    queue.resetCommandQueue()
    goalState._clearAllGoalsForTesting()
    await sessionStorage.flushSessionStorage()
    sessionStorage.resetProjectForTesting()
    if (previousConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = previousConfigDir
    rmSync(configDir, { recursive: true, force: true })
  }
})
