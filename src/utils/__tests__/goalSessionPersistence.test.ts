import { afterEach, describe, expect, test } from 'bun:test'
import { randomUUID, type UUID } from 'crypto'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { GoalState } from '../../types/logs.js'
import { loadMessagesFromJsonlPath } from '../conversationRecovery.js'
import {
  clearGoalEntry,
  loadTranscriptFile,
  saveGoal,
} from '../sessionStorage.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(path => rm(path, { recursive: true, force: true })),
  )
})

function makeGoal(objective: string, status: GoalState['status'] = 'active') {
  const now = Date.now()
  return {
    schemaVersion: 1,
    objective,
    status,
    tokenBudget: 80_000,
    tokensUsed: 12_000,
    startTime: now,
    pausedAt: status === 'active' ? null : now,
    accumulatedActiveMs: 5_000,
    blockedAttempts: 0,
    lastBlockReason: null,
    lastBlockedTurn: null,
    lastStopReason: null,
    createdAt: now,
    updatedAt: now,
    turnsExecuted: 2,
    checkpoints: [],
  } satisfies GoalState
}

async function writeTranscript(entries: unknown[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'recode-goal-session-'))
  temporaryDirectories.push(directory)
  const path = join(directory, 'session.jsonl')
  await writeFile(
    path,
    `${entries.map(entry => JSON.stringify(entry)).join('\n')}\n`,
  )
  return path
}

function goalEntry(sessionId: UUID, state: GoalState) {
  return {
    type: 'goal',
    sessionId,
    state,
    timestamp: new Date().toISOString(),
  }
}

function clearedEntry(sessionId: UUID) {
  return {
    type: 'goal-cleared',
    sessionId,
    timestamp: new Date().toISOString(),
  }
}

describe('Goal JSONL persistence', () => {
  test('writer functions append snapshots and clear tombstones', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'recode-goal-writer-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'session.jsonl')
    const sessionId = randomUUID()

    saveGoal(sessionId, makeGoal('written snapshot'), path)
    expect(
      (await loadTranscriptFile(path)).goals.get(sessionId)?.objective,
    ).toBe('written snapshot')

    clearGoalEntry(sessionId, path)
    expect((await loadTranscriptFile(path)).goals.has(sessionId)).toBe(false)
  })

  test('restores the latest Goal snapshot for a session', async () => {
    const sessionId = randomUUID()
    const path = await writeTranscript([
      goalEntry(sessionId, makeGoal('first snapshot')),
      goalEntry(sessionId, makeGoal('latest snapshot', 'paused')),
    ])

    const loaded = await loadTranscriptFile(path)
    expect(loaded.goals.get(sessionId)?.objective).toBe('latest snapshot')
    expect(loaded.goals.get(sessionId)?.status).toBe('paused')
  })

  test('a clear tombstone wins over all earlier snapshots', async () => {
    const sessionId = randomUUID()
    const path = await writeTranscript([
      goalEntry(sessionId, makeGoal('obsolete')),
      clearedEntry(sessionId),
    ])

    const loaded = await loadTranscriptFile(path)
    expect(loaded.goals.has(sessionId)).toBe(false)
  })

  test('a new Goal after clear becomes the resumable state', async () => {
    const sessionId = randomUUID()
    const path = await writeTranscript([
      goalEntry(sessionId, makeGoal('old')),
      clearedEntry(sessionId),
      goalEntry(sessionId, makeGoal('replacement')),
    ])

    const loaded = await loadTranscriptFile(path)
    expect(loaded.goals.get(sessionId)?.objective).toBe('replacement')
  })

  test('direct JSONL resume preserves a Goal even before chat messages exist', async () => {
    const sessionId = randomUUID()
    const state = makeGoal('goal-only transcript')
    const path = await writeTranscript([goalEntry(sessionId, state)])

    const loaded = await loadMessagesFromJsonlPath(path)
    expect(loaded.messages).toEqual([])
    expect(loaded.sessionId).toBe(sessionId)
    expect(loaded.goal?.objective).toBe('goal-only transcript')
  })
})
