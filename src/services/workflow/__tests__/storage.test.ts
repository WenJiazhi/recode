import { expect, test } from 'bun:test'
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createWorkflowRun } from '../engine.js'
import {
  _flushWorkflowStorageForTesting,
  appendWorkflowEvent,
  getWorkflowRunsDir,
  initializeWorkflowJournal,
  listWorkflowRuns,
  loadWorkflowRun,
} from '../storage.js'
import { validateWorkflowSpec } from '../validation.js'
import { WORKFLOW_SCHEMA_VERSION } from '../types.js'

test('workflow journal replays transitions and ignores a torn final line', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-storage-'))
  const run = createWorkflowRun({
    spec: validateWorkflowSpec({
      version: 1,
      name: 'journal',
      objective: 'Test journal replay',
      steps: [{ id: 'inspect', title: 'Inspect', prompt: 'Inspect' }],
    }),
    sessionId: 'session',
    projectRoot: root,
    runId: '22222222-2222-4222-8222-222222222222',
    now: 1,
  })

  try {
    await initializeWorkflowJournal(run)
    await appendWorkflowEvent(run, {
      type: 'step_updated',
      step: {
        id: 'inspect',
        status: 'completed',
        attempts: 1,
        output: 'verified',
        tokens: 42,
        toolUses: 3,
        usage: {
          inputTokens: 30,
          outputTokens: 10,
          cacheReadInputTokens: 1,
          cacheCreationInputTokens: 1,
        },
        models: ['claude-sonnet-4-6'],
        estimatedCostUsd: 0.001,
        hasUnknownCost: false,
      },
    })
    await appendWorkflowEvent(run, {
      type: 'run_updated',
      status: 'completed',
      updatedAt: 10,
      completedAt: 10,
      resumeCount: 0,
      totalTokens: 42,
      totalToolUses: 3,
      estimatedCostUsd: 0.001,
      hasUnknownCost: false,
    })
    await appendFile(
      join(getWorkflowRunsDir(root), `${run.runId}.jsonl`),
      '{"type":"step_updated"',
    )

    const restored = await loadWorkflowRun(root, run.runId)
    expect(restored?.status).toBe('completed')
    expect(restored?.steps.inspect?.output).toBe('verified')
    expect(restored?.totalTokens).toBe(42)
    expect(restored?.estimatedCostUsd).toBe(0.001)
    expect(restored?.steps.inspect?.usage?.inputTokens).toBe(30)
    expect((await listWorkflowRuns(root)).map(item => item.runId)).toEqual([
      run.runId,
    ])
  } finally {
    await _flushWorkflowStorageForTesting()
    await rm(root, { recursive: true, force: true })
  }
})

test('workflow journal migrates v1/v2/v3 and rebases a moved project root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-storage-'))
  const run = createWorkflowRun({
    spec: validateWorkflowSpec({
      version: 1,
      name: 'portable-journal',
      objective: 'Keep recovery scoped to the current project',
      steps: [{ id: 'inspect', title: 'Inspect', prompt: 'Inspect' }],
    }),
    sessionId: 'session',
    projectRoot: root,
    runId: '44444444-4444-4444-8444-444444444444',
    now: 1,
  })

  try {
    await initializeWorkflowJournal(run)
    const path = join(getWorkflowRunsDir(root), `${run.runId}.jsonl`)
    const event = JSON.parse(await readFile(path, 'utf8'))
    event.run.projectRoot = '/untrusted/old/location'
    for (const schemaVersion of [1, 2, 3]) {
      event.run.schemaVersion = schemaVersion
      await writeFile(path, `${JSON.stringify(event)}\n`)
      const restored = await loadWorkflowRun(root, run.runId)
      expect(restored?.projectRoot).toBe(root)
      expect(restored?.schemaVersion).toBe(WORKFLOW_SCHEMA_VERSION)
    }

    event.run.runId = '55555555-5555-4555-8555-555555555555'
    await writeFile(path, `${JSON.stringify(event)}\n`)
    expect(await loadWorkflowRun(root, run.runId)).toBeNull()
  } finally {
    await _flushWorkflowStorageForTesting()
    await rm(root, { recursive: true, force: true })
  }
})

