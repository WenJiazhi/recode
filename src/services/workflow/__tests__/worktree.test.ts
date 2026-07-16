import { afterEach, describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitExe } from '../../../utils/git.js'
import { removeAgentWorktree } from '../../../utils/worktree.js'
import { createWorkflowRun } from '../engine.js'
import { WorkflowStepExecutionError } from '../errors.js'
import type {
  WorkflowRun,
  WorkflowStepExecutionResult,
  WorkflowStepWorktree,
} from '../types.js'
import { validateWorkflowSpec } from '../validation.js'
import {
  _clearWorkflowWorktreeStateForTesting,
  recoverWorkflowWorktrees,
  releaseWorkflowWorktreeRun,
  runWorkflowStepInWorktree,
} from '../worktree.js'

const roots: string[] = []

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync(gitExe(), args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

async function createRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-worktree-'))
  roots.push(root)
  runGit(root, ['init'])
  runGit(root, ['config', 'user.name', 'recode-tests'])
  runGit(root, ['config', 'user.email', 'recode-tests@example.com'])
  await writeFile(
    join(root, '.gitignore'),
    '.claude/worktrees/\n.recode/workflow-runs/\n',
  )
  await writeFile(join(root, 'base.txt'), 'base\n')
  await writeFile(join(root, 'staged.txt'), 'staged base\n')
  runGit(root, ['add', '.gitignore', 'base.txt', 'staged.txt'])
  runGit(root, ['commit', '-m', 'initial'])
  return root
}

function createRun(root: string): WorkflowRun {
  const spec = validateWorkflowSpec({
    version: 1,
    name: 'parallel-isolated-writes',
    objective: 'Merge independent changes',
    maxConcurrency: 2,
    steps: [
      {
        id: 'alpha',
        title: 'Alpha',
        prompt: 'Write alpha',
        mode: 'write',
        isolation: 'worktree',
      },
      {
        id: 'beta',
        title: 'Beta',
        prompt: 'Write beta',
        mode: 'write',
        isolation: 'worktree',
      },
    ],
  })
  const run = createWorkflowRun({
    spec,
    sessionId: 'session',
    projectRoot: root,
    runId: '77777777-7777-4777-8777-777777777777',
  })
  for (const state of Object.values(run.steps)) {
    state.status = 'running'
    state.attempts = 1
  }
  return run
}

function updateRecord(
  run: WorkflowRun,
  stepId: string,
  record: WorkflowStepWorktree,
): void {
  const state = run.steps[stepId]!
  const histories = [...(state.worktrees ?? [])]
  const index = histories.findIndex(item => item.slug === record.slug)
  if (index === -1) histories.push(structuredClone(record))
  else histories[index] = structuredClone(record)
  state.worktrees = histories
}

function createBarrier(size: number): () => Promise<void> {
  let arrivals = 0
  let release!: () => void
  const ready = new Promise<void>(resolve => {
    release = resolve
  })
  return async () => {
    arrivals += 1
    if (arrivals === size) release()
    await ready
  }
}

