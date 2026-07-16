import { createHash } from 'node:crypto'
import { mkdtemp, realpath, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { errorMessage } from '../../utils/errors.js'
import { execFileNoThrowWithCwd } from '../../utils/execFileNoThrow.js'
import { findCanonicalGitRoot, findGitRoot, gitExe } from '../../utils/git.js'
import {
  createAgentWorktree,
  getAgentWorktreePath,
  removeAgentWorktree,
  worktreeBranchName,
} from '../../utils/worktree.js'
import type {
  WorkflowRun,
  WorkflowStep,
  WorkflowStepExecutionResult,
  WorkflowStepWorktree,
} from './types.js'
import { WorkflowStepExecutionError } from './errors.js'

const MAX_WORKFLOW_PATCH_BYTES = 20_000_000
const GIT_OUTPUT_BUFFER_BYTES = MAX_WORKFLOW_PATCH_BYTES + 1_000_000

type RepositoryContext = {
  sourceRoot: string
  canonicalRoot: string
  workerRelativeCwd: string
  sourceExcludes: string[]
}

type RunMergeState = {
  active: number
  expectedTree?: string
  tail: Promise<void>
}

type WorktreeRecordUpdater = (
  record: WorkflowStepWorktree,
) => Promise<void> | void

const runMergeStates = new Map<string, RunMergeState>()

function runState(runId: string): RunMergeState {
  const existing = runMergeStates.get(runId)
  if (existing) return existing
  const created: RunMergeState = {
    active: 0,
    tail: Promise.resolve(),
  }
  runMergeStates.set(runId, created)
  return created
}

async function withRunLock<T>(
  runId: string,
  operation: (state: RunMergeState) => Promise<T>,
): Promise<T> {
  const state = runState(runId)
  const previous = state.tail
  let release!: () => void
  state.tail = new Promise<void>(resolveLock => {
    release = resolveLock
  })
  await previous
  try {
    return await operation(state)
  } finally {
    release()
  }
}

async function runGit(
  cwd: string,
  args: string[],
  options: {
    env?: Record<string, string | undefined>
    input?: string
    maxBuffer?: number
  } = {},
): Promise<string> {
  const result = await execFileNoThrowWithCwd(gitExe(), args, {
    cwd,
    env: options.env,
    input: options.input,
    stdin: options.input === undefined ? 'ignore' : undefined,
    maxBuffer: options.maxBuffer ?? 1_000_000,
  })
  if (result.code !== 0) {
    const detail =
      result.stderr.trim() || result.stdout.trim() || 'unknown error'
    throw new Error(`git ${args[0] ?? 'command'} failed: ${detail}`)
  }
  return result.stdout.trim()
}

function repoRelativePath(
  repoRoot: string,
  absolutePath: string,
): string | null {
  const value = relative(repoRoot, absolutePath)
  if (
    !value ||
    isAbsolute(value) ||
    value === '..' ||
    value.startsWith(`..${sep}`)
  ) {
    return null
  }
  return value.split(sep).join('/')
}

async function exclusionPathspecs(
  repoRoot: string,
  absolutePaths: string[],
): Promise<string[]> {
  const pathspecs: string[] = []
  for (const path of absolutePaths) {
    const value = repoRelativePath(repoRoot, path)
    if (!value) continue
    const ignored = await execFileNoThrowWithCwd(
      gitExe(),
      ['check-ignore', '-q', '--', value],
      { cwd: repoRoot, stdin: 'ignore' },
    )
    // Passing an ignored path as an explicit exclude still makes `git add`
    // fail. Ignored paths are already absent from the temporary index.
    if (ignored.code !== 0) {
      pathspecs.push(`:(top,literal,exclude)${value}`)
    }
  }
  return pathspecs
}

async function snapshotWorkingTree(
  repoRoot: string,
  baseTree: string,
  excludedPaths: string[],
): Promise<string> {
  const temp = await mkdtemp(join(tmpdir(), 'recode-workflow-index-'))
  const indexPath = join(temp, 'index')
  const env = { ...process.env, GIT_INDEX_FILE: indexPath }
  try {
    await runGit(repoRoot, ['read-tree', baseTree], { env })
    await runGit(
      repoRoot,
      [
        'add',
        '-A',
        '--',
        '.',
        ...(await exclusionPathspecs(repoRoot, excludedPaths)),
      ],
      { env, maxBuffer: GIT_OUTPUT_BUFFER_BYTES },
    )
    return await runGit(repoRoot, ['write-tree'], { env })
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

async function diffTrees(
  repoRoot: string,
  fromTree: string,
  toTree: string,
): Promise<string> {
  if (fromTree === toTree) return ''
  const result = await execFileNoThrowWithCwd(
    gitExe(),
    [
      'diff',
      '--binary',
      '--full-index',
      '--no-ext-diff',
      '--no-textconv',
      '--no-renames',
      fromTree,
      toTree,
      '--',
      '.',
    ],
    { cwd: repoRoot, stdin: 'ignore', maxBuffer: GIT_OUTPUT_BUFFER_BYTES },
  )
  if (result.code !== 0) {
    throw new Error(`Failed to create workflow patch: ${result.stderr.trim()}`)
  }
  if (!result.stdout) return ''
  const patch = result.stdout.endsWith('\n')
    ? result.stdout
    : `${result.stdout}\n`
  if (Buffer.byteLength(patch) > MAX_WORKFLOW_PATCH_BYTES) {
    throw new Error(`Workflow patch exceeds ${MAX_WORKFLOW_PATCH_BYTES} bytes`)
  }
  return patch
}

async function canApplyPatch(
  repoRoot: string,
  patch: string,
  reverse = false,
): Promise<boolean> {
  if (!patch) return true
  const result = await execFileNoThrowWithCwd(
    gitExe(),
    [
      'apply',
      '--check',
      '--binary',
      '--whitespace=nowarn',
      ...(reverse ? ['--reverse'] : []),
      '-',
    ],
    {
      cwd: repoRoot,
      input: patch,
      maxBuffer: GIT_OUTPUT_BUFFER_BYTES,
    },
  )
  return result.code === 0
}

async function applyPatch(repoRoot: string, patch: string): Promise<void> {
  if (!patch) return
  const check = await execFileNoThrowWithCwd(
    gitExe(),
    ['apply', '--check', '--binary', '--whitespace=nowarn', '-'],
    {
      cwd: repoRoot,
      input: patch,
      maxBuffer: GIT_OUTPUT_BUFFER_BYTES,
    },
  )
  if (check.code !== 0) {
    throw new Error(
      `Workflow patch conflicts with the current project state: ${check.stderr.trim() || check.stdout.trim() || 'git apply --check failed'}`,
    )
  }
  await runGit(repoRoot, ['apply', '--binary', '--whitespace=nowarn', '-'], {
    input: patch,
    maxBuffer: GIT_OUTPUT_BUFFER_BYTES,
  })
}

function resolveRepositoryContext(run: WorkflowRun): RepositoryContext {
  const sourceRoot = findGitRoot(run.projectRoot)
  const canonicalRoot = findCanonicalGitRoot(run.projectRoot)
  if (!sourceRoot || !canonicalRoot) {
    throw new Error('Worktree-isolated workflow steps require a Git repository')
  }
  const workerRelativeCwd = relative(sourceRoot, run.projectRoot)
  if (
    isAbsolute(workerRelativeCwd) ||
    workerRelativeCwd === '..' ||
    workerRelativeCwd.startsWith(`..${sep}`)
  ) {
    throw new Error('Workflow project directory is outside its Git repository')
  }
  return {
    sourceRoot,
    canonicalRoot,
    workerRelativeCwd,
    sourceExcludes: [
      join(run.projectRoot, '.recode', 'workflow-runs'),
      join(canonicalRoot, '.claude', 'worktrees'),
    ],
  }
}

async function repositoryHead(repoRoot: string): Promise<string> {
  return runGit(repoRoot, ['rev-parse', '--verify', 'HEAD^{commit}'])
}

async function assertNoUnmergedEntries(repoRoot: string): Promise<void> {
  const unmerged = await runGit(repoRoot, ['ls-files', '-u'])
  if (unmerged) {
    throw new Error(
      'Cannot isolate a workflow step while the project has unresolved Git conflicts',
    )
  }
}

function workflowWorktreeSlug(
  run: WorkflowRun,
  step: WorkflowStep,
  sequence: number,
): string {
  const hash = createHash('sha256')
    .update(`${run.runId}:${step.id}:${sequence}`)
    .digest('hex')
  return `wf_${hash.slice(0, 8)}-${hash.slice(8, 11)}-${sequence}`
}

function workflowTreeRef(
  runId: string,
  slug: string,
  kind: 'input' | 'output',
): string {
  return `refs/recode/workflows/${runId}/${slug}/${kind}`
}

async function retainWorkflowTree(
  repoRoot: string,
  runId: string,
  slug: string,
  kind: 'input' | 'output',
  tree: string,
): Promise<void> {
  const anchor = await runGit(
    repoRoot,
    ['commit-tree', tree, '-m', `Recode workflow ${kind} snapshot`],
    {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Recode Workflow',
        GIT_AUTHOR_EMAIL: 'workflow@recode.local',
        GIT_COMMITTER_NAME: 'Recode Workflow',
        GIT_COMMITTER_EMAIL: 'workflow@recode.local',
      },
    },
  )
  await runGit(repoRoot, [
    'update-ref',
    workflowTreeRef(runId, slug, kind),
    anchor,
  ])
}

async function deleteWorkflowTreeRefs(
  repoRoot: string,
  runId: string,
  slug: string,
): Promise<void> {
  await Promise.all(
    (['input', 'output'] as const).map(kind =>
      execFileNoThrowWithCwd(
        gitExe(),
        ['update-ref', '-d', workflowTreeRef(runId, slug, kind)],
        { cwd: repoRoot, stdin: 'ignore' },
      ),
    ),
  )
}

async function samePath(left: string, right: string): Promise<boolean> {
  try {
    return (await realpath(left)) === (await realpath(right))
  } catch {
    return resolve(left) === resolve(right)
  }
}

async function assertWorktreeIdentity(
  path: string,
  branch: string,
): Promise<void> {
  const [topLevel, currentBranch] = await Promise.all([
    runGit(path, ['rev-parse', '--show-toplevel']),
    runGit(path, ['branch', '--show-current']),
  ])
  if (!(await samePath(topLevel, path)) || currentBranch !== branch) {
    throw new Error('Workflow worktree identity changed during execution')
  }
}

async function removeRecordedWorktree(
  context: RepositoryContext,
  record: WorkflowStepWorktree,
): Promise<boolean> {
  const path = getAgentWorktreePath(context.canonicalRoot, record.slug)
  await assertWorktreeIdentity(path, worktreeBranchName(record.slug))
  return removeAgentWorktree(
    path,
    worktreeBranchName(record.slug),
    context.canonicalRoot,
  )
}

async function reserveInputTree(
  run: WorkflowRun,
  context: RepositoryContext,
  sourceHead: string,
): Promise<string> {
  return withRunLock(run.runId, async state => {
    const currentTree = await snapshotWorkingTree(
      context.sourceRoot,
      sourceHead,
      context.sourceExcludes,
    )
    if (
      state.active > 0 &&
      state.expectedTree !== undefined &&
      currentTree !== state.expectedTree
    ) {
      throw new Error(
        'Project files changed outside the workflow while isolated steps were running',
      )
    }
    state.expectedTree = currentTree
    state.active += 1
    return currentTree
  })
}

async function releaseReservation(runId: string): Promise<void> {
  await withRunLock(runId, async state => {
    state.active = Math.max(0, state.active - 1)
  })
}

async function settleUnmergedWorktree(
  runId: string,
  context: RepositoryContext,
  record: WorkflowStepWorktree,
  onUpdate: WorktreeRecordUpdater,
  failure: string,
): Promise<WorkflowStepWorktree> {
  try {
    await assertWorktreeIdentity(record.path, record.branch)
    const outputTree = await snapshotWorkingTree(
      record.path,
      record.inputTree,
      [
        join(record.path, '.claude', 'worktrees'),
        join(record.path, '.recode', 'workflow-runs'),
      ],
    )
    if (outputTree === record.inputTree) {
      const removed = await removeRecordedWorktree(context, record)
      const next: WorkflowStepWorktree = {
        ...record,
        outputTree,
        status: removed ? 'cleaned' : 'retained',
        completedAt: Date.now(),
        ...(removed ? {} : { error: 'Failed to remove clean worktree' }),
      }
      await onUpdate(next)
      if (removed) {
        await deleteWorkflowTreeRefs(context.canonicalRoot, runId, record.slug)
      }
      return next
    }
    const retained: WorkflowStepWorktree = {
      ...record,
      outputTree,
      status: 'retained',
      completedAt: Date.now(),
      error: failure.slice(0, 4000),
    }
    await onUpdate(retained)
    return retained
  } catch (error) {
    const retained: WorkflowStepWorktree = {
      ...record,
      status: 'retained',
      completedAt: Date.now(),
      error:
        `${failure}; cleanup inspection failed: ${errorMessage(error)}`.slice(
          0,
          4000,
        ),
    }
    await onUpdate(retained)
    return retained
  }
}

export async function runWorkflowStepInWorktree(input: {
  run: WorkflowRun
  step: WorkflowStep
  onUpdate: WorktreeRecordUpdater
  execute: (
    workingDirectory: string,
    worktreePath: string,
  ) => Promise<WorkflowStepExecutionResult>
}): Promise<WorkflowStepExecutionResult> {
  const { run, step, onUpdate, execute } = input
  const context = resolveRepositoryContext(run)
  await assertNoUnmergedEntries(context.sourceRoot)
  const sourceHead = await repositoryHead(context.sourceRoot)
  const inputTree = await reserveInputTree(run, context, sourceHead)
  let reservationActive = true
  let record: WorkflowStepWorktree | undefined
  let mergeApplied = false
  let inputRefCreated = false
  let createdSlug: string | undefined
  let createdWorktree:
    | {
        path: string
        branch: string
        gitRoot: string
      }
    | undefined

  try {
    const sequence = (run.steps[step.id]?.worktrees?.length ?? 0) + 1
    const slug = workflowWorktreeSlug(run, step, sequence)
    createdSlug = slug
    const created = await createAgentWorktree(slug, {
      baseRef: sourceHead,
      requireGit: true,
      allowExisting: false,
      sourcePath: context.sourceRoot,
      useSparsePaths: false,
    })
    if (!created.gitRoot || !created.worktreeBranch) {
      throw new Error('Git worktree creation returned incomplete metadata')
    }
    createdWorktree = {
      path: created.worktreePath,
      branch: created.worktreeBranch,
      gitRoot: created.gitRoot,
    }

    const initialPatch = await diffTrees(
      context.sourceRoot,
      sourceHead,
      inputTree,
    )
    await applyPatch(created.worktreePath, initialPatch)
    await assertWorktreeIdentity(created.worktreePath, created.worktreeBranch)
    const preparedTree = await snapshotWorkingTree(
      created.worktreePath,
      inputTree,
      [
        join(created.worktreePath, '.claude', 'worktrees'),
        join(created.worktreePath, '.recode', 'workflow-runs'),
      ],
    )
    if (preparedTree !== inputTree) {
      throw new Error(
        'Prepared workflow worktree does not match the project snapshot',
      )
    }

    await retainWorkflowTree(
      context.canonicalRoot,
      run.runId,
      slug,
      'input',
      inputTree,
    )
    inputRefCreated = true

    record = {
      slug,
      path: created.worktreePath,
      branch: created.worktreeBranch,
      sourceHead,
      inputTree,
      status: 'active',
      attempt: Math.max(1, run.steps[step.id]?.attempts ?? 1),
      resumeCount: run.resumeCount,
      createdAt: Date.now(),
    }
    await onUpdate(record)

    const workingDirectory = context.workerRelativeCwd
      ? join(created.worktreePath, context.workerRelativeCwd)
      : created.worktreePath
    const result = await execute(workingDirectory, created.worktreePath)
    await assertWorktreeIdentity(record.path, record.branch)
    const outputTree = await snapshotWorkingTree(
      record.path,
      record.inputTree,
      [
        join(record.path, '.claude', 'worktrees'),
        join(record.path, '.recode', 'workflow-runs'),
      ],
    )
    await retainWorkflowTree(
      context.canonicalRoot,
      run.runId,
      record.slug,
      'output',
      outputTree,
    )
    const patch = await diffTrees(
      context.canonicalRoot,
      record.inputTree,
      outputTree,
    )
    record = {
      ...record,
      outputTree,
      status: 'merging',
      result: structuredClone(result),
    }
    await onUpdate(record)

    await withRunLock(run.runId, async state => {
      const currentTree = await snapshotWorkingTree(
        context.sourceRoot,
        sourceHead,
        context.sourceExcludes,
      )
      if (
        state.expectedTree !== undefined &&
        currentTree !== state.expectedTree
      ) {
        throw new Error(
          'Project files changed outside the workflow before worktree merge',
        )
      }
      await applyPatch(context.sourceRoot, patch)
      mergeApplied = true
      state.expectedTree = await snapshotWorkingTree(
        context.sourceRoot,
        sourceHead,
        context.sourceExcludes,
      )
    })

    const removed = await removeRecordedWorktree(context, record)
    if (removed) createdWorktree = undefined
    record = {
      ...record,
      status: 'merged',
      completedAt: Date.now(),
      ...(removed
        ? {}
        : { error: 'Changes merged, but worktree cleanup failed' }),
    }
    await onUpdate(record)
    if (removed) {
      await deleteWorkflowTreeRefs(
        context.canonicalRoot,
        run.runId,
        record.slug,
      )
    }
    return result
  } catch (error) {
    let finalError = error
    if (!mergeApplied && record) {
      const settled = await settleUnmergedWorktree(
        run.runId,
        context,
        record,
        onUpdate,
        errorMessage(error),
      )
      if (settled.status === 'retained') {
        finalError = new Error(
          `${errorMessage(error)}. Worktree retained at ${settled.path}`,
          { cause: error },
        )
      }
    } else if (!record && createdWorktree) {
      await removeAgentWorktree(
        createdWorktree.path,
        createdWorktree.branch,
        createdWorktree.gitRoot,
      )
      if (inputRefCreated && createdSlug) {
        await deleteWorkflowTreeRefs(
          context.canonicalRoot,
          run.runId,
          createdSlug,
        )
      }
    }
    if (record?.result) {
      throw new WorkflowStepExecutionError(finalError, record.result)
    }
    throw finalError
  } finally {
    if (reservationActive) {
      reservationActive = false
      await releaseReservation(run.runId)
    }
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function recoverWorkflowWorktrees(input: {
  run: WorkflowRun
  onUpdate: (
    stepId: string,
    record: WorkflowStepWorktree,
    recoveredResult?: WorkflowStepExecutionResult,
  ) => Promise<void>
}): Promise<void> {
  const { run, onUpdate } = input
  const hasRecoverableWorktree = Object.values(run.steps).some(step =>
    step.worktrees?.some(
      worktree =>
        worktree.status === 'active' ||
        worktree.status === 'merging' ||
        worktree.status === 'retained' ||
        (worktree.status === 'merged' &&
          step.status !== 'completed' &&
          worktree.result !== undefined),
    ),
  )
  if (!hasRecoverableWorktree) return
  const context = resolveRepositoryContext(run)
  for (const step of run.spec.steps) {
    const histories = run.steps[step.id]?.worktrees ?? []
    for (const persisted of histories) {
      if (
        persisted.status !== 'active' &&
        persisted.status !== 'merging' &&
        persisted.status !== 'retained' &&
        !(
          persisted.status === 'merged' &&
          run.steps[step.id]?.status !== 'completed' &&
          persisted.result !== undefined
        )
      ) {
        continue
      }
      const path = getAgentWorktreePath(context.canonicalRoot, persisted.slug)
      const record = {
        ...persisted,
        path,
        branch: worktreeBranchName(persisted.slug),
      }
      if (
        record.status === 'merged' &&
        run.steps[step.id]?.status !== 'completed' &&
        record.result
      ) {
        let cleaned = !(await pathExists(path))
        let cleanupError: string | undefined
        if (!cleaned) {
          try {
            cleaned = await removeRecordedWorktree(context, record)
            if (!cleaned) cleanupError = 'Recovered merge cleanup failed'
          } catch (error) {
            cleanupError = `Recovered merge cleanup failed: ${errorMessage(error)}`
          }
        }
        const recovered: WorkflowStepWorktree = {
          ...record,
          completedAt: record.completedAt ?? Date.now(),
          error: cleaned ? undefined : cleanupError?.slice(0, 4000),
        }
        await onUpdate(step.id, recovered, recovered.result)
        if (cleaned) {
          await deleteWorkflowTreeRefs(
            context.canonicalRoot,
            run.runId,
            record.slug,
          )
        }
        continue
      }
      if (!(await pathExists(path))) {
        if (record.status === 'retained') {
          const cleaned: WorkflowStepWorktree = {
            ...record,
            status: 'cleaned',
            completedAt: Date.now(),
            error: 'Retained worktree was removed before resume recovery',
          }
          await onUpdate(step.id, cleaned)
          await deleteWorkflowTreeRefs(
            context.canonicalRoot,
            run.runId,
            record.slug,
          )
          continue
        }
        if (record.status === 'merging' && record.outputTree) {
          try {
            const patch = await diffTrees(
              context.canonicalRoot,
              record.inputTree,
              record.outputTree,
            )
            if (await canApplyPatch(context.sourceRoot, patch, true)) {
              const merged: WorkflowStepWorktree = {
                ...record,
                status: 'merged',
                completedAt: Date.now(),
                error: undefined,
              }
              await onUpdate(step.id, merged, merged.result)
              await deleteWorkflowTreeRefs(
                context.canonicalRoot,
                run.runId,
                record.slug,
              )
              continue
            }
          } catch (error) {
            const retained: WorkflowStepWorktree = {
              ...record,
              status: 'retained',
              completedAt: Date.now(),
              error:
                `Missing worktree recovery failed: ${errorMessage(error)}`.slice(
                  0,
                  4000,
                ),
            }
            await onUpdate(step.id, retained)
            continue
          }
        }
        const cleaned: WorkflowStepWorktree = {
          ...record,
          status: 'cleaned',
          completedAt: Date.now(),
          error: 'Worktree was already absent during resume recovery',
        }
        await onUpdate(step.id, cleaned)
        await deleteWorkflowTreeRefs(
          context.canonicalRoot,
          run.runId,
          record.slug,
        )
        continue
      }
      if (record.status === 'retained') continue
      try {
        await assertWorktreeIdentity(path, record.branch)
        const outputTree = await snapshotWorkingTree(path, record.inputTree, [
          join(path, '.claude', 'worktrees'),
          join(path, '.recode', 'workflow-runs'),
        ])
        if (outputTree === record.inputTree) {
          const removed = await removeRecordedWorktree(context, record)
          const recoveredStatus =
            record.status === 'merging' ? 'merged' : 'cleaned'
          const recovered: WorkflowStepWorktree = {
            ...record,
            outputTree,
            status: removed ? recoveredStatus : 'retained',
            completedAt: Date.now(),
            ...(removed ? {} : { error: 'Failed to remove clean worktree' }),
          }
          await onUpdate(
            step.id,
            recovered,
            recoveredStatus === 'merged' ? recovered.result : undefined,
          )
          if (removed) {
            await deleteWorkflowTreeRefs(
              context.canonicalRoot,
              run.runId,
              record.slug,
            )
          }
          continue
        }
        if (record.status === 'merging') {
          if (record.outputTree && outputTree !== record.outputTree) {
            await onUpdate(step.id, {
              ...record,
              outputTree,
              status: 'retained',
              completedAt: Date.now(),
              error:
                'Worktree changed after its merge checkpoint; changes retained for inspection',
            })
            continue
          }
          const patch = await diffTrees(
            context.canonicalRoot,
            record.inputTree,
            outputTree,
          )
          if (await canApplyPatch(context.sourceRoot, patch, true)) {
            const removed = await removeRecordedWorktree(context, record)
            const merged: WorkflowStepWorktree = {
              ...record,
              outputTree,
              status: 'merged',
              completedAt: Date.now(),
              ...(removed
                ? {}
                : { error: 'Recovered merge, but worktree cleanup failed' }),
            }
            await onUpdate(step.id, merged, merged.result)
            if (removed) {
              await deleteWorkflowTreeRefs(
                context.canonicalRoot,
                run.runId,
                record.slug,
              )
            }
            continue
          }
        }
        await onUpdate(step.id, {
          ...record,
          outputTree,
          status: 'retained',
          completedAt: Date.now(),
          error: 'Unmerged changes retained during resume recovery',
        })
      } catch (error) {
        await onUpdate(step.id, {
          ...record,
          status: 'retained',
          completedAt: Date.now(),
          error: `Resume recovery failed: ${errorMessage(error)}`.slice(
            0,
            4000,
          ),
        })
      }
    }
  }
  const state = runMergeStates.get(run.runId)
  if (state?.active === 0) runMergeStates.delete(run.runId)
}

export function releaseWorkflowWorktreeRun(runId: string): void {
  const state = runMergeStates.get(runId)
  if (!state || state.active === 0) runMergeStates.delete(runId)
}

export function _clearWorkflowWorktreeStateForTesting(): void {
  runMergeStates.clear()
}