test('workflow journal validates and restores structured step output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-storage-'))
  const run = createWorkflowRun({
    spec: validateWorkflowSpec({
      version: 1,
      name: 'structured-journal',
      objective: 'Persist typed findings',
      steps: [
        {
          id: 'inspect',
          title: 'Inspect',
          prompt: 'Inspect',
          outputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['ok'],
            properties: { ok: { type: 'boolean' } },
          },
        },
      ],
    }),
    sessionId: 'session',
    projectRoot: root,
    runId: '66666666-6666-4666-8666-666666666666',
    now: 1,
  })

  try {
    await initializeWorkflowJournal(run)
    await appendWorkflowEvent(run, {
      type: 'step_updated',
      step: {
        id: 'inspect',
        status: 'completed',
        attempts: 1,
        output: 'stale text must not win',
        structuredOutput: { ok: true },
        tokens: 12,
        toolUses: 1,
      },
    })

    const restored = await loadWorkflowRun(root, run.runId)
    expect(restored?.steps.inspect?.output).toBe('{"ok":true}')
    expect(restored?.steps.inspect?.structuredOutput).toEqual({ ok: true })
  } finally {
    await _flushWorkflowStorageForTesting()
    await rm(root, { recursive: true, force: true })
  }
})

test('workflow journal validates worktree lifecycle records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-storage-'))
  const run = createWorkflowRun({
    spec: validateWorkflowSpec({
      version: 1,
      name: 'worktree-journal',
      objective: 'Persist merge evidence',
      steps: [
        {
          id: 'implement',
          title: 'Implement',
          prompt: 'Implement',
          mode: 'write',
          isolation: 'worktree',
        },
      ],
    }),
    sessionId: 'session',
    projectRoot: root,
    runId: '66666666-6666-4666-8666-666666666666',
  })

  try {
    await initializeWorkflowJournal(run)
    await appendWorkflowEvent(run, {
      type: 'step_updated',
      step: {
        id: 'implement',
        status: 'running',
        attempts: 1,
        tokens: 0,
        toolUses: 0,
        worktrees: [
          {
            slug: 'wf_12345678-abc-1',
            path: '/untrusted/old/.claude/worktrees/wf_12345678-abc-1',
            branch: 'worktree-wf_12345678-abc-1',
            sourceHead: 'a'.repeat(40),
            inputTree: 'b'.repeat(40),
            outputTree: 'c'.repeat(40),
            status: 'retained',
            attempt: 1,
            resumeCount: 0,
            createdAt: 10,
            completedAt: 20,
            error: 'merge conflict',
            result: {
              output: 'checkpointed output',
              tokens: 12,
              toolUses: 2,
              usage: {
                inputTokens: 7,
                outputTokens: 2,
                cacheReadInputTokens: 1,
                cacheCreationInputTokens: 2,
              },
              model: 'custom-model',
              estimatedCostUsd: 0,
              hasUnknownCost: true,
            },
          },
        ],
      },
    })

    const restored = await loadWorkflowRun(root, run.runId)
    expect(restored?.schemaVersion).toBe(WORKFLOW_SCHEMA_VERSION)
    expect(restored?.steps.implement?.worktrees?.[0]).toMatchObject({
      slug: 'wf_12345678-abc-1',
      status: 'retained',
      error: 'merge conflict',
      result: {
        output: 'checkpointed output',
        tokens: 12,
        toolUses: 2,
        model: 'custom-model',
        hasUnknownCost: true,
      },
    })

    await appendWorkflowEvent(run, {
      type: 'step_updated',
      step: {
        id: 'implement',
        status: 'running',
        attempts: 1,
        tokens: 0,
        toolUses: 0,
        worktrees: [
          {
            ...restored!.steps.implement!.worktrees![0]!,
            status: 'merging',
            result: undefined,
          },
        ],
      },
    })
    const afterInvalidCheckpoint = await loadWorkflowRun(root, run.runId)
    expect(
      afterInvalidCheckpoint?.steps.implement?.worktrees?.[0]?.status,
    ).toBe('retained')
  } finally {
    await _flushWorkflowStorageForTesting()
    await rm(root, { recursive: true, force: true })
  }
})