function executionResult(output: string): WorkflowStepExecutionResult {
  return { output, tokens: 1, toolUses: 1 }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('workflow Git worktree isolation', () => {
  afterEach(async () => {
    _clearWorkflowWorktreeStateForTesting()
    while (roots.length > 0) {
      await rm(roots.pop()!, { recursive: true, force: true })
    }
  })

  test('merges parallel non-conflicting changes from a dirty project snapshot', async () => {
    const root = await createRepository()
    await writeFile(join(root, 'base.txt'), 'dirty working copy\n')
    await writeFile(join(root, 'staged.txt'), 'staged before workflow\n')
    runGit(root, ['add', 'staged.txt'])
    await writeFile(join(root, 'draft.txt'), 'untracked draft\n')
    const run = createRun(root)
    const barrier = createBarrier(2)

    await Promise.all(
      run.spec.steps.map(step =>
        runWorkflowStepInWorktree({
          run,
          step,
          onUpdate: record => updateRecord(run, step.id, record),
          async execute(workingDirectory) {
            expect(
              await readFile(join(workingDirectory, 'base.txt'), 'utf8'),
            ).toBe('dirty working copy\n')
            expect(
              await readFile(join(workingDirectory, 'staged.txt'), 'utf8'),
            ).toBe('staged before workflow\n')
            expect(
              await readFile(join(workingDirectory, 'draft.txt'), 'utf8'),
            ).toBe('untracked draft\n')
            await barrier()
            await writeFile(
              join(workingDirectory, `${step.id}.txt`),
              `${step.id}\n`,
            )
            return executionResult(step.id)
          },
        }),
      ),
    )

    expect(await readFile(join(root, 'alpha.txt'), 'utf8')).toBe('alpha\n')
    expect(await readFile(join(root, 'beta.txt'), 'utf8')).toBe('beta\n')
    expect(await readFile(join(root, 'base.txt'), 'utf8')).toBe(
      'dirty working copy\n',
    )
    expect(runGit(root, ['diff', '--cached', '--', 'staged.txt'])).toContain(
      'staged before workflow',
    )
    for (const state of Object.values(run.steps)) {
      expect(state.worktrees?.at(-1)?.status).toBe('merged')
      expect(await exists(state.worktrees!.at(-1)!.path)).toBe(false)
    }
    expect(
      runGit(root, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/recode/workflows',
      ]),
    ).toBe('')
    releaseWorkflowWorktreeRun(run.runId)
  }, 15_000)

  test('retains the conflicting worktree instead of partially overwriting', async () => {
    const root = await createRepository()
    const run = createRun(root)
    const barrier = createBarrier(2)
    const settled = await Promise.allSettled(
      run.spec.steps.map(step =>
        runWorkflowStepInWorktree({
          run,
          step,
          onUpdate: record => updateRecord(run, step.id, record),
          async execute(workingDirectory) {
            await barrier()
            await writeFile(join(workingDirectory, 'base.txt'), `${step.id}\n`)
            return executionResult(step.id)
          },
        }),
      ),
    )

    const diagnostic = settled
      .map(result =>
        result.status === 'rejected' ? String(result.reason) : result.value,
      )
      .join('\n')
    expect(
      settled.filter(result => result.status === 'fulfilled'),
      diagnostic,
    ).toHaveLength(1)
    expect(
      settled.filter(result => result.status === 'rejected'),
      diagnostic,
    ).toHaveLength(1)
    const rejected = settled.find(result => result.status === 'rejected')
    expect(
      rejected?.status === 'rejected' ? rejected.reason : undefined,
    ).toBeInstanceOf(WorkflowStepExecutionError)
    expect(
      rejected?.status === 'rejected'
        ? (rejected.reason as WorkflowStepExecutionError).metrics.tokens
        : undefined,
    ).toBe(1)
    const retained = Object.values(run.steps)
      .flatMap(step => step.worktrees ?? [])
      .find(worktree => worktree.status === 'retained')
    expect(retained).toBeDefined()
    expect(await exists(retained!.path)).toBe(true)
    expect(
      runGit(root, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/recode/workflows',
      ]),
    ).toContain(retained!.slug)
    expect(['alpha\n', 'beta\n']).toContain(
      await readFile(join(root, 'base.txt'), 'utf8'),
    )
    expect(
      await removeAgentWorktree(retained!.path, retained!.branch, root),
    ).toBe(true)
    await recoverWorkflowWorktrees({
      run,
      onUpdate: async (stepId, record) => updateRecord(run, stepId, record),
    })
    expect(
      Object.values(run.steps)
        .flatMap(step => step.worktrees ?? [])
        .find(worktree => worktree.slug === retained!.slug)?.status,
    ).toBe('cleaned')
    expect(
      runGit(root, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/recode/workflows',
      ]),
    ).toBe('')
  }, 15_000)

  test('resume recovery removes a clean interrupted worktree', async () => {
    const root = await createRepository()
    const run = createRun(root)
    const step = run.spec.steps[0]!
    await expect(
      runWorkflowStepInWorktree({
        run,
        step,
        onUpdate: record => updateRecord(run, step.id, record),
        async execute(workingDirectory) {
          await writeFile(join(workingDirectory, 'partial.txt'), 'partial\n')
          throw new Error('simulated crash')
        },
      }),
    ).rejects.toThrow('Worktree retained at')

    const retained = run.steps[step.id]!.worktrees!.at(-1)!
    expect(retained.status).toBe('retained')
    await rm(join(retained.path, 'partial.txt'))
    const active: WorkflowStepWorktree = {
      slug: retained.slug,
      path: retained.path,
      branch: retained.branch,
      sourceHead: retained.sourceHead,
      inputTree: retained.inputTree,
      status: 'active',
      attempt: retained.attempt,
      resumeCount: retained.resumeCount,
      createdAt: retained.createdAt,
    }
    updateRecord(run, step.id, active)
    runGit(root, ['gc', '--prune=now'])

    await recoverWorkflowWorktrees({
      run,
      onUpdate: async (stepId, record) => updateRecord(run, stepId, record),
    })

    expect(run.steps[step.id]!.worktrees!.at(-1)!.status).toBe('cleaned')
    expect(await exists(retained.path)).toBe(false)
    expect(
      runGit(root, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/recode/workflows',
      ]),
    ).toBe('')
  }, 15_000)

  test('resume recovery recognizes a patch applied before the process stopped', async () => {
    const root = await createRepository()
    const run = createRun(root)
    const step = run.spec.steps[0]!
    await expect(
      runWorkflowStepInWorktree({
        run,
        step,
        onUpdate: record => updateRecord(run, step.id, record),
        async execute(workingDirectory) {
          await writeFile(join(workingDirectory, 'applied.txt'), 'applied\n')
          throw new Error('stop before merge')
        },
      }),
    ).rejects.toThrow('Worktree retained at')

    const retained = run.steps[step.id]!.worktrees!.at(-1)!
    await writeFile(join(root, 'applied.txt'), 'applied\n')
    const merging: WorkflowStepWorktree = {
      ...retained,
      status: 'merging',
      completedAt: undefined,
      error: undefined,
      result: executionResult('recovered output'),
    }
    updateRecord(run, step.id, merging)
    runGit(root, ['gc', '--prune=now'])

    let recoveredResult: WorkflowStepExecutionResult | undefined
    await recoverWorkflowWorktrees({
      run,
      onUpdate: async (stepId, record, result) => {
        updateRecord(run, stepId, record)
        recoveredResult = result
      },
    })

    const recovered = run.steps[step.id]!.worktrees!.at(-1)!
    expect(recovered.status, recovered.error).toBe('merged')
    expect(await exists(retained.path)).toBe(false)
    expect(await readFile(join(root, 'applied.txt'), 'utf8')).toBe('applied\n')
    expect(recoveredResult).toEqual(executionResult('recovered output'))
    expect(
      runGit(root, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/recode/workflows',
      ]),
    ).toBe('')
  }, 15_000)

  test('recovers a merged result after cleanup completed before journaling', async () => {
    const root = await createRepository()
    const run = createRun(root)
    const step = run.spec.steps[0]!
    let checkpoint: WorkflowStepWorktree | undefined
    await expect(
      runWorkflowStepInWorktree({
        run,
        step,
        onUpdate: record => {
          updateRecord(run, step.id, record)
          if (record.status === 'merging') {
            checkpoint = structuredClone(record)
            throw new Error('simulated journal interruption')
          }
        },
        async execute(workingDirectory) {
          await writeFile(join(workingDirectory, 'recovered.txt'), 'done\n')
          return executionResult('durable result')
        },
      }),
    ).rejects.toThrow('Worktree retained at')

    const retained = run.steps[step.id]!.worktrees!.at(-1)!
    expect(checkpoint?.status).toBe('merging')
    await writeFile(join(root, 'recovered.txt'), 'done\n')
    const merging: WorkflowStepWorktree = {
      ...checkpoint!,
    }
    updateRecord(run, step.id, merging)
    expect(
      await removeAgentWorktree(retained.path, retained.branch, root),
    ).toBe(true)
    runGit(root, ['gc', '--prune=now'])

    let recoveredResult: WorkflowStepExecutionResult | undefined
    await recoverWorkflowWorktrees({
      run,
      onUpdate: async (stepId, record, result) => {
        updateRecord(run, stepId, record)
        recoveredResult = result
      },
    })

    const recovered = run.steps[step.id]!.worktrees!.at(-1)!
    expect(recovered.status, recovered.error).toBe('merged')
    expect(recoveredResult).toEqual(executionResult('durable result'))
    expect(
      runGit(root, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/recode/workflows',
      ]),
    ).toBe('')
  }, 15_000)

  test('promotes a journaled merged checkpoint before rerunning its agent', async () => {
    const root = await createRepository()
    const run = createRun(root)
    const step = run.spec.steps[0]!
    const expected = executionResult('already merged')

    await runWorkflowStepInWorktree({
      run,
      step,
      onUpdate: record => updateRecord(run, step.id, record),
      async execute(workingDirectory) {
        await writeFile(join(workingDirectory, 'merged.txt'), 'done\n')
        return expected
      },
    })
    const checkpoint = run.steps[step.id]!.worktrees!.at(-1)!
    expect(checkpoint.status).toBe('merged')
    expect(await exists(checkpoint.path)).toBe(false)

    let recoveredResult: WorkflowStepExecutionResult | undefined
    await recoverWorkflowWorktrees({
      run,
      onUpdate: async (stepId, record, result) => {
        updateRecord(run, stepId, record)
        recoveredResult = result
      },
    })

    expect(recoveredResult).toEqual(expected)
    expect(run.steps[step.id]!.worktrees!.at(-1)!.status).toBe('merged')
    expect(await readFile(join(root, 'merged.txt'), 'utf8')).toBe('done\n')
  }, 15_000)

  test('fails closed when the source project changes during execution', async () => {
    const root = await createRepository()
    const run = createRun(root)
    const step = run.spec.steps[0]!

    await expect(
      runWorkflowStepInWorktree({
        run,
        step,
        onUpdate: record => updateRecord(run, step.id, record),
        async execute(workingDirectory) {
          await writeFile(join(workingDirectory, 'isolated.txt'), 'isolated\n')
          await writeFile(join(root, 'outside.txt'), 'outside\n')
          return executionResult('finished')
        },
      }),
    ).rejects.toThrow('changed outside the workflow')

    expect(await readFile(join(root, 'outside.txt'), 'utf8')).toBe('outside\n')
    expect(await exists(join(root, 'isolated.txt'))).toBe(false)
    const retained = run.steps[step.id]!.worktrees!.at(-1)!
    expect(retained.status).toBe('retained')
    expect(await readFile(join(retained.path, 'isolated.txt'), 'utf8')).toBe(
      'isolated\n',
    )
  }, 15_000)

  test('recovers a no-change merge checkpoint without rerunning its result', async () => {
    const root = await createRepository()
    const run = createRun(root)
    const step = run.spec.steps[0]!
    let releaseCheckpoint!: () => void
    let markCheckpointReady!: () => void
    const checkpointReady = new Promise<void>(resolve => {
      markCheckpointReady = resolve
    })
    const checkpointGate = new Promise<void>(resolve => {
      releaseCheckpoint = resolve
    })
    const execution = runWorkflowStepInWorktree({
      run,
      step,
      async onUpdate(record) {
        updateRecord(run, step.id, record)
        if (record.status === 'merging') {
          markCheckpointReady()
          await checkpointGate
        }
      },
      async execute() {
        return executionResult('no file changes')
      },
    })

    await checkpointReady
    let recoveredResult: WorkflowStepExecutionResult | undefined
    try {
      await recoverWorkflowWorktrees({
        run,
        onUpdate: async (stepId, record, result) => {
          updateRecord(run, stepId, record)
          recoveredResult = result
        },
      })
    } finally {
      releaseCheckpoint()
    }
    await expect(execution).rejects.toThrow('failed')

    const recovered = run.steps[step.id]!.worktrees!.at(-1)!
    expect(recovered.status, recovered.error).toBe('merged')
    expect(recoveredResult).toEqual(executionResult('no file changes'))
    expect(await exists(recovered.path)).toBe(false)
  }, 15_000)
})
