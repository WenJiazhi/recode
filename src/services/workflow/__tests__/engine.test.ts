import { describe, expect, test } from 'bun:test'
import {
  applyWorkflowAttemptMetrics,
  createWorkflowRun,
  executeWorkflow,
  prepareWorkflowRunForResume,
  WorkflowStepRetryError,
  WorkflowStepSkippedError,
} from '../engine.js'
import type { WorkflowSpec, WorkflowStepExecutionResult } from '../types.js'
import { WorkflowSchedulerSignal } from '../runtime.js'
import { WorkflowStepExecutionError } from '../errors.js'
import { validateWorkflowSpec } from '../validation.js'

function makeSpec(
  steps: Array<Record<string, unknown>>,
  maxConcurrency = 3,
  tokenBudget?: number | null,
): WorkflowSpec {
  return validateWorkflowSpec({
    version: 1,
    name: 'test-workflow',
    objective: 'Exercise the scheduler',
    maxConcurrency,
    ...(tokenBudget === undefined ? {} : { tokenBudget }),
    steps,
  })
}

function createRun(spec: WorkflowSpec) {
  return createWorkflowRun({
    spec,
    sessionId: 'session',
    projectRoot: '/project',
    runId: '11111111-1111-4111-8111-111111111111',
    now: 1,
  })
}

function result(output: string): WorkflowStepExecutionResult {
  return { output, tokens: 10, toolUses: 1 }
}

