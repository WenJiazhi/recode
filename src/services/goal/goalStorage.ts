import type { UUID } from 'crypto'
import { getSessionId } from '../../bootstrap/state.js'
import {
  clearGoalEntry as clearGoalEntryOnDisk,
  saveGoal as saveGoalOnDisk,
} from '../../utils/sessionStorage.js'
import { getGoal } from './goalState.js'

export function persistCurrentGoal(): void {
  const sessionId = getSessionId() as UUID
  const goal = getGoal(sessionId)
  if (goal) saveGoalOnDisk(sessionId, goal)
}

export function persistGoalClear(): void {
  clearGoalEntryOnDisk(getSessionId() as UUID)
}