describe('workflow engine', () => {
  test('starts a newly-ready dependent without waiting for an unrelated slow step', async () => {
    const spec = makeSpec(
      [
        { id: 'slow', title: 'Slow', prompt: 'Slow' },
        { id: 'fast', title: 'Fast', prompt: 'Fast' },
        {
          id: 'after_fast',
          title: 'After fast',
          prompt: 'After fast',
          dependsOn: ['fast'],
        },
      ],
      2,
    )
    const started: string[] = []
    let releaseSlow: (() => void) | undefined
    const slow = new Promise<void>(resolve => {
      releaseSlow = resolve
    })

    const execution = executeWorkflow(createRun(spec), {
      signal: new AbortController().signal,
      async runStep({ step }) {
        started.push(step.id)
        if (step.id === 'slow') await slow
        return result(step.id)
      },
    })

    for (let i = 0; i < 20 && !started.includes('after_fast'); i++) {
      await Bun.sleep(1)
    }
    expect(started).toEqual(['slow', 'fast', 'after_fast'])
    releaseSlow?.()
    expect((await execution).status).toBe('completed')
  })

  test('never exceeds the declared concurrency cap', async () => {
    const spec = makeSpec(
      Array.from({ length: 6 }, (_, index) => ({
        id: `step_${index}`,
        title: `Step ${index}`,
        prompt: `Step ${index}`,
      })),
      2,
    )
    let active = 0
    let peak = 0

    const run = await executeWorkflow(createRun(spec), {
      signal: new AbortController().signal,
      async runStep({ step }) {
        active += 1
        peak = Math.max(peak, active)
        await Bun.sleep(2)
        active -= 1
        return result(step.id)
      },
    })

    expect(run.status).toBe('completed')
    expect(peak).toBe(2)
  })

  test('hot concurrency changes wake scheduling without cancelling active steps', async () => {
    const spec = makeSpec(
      ['one', 'two', 'three'].map(id => ({
        id,
        title: id,
        prompt: id,
      })),
      1,
    )
    const run = createRun(spec)
    const schedulerSignal = new WorkflowSchedulerSignal()
    const started: string[] = []
    const releases = new Map<string, () => void>()
    const execution = executeWorkflow(run, {
      signal: new AbortController().signal,
      schedulerSignal,
      async runStep({ step }) {
        started.push(step.id)
        await new Promise<void>(resolve => releases.set(step.id, resolve))
        return result(step.id)
      },
    })

    for (let i = 0; i < 100 && started.length < 1; i++) await Bun.sleep(1)
    expect(started).toEqual(['one'])
    run.concurrencyLimit = 2
    schedulerSignal.notify()
    for (let i = 0; i < 100 && started.length < 2; i++) await Bun.sleep(1)
    expect(started).toEqual(['one', 'two'])

    run.concurrencyLimit = 1
    schedulerSignal.notify()
    releases.get('one')!()
    await Bun.sleep(10)
    expect(started).toEqual(['one', 'two'])
    releases.get('two')!()
    for (let i = 0; i < 100 && started.length < 3; i++) await Bun.sleep(1)
    expect(started).toEqual(['one', 'two', 'three'])
    releases.get('three')!()

    expect((await execution).status).toBe('completed')
  })

  test('stops admitting steps at the token budget and leaves them resumable', async () => {
    const spec = makeSpec(
      [
        { id: 'first', title: 'First', prompt: 'First' },
        {
          id: 'second',
          title: 'Second',
          prompt: 'Second',
          dependsOn: ['first'],
        },
      ],
      1,
      15,
    )
    const calls: string[] = []
    const run = await executeWorkflow(createRun(spec), {
      signal: new AbortController().signal,
      async runStep({ step }) {
        calls.push(step.id)
        return { output: step.id, tokens: 20, toolUses: 1 }
      },
    })

    expect(calls).toEqual(['first'])
    expect(run.status).toBe('budget_limited')
    expect(run.totalTokens).toBe(20)
    expect(run.steps.first?.status).toBe('completed')
    expect(run.steps.second?.status).toBe('pending')
  })

  test('reports completion when the final step crosses the budget', async () => {
    const run = await executeWorkflow(
      createRun(
        makeSpec([{ id: 'only', title: 'Only', prompt: 'Only' }], 1, 5),
      ),
      {
        signal: new AbortController().signal,
        async runStep() {
          return { output: 'done', tokens: 10, toolUses: 1 }
        },
      },
    )

    expect(run.status).toBe('completed')
    expect(run.totalTokens).toBe(10)
  })

  test('retries a failed step and preserves independent work', async () => {
    const spec = makeSpec([
      {
        id: 'flaky',
        title: 'Flaky',
        prompt: 'Flaky',
        maxAttempts: 2,
      },
      { id: 'independent', title: 'Independent', prompt: 'Independent' },
      {
        id: 'dependent',
        title: 'Dependent',
        prompt: 'Dependent',
        dependsOn: ['flaky'],
      },
    ])
    const attempts = new Map<string, number>()

    const run = await executeWorkflow(createRun(spec), {
      signal: new AbortController().signal,
      async runStep({ step }) {
        const count = (attempts.get(step.id) ?? 0) + 1
        attempts.set(step.id, count)
        if (step.id === 'flaky' && count === 1) throw new Error('temporary')
        return result(step.id)
      },
    })

    expect(run.status).toBe('completed')
    expect(run.steps.flaky?.attempts).toBe(2)
    expect(run.steps.independent?.status).toBe('completed')
    expect(run.steps.dependent?.status).toBe('completed')
  })

  test('keeps cumulative tokens when only newer attempts have usage detail', async () => {
    const spec = makeSpec([
      {
        id: 'flaky',
        title: 'Flaky',
        prompt: 'Flaky',
        maxAttempts: 2,
      },
    ])
    let attempts = 0
    const run = await executeWorkflow(createRun(spec), {
      signal: new AbortController().signal,
      async runStep() {
        attempts += 1
        if (attempts === 1) {
          throw new WorkflowStepExecutionError(new Error('retry'), {
            tokens: 5,
            toolUses: 1,
          })
        }
        return {
          output: 'done',
          tokens: 10,
          toolUses: 1,
          usage: {
            inputTokens: 7,
            outputTokens: 3,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
          },
          model: 'claude-sonnet-4-6',
          estimatedCostUsd: 0.001,
          hasUnknownCost: false,
        }
      },
    })

    expect(run.steps.flaky).toMatchObject({
      status: 'completed',
      tokens: 15,
      toolUses: 2,
      estimatedCostUsd: 0.001,
      hasUnknownCost: true,
    })
    expect(run.steps.flaky?.usage).toBeUndefined()
  })

  test('validates structured output before completion and passes it downstream', async () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['count'],
      properties: { count: { type: 'number' } },
    }
    const spec = makeSpec([
      {
        id: 'inspect',
        title: 'Inspect',
        prompt: 'Inspect',
        outputSchema: schema,
      },
      {
        id: 'consume',
        title: 'Consume',
        prompt: 'Consume',
        dependsOn: ['inspect'],
      },
    ])

    const run = await executeWorkflow(createRun(spec), {
      signal: new AbortController().signal,
      async runStep({ step, dependencyOutputs, dependencyResults }) {
        if (step.id === 'inspect') {
          return {
            output: 'untrusted adapter text',
            structuredOutput: { count: 2 },
            tokens: 10,
            toolUses: 1,
          }
        }
        expect(dependencyOutputs.inspect).toBe('{"count":2}')
        expect(dependencyResults.inspect?.structuredOutput).toEqual({
          count: 2,
        })
        return result('consumed')
      },
    })

    expect(run.status).toBe('completed')
    expect(run.steps.inspect?.output).toBe('{"count":2}')
    expect(run.steps.inspect?.structuredOutput).toEqual({ count: 2 })
  })

  test('schema failures consume normal attempts and can recover', async () => {
    const spec = makeSpec([
      {
        id: 'inspect',
        title: 'Inspect',
        prompt: 'Inspect',
        maxAttempts: 2,
        outputSchema: {
          type: 'object',
          required: ['count'],
          properties: { count: { type: 'number' } },
        },
      },
    ])
    let calls = 0

    const run = await executeWorkflow(createRun(spec), {
      signal: new AbortController().signal,
      async runStep() {
        calls += 1
        return {
          output: 'ignored',
          structuredOutput: { count: calls === 1 ? 'wrong' : 3 },
          tokens: 10,
          toolUses: 1,
        }
      },
    })

    expect(run.status).toBe('completed')
    expect(run.steps.inspect?.attempts).toBe(2)
    expect(run.steps.inspect?.structuredOutput).toEqual({ count: 3 })
    expect(run.steps.inspect?.tokens).toBe(20)
  })

  test('fails clearly when a schema step returns no structured value', async () => {
    const spec = makeSpec([
      {
        id: 'inspect',
        title: 'Inspect',
        prompt: 'Inspect',
        outputSchema: { type: 'object' },
      },
    ])
    const run = await executeWorkflow(createRun(spec), {
      signal: new AbortController().signal,
      async runStep() {
        return result('plain text')
      },
    })

    expect(run.status).toBe('failed')
    expect(run.steps.inspect?.error).toContain(
      'did not return the required structured output',
    )
  })

  test('fails only the dependent branch when a step exhausts retries', async () => {
    const spec = makeSpec([
      { id: 'broken', title: 'Broken', prompt: 'Broken' },
      {
        id: 'blocked',
        title: 'Blocked',
        prompt: 'Blocked',
        dependsOn: ['broken'],
      },
      { id: 'independent', title: 'Independent', prompt: 'Independent' },
    ])

    const run = await executeWorkflow(createRun(spec), {
      signal: new AbortController().signal,
      async runStep({ step }) {
        if (step.id === 'broken') throw new Error('terminal')
        return result(step.id)
      },
    })

    expect(run.status).toBe('failed')
    expect(run.steps.broken?.status).toBe('failed')
    expect(run.steps.blocked?.status).toBe('skipped')
    expect(run.steps.independent?.status).toBe('completed')
  })

  test('records a synchronous runner failure and releases the scheduler', async () => {
    const run = await executeWorkflow(
      createRun(
        makeSpec([{ id: 'broken', title: 'Broken', prompt: 'Broken' }]),
      ),
      {
        signal: new AbortController().signal,
        runStep() {
          throw new Error('synchronous failure')
        },
      },
    )

    expect(run.status).toBe('failed')
    expect(run.steps.broken).toMatchObject({
      status: 'failed',
      error: 'synchronous failure',
    })
  })

  test('restarts a step after an explicit retry without consuming an attempt', async () => {
    let calls = 0
    const run = await executeWorkflow(
      createRun(
        makeSpec([
          {
            id: 'review',
            title: 'Review',
            prompt: 'Review',
            mode: 'write',
            isolation: 'worktree',
          },
        ]),
      ),
      {
        signal: new AbortController().signal,
        async runStep({ run: activeRun }) {
          calls += 1
          if (calls === 1) {
            activeRun.steps.review!.worktrees = [
              {
                slug: 'wf_12345678-abc-1',
                path: '/repo/.claude/worktrees/wf_12345678-abc-1',
                branch: 'worktree-wf_12345678-abc-1',
                sourceHead: 'a'.repeat(40),
                inputTree: 'b'.repeat(40),
                outputTree: 'c'.repeat(40),
                status: 'retained',
                attempt: 1,
                resumeCount: 0,
                createdAt: 10,
                completedAt: 20,
                error: 'retry requested',
              },
            ]
            throw new WorkflowStepRetryError(undefined, {
              tokens: 6,
              toolUses: 2,
            })
          }
          return result('reviewed')
        },
      },
    )

    expect(run.status).toBe('completed')
    expect(calls).toBe(2)
    expect(run.steps.review?.attempts).toBe(1)
    expect(run.steps.review?.tokens).toBe(16)
    expect(run.steps.review?.toolUses).toBe(3)
    expect(run.steps.review?.worktrees?.[0]).toMatchObject({
      slug: 'wf_12345678-abc-1',
      status: 'retained',
    })
  })

  test('skips the requested step and only blocks its dependent branch', async () => {
    const run = await executeWorkflow(
      createRun(
        makeSpec([
          { id: 'optional', title: 'Optional', prompt: 'Optional' },
          {
            id: 'dependent',
            title: 'Dependent',
            prompt: 'Dependent',
            dependsOn: ['optional'],
          },
          { id: 'independent', title: 'Independent', prompt: 'Independent' },
        ]),
      ),
      {
        signal: new AbortController().signal,
        async runStep({ step }) {
          if (step.id === 'optional') throw new WorkflowStepSkippedError()
          return result(step.id)
        },
      },
    )

    expect(run.status).toBe('failed')
    expect(run.steps.optional?.status).toBe('skipped')
    expect(run.steps.dependent?.status).toBe('skipped')
    expect(run.steps.independent?.status).toBe('completed')
  })

  test('cancels in-flight and pending steps through one run signal', async () => {
    const spec = makeSpec([
      { id: 'running', title: 'Running', prompt: 'Running' },
      {
        id: 'pending',
        title: 'Pending',
        prompt: 'Pending',
        dependsOn: ['running'],
      },
    ])
    const controller = new AbortController()

    const execution = executeWorkflow(createRun(spec), {
      signal: controller.signal,
      schedulerSignal: new WorkflowSchedulerSignal(),
      runStep: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          })
        }),
    })
    await Bun.sleep(1)
    controller.abort()
    const run = await execution

    expect(run.status).toBe('cancelled')
    expect(run.steps.running?.status).toBe('cancelled')
    expect(run.steps.pending?.status).toBe('cancelled')
  })

  test('caps persisted model history while retaining the latest models', () => {
    const run = createRun(
      makeSpec([{ id: 'inspect', title: 'Inspect', prompt: 'Inspect' }]),
    )
    let state = run.steps.inspect!
    for (let index = 0; index < 20; index++) {
      state = applyWorkflowAttemptMetrics(state, {
        tokens: 0,
        toolUses: 0,
        model: `model-${index}`,
        estimatedCostUsd: 0,
        hasUnknownCost: false,
      })
    }

    expect(state.models).toHaveLength(16)
    expect(state.models?.[0]).toBe('model-4')
    expect(state.models?.at(-1)).toBe('model-19')
  })

  test('resume keeps completed output and resets unfinished steps', () => {
    const run = createRun(
      makeSpec([
        {
          id: 'done',
          title: 'Done',
          prompt: 'Done',
          outputSchema: {
            type: 'object',
            required: ['cached'],
            properties: { cached: { type: 'boolean' } },
          },
        },
        { id: 'failed', title: 'Failed', prompt: 'Failed' },
      ]),
    )
    run.status = 'failed'
    run.steps.done = {
      id: 'done',
      status: 'completed',
      attempts: 1,
      output: 'cached',
      structuredOutput: { cached: true },
      worktrees: [
        {
          slug: 'wf_12345678-abc-1',
          path: '/repo/.claude/worktrees/wf_12345678-abc-1',
          branch: 'worktree-wf_12345678-abc-1',
          sourceHead: 'a'.repeat(40),
          inputTree: 'b'.repeat(40),
          outputTree: 'c'.repeat(40),
          status: 'merged',
          attempt: 1,
          resumeCount: 0,
          createdAt: 10,
          completedAt: 20,
        },
      ],
      tokens: 12,
      toolUses: 2,
    }
    run.steps.failed = {
      id: 'failed',
      status: 'failed',
      attempts: 1,
      error: 'failed',
      tokens: 5,
      toolUses: 1,
      usage: {
        inputTokens: 3,
        outputTokens: 2,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      },
      models: ['custom-model'],
      estimatedCostUsd: 0,
      hasUnknownCost: true,
    }

    const resumed = prepareWorkflowRunForResume(run, 100)
    expect(resumed.resumeCount).toBe(1)
    expect(resumed.steps.done?.output).toBe('cached')
    expect(resumed.steps.done?.structuredOutput).toEqual({ cached: true })
    expect(resumed.steps.done?.worktrees?.[0]?.status).toBe('merged')
    expect(resumed.steps.failed).toMatchObject({
      status: 'pending',
      attempts: 0,
      tokens: 5,
      toolUses: 1,
      models: ['custom-model'],
      hasUnknownCost: true,
    })
    expect(resumed.totalTokens).toBe(17)
    expect(resumed.hasUnknownCost).toBe(true)
  })
})
