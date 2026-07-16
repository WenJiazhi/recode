import type {
  LocalCommandCall,
  LocalCommandResult,
} from '../../types/command.js'
import { getProjectRoot } from '../../bootstrap/state.js'
import { getCwd } from '../../utils/cwd.js'
import {
  configureWorkflowRun,
  launchWorkflow,
  resumeWorkflow,
  stopWorkflow,
} from '../../services/workflow/service.js'
import {
  discoverWorkflowTemplates,
  instantiateWorkflowTemplate,
  resolveWorkflowTemplate,
  WORKFLOW_TEMPLATES_RELATIVE_DIR,
} from '../../services/workflow/templates.js'
import {
  getWorkflowRuns,
  hydrateWorkflowRuns,
} from '../../services/workflow/store.js'
import type { WorkflowRun } from '../../services/workflow/types.js'
import { formatTokens } from '../../utils/format.js'
import { parseTokenBudgetValue } from '../../utils/tokenBudget.js'
import { basename } from 'node:path'

function text(value: string): LocalCommandResult {
  return { type: 'text', value }
}

function splitHead(value: string): [string, string] {
  const trimmed = value.trim()
  const boundary = trimmed.search(/\s/)
  if (boundary === -1) return [trimmed, '']
  return [trimmed.slice(0, boundary), trimmed.slice(boundary).trim()]
}

async function templateList(projectRoot: string): Promise<LocalCommandResult> {
  const discovery = await discoverWorkflowTemplates(projectRoot)
  if (discovery.templates.length === 0 && discovery.diagnostics.length === 0) {
    return text(
      `No workflow templates found in ${WORKFLOW_TEMPLATES_RELATIVE_DIR}.`,
    )
  }

  const lines = [`Workflow templates (${WORKFLOW_TEMPLATES_RELATIVE_DIR}):`]
  for (const template of discovery.templates) {
    lines.push(
      `- ${template.name}${template.argumentHint ? ` ${template.argumentHint}` : ''} - ${template.description}`,
    )
  }
  if (discovery.templates.length === 0) lines.push('- No valid templates')
  if (discovery.diagnostics.length > 0) {
    lines.push('', 'Invalid templates:')
    for (const diagnostic of discovery.diagnostics) {
      lines.push(`- ${basename(diagnostic.filePath)}: ${diagnostic.message}`)
    }
  }
  lines.push('', 'Run one with `/workflows run <name> [arguments]`.')
  return text(lines.join('\n'))
}

function resolveRun(
  reference: string,
  runs: WorkflowRun[],
): WorkflowRun | null {
  const matches = runs.filter(
    run => run.runId === reference || run.runId.startsWith(reference),
  )
  return matches.length === 1 ? matches[0]! : null
}

function statusLine(run: WorkflowRun): string {
  const completed = Object.values(run.steps).filter(
    step => step.status === 'completed',
  ).length
  return `${run.runId.slice(0, 8)}  ${run.status.padEnd(14)}  ${completed}/${run.spec.steps.length}  ${run.spec.name}`
}

function detail(run: WorkflowRun): string {
  const lines = [
    `Workflow: ${run.spec.name}`,
    `Run ID: ${run.runId}`,
    `Status: ${run.status}`,
    `Objective: ${run.spec.objective}`,
    `Usage: ${formatTokens(run.totalTokens)}${run.tokenBudget === null ? '' : ` / ${formatTokens(run.tokenBudget)}`} tokens, ${run.totalToolUses} tool calls`,
    `Concurrency: ${run.concurrencyLimit} (launch default ${run.spec.maxConcurrency})`,
    `Estimated cost: $${run.estimatedCostUsd.toFixed(4)}${run.hasUnknownCost ? ' (incomplete)' : ''}`,
    `Resumes: ${run.resumeCount}`,
    '',
    'Steps:',
  ]
  for (const specStep of run.spec.steps) {
    const step = run.steps[specStep.id]!
    const model = step.models?.at(-1)
    const modelLabel = model
      ? ` [${model}${step.models && step.models.length > 1 ? ` +${step.models.length - 1}` : ''}]`
      : ''
    lines.push(
      `- [${step.status}] ${specStep.id}: ${specStep.title}${specStep.outputSchema ? ' [structured]' : ''}${specStep.isolation ? ` [${specStep.isolation}]` : ''}${modelLabel} · ${formatTokens(step.tokens)} tokens${step.error ? ` - ${step.error}` : ''}`,
    )
    for (const worktree of step.worktrees ?? []) {
      if (
        worktree.status === 'retained' ||
        (worktree.status === 'merged' && worktree.error)
      ) {
        lines.push(
          `  ${worktree.status} worktree: ${worktree.path}${worktree.error ? ` - ${worktree.error}` : ''}`,
        )
      }
    }
  }
  if (run.error) lines.push('', `Error: ${run.error}`)
  return lines.join('\n')
}

export const call: LocalCommandCall = async (args, context) => {
  const [action, remainder] = splitHead(args)
  const [reference, value] = splitHead(remainder)

  if (action === 'templates') return templateList(getProjectRoot())

  if (action === 'run') {
    if (!reference) {
      return text('Usage: /workflows run <name> [arguments]')
    }
    if (!context.canUseTool) {
      return text('Workflow templates require an interactive Recode session.')
    }
    try {
      const template = await resolveWorkflowTemplate(
        getProjectRoot(),
        reference,
      )
      const spec = instantiateWorkflowTemplate(template, value)
      const launched = await launchWorkflow(spec, {
        toolUseContext: context,
        canUseTool: context.canUseTool,
      })
      return text(
        `Workflow template ${template.name} launched as task ${launched.taskId} (run ${launched.runId.slice(0, 8)}).`,
      )
    } catch (error) {
      return text(error instanceof Error ? error.message : String(error))
    }
  }

  const projectRoot = getCwd()
  await hydrateWorkflowRuns(projectRoot)
  const runs = getWorkflowRuns(projectRoot)

  if (!action) {
    if (runs.length === 0) {
      return text(
        'No workflows have been recorded for this project. Use `/workflows templates` to list reusable project templates.',
      )
    }
    return text(
      [
        'Recent workflows:',
        ...runs.slice(0, 10).map(statusLine),
        '',
        'Use `/workflows <run-id>` for details.',
        'Use `/workflows templates` to list reusable project templates.',
      ].join('\n'),
    )
  }

  if (action === 'stop' || action === 'resume') {
    if (!reference) return text(`Usage: /workflows ${action} <run-id>`)
    const run = resolveRun(reference, runs)
    if (!run) return text(`Workflow run is missing or ambiguous: ${reference}`)
    if (action === 'stop') {
      return text(
        stopWorkflow(run.runId)
          ? `Workflow ${run.runId.slice(0, 8)} is stopping.`
          : 'That workflow is not active in this Recode process.',
      )
    }
    if (!context.canUseTool) {
      return text('Workflow resume requires an interactive Recode session.')
    }
    try {
      const resumed = await resumeWorkflow(run.runId, {
        toolUseContext: context,
        canUseTool: context.canUseTool,
      })
      return text(
        `Workflow ${run.runId.slice(0, 8)} resumed as task ${resumed.taskId}.`,
      )
    } catch (error) {
      return text(error instanceof Error ? error.message : String(error))
    }
  }

  if (action === 'concurrency' || action === 'budget') {
    if (!reference || !value) {
      return text(
        action === 'concurrency'
          ? 'Usage: /workflows concurrency <run-id> <1-6>'
          : 'Usage: /workflows budget <run-id> <tokens|none>',
      )
    }
    const run = resolveRun(reference, runs)
    if (!run) return text(`Workflow run is missing or ambiguous: ${reference}`)
    const configuration =
      action === 'concurrency'
        ? { maxConcurrency: Number(value) }
        : value.toLowerCase() === 'none' || value.toLowerCase() === 'unlimited'
          ? { tokenBudget: null }
          : { tokenBudget: parseTokenBudgetValue(value) ?? Number.NaN }
    try {
      const configured = await configureWorkflowRun(run.runId, configuration)
      return text(
        action === 'concurrency'
          ? `Workflow ${run.runId.slice(0, 8)} concurrency set to ${configured.concurrencyLimit}.`
          : `Workflow ${run.runId.slice(0, 8)} token budget set to ${configured.tokenBudget === null ? 'unlimited' : formatTokens(configured.tokenBudget)}.`,
      )
    } catch (error) {
      return text(error instanceof Error ? error.message : String(error))
    }
  }

  const run = resolveRun(action, runs)
  return run ? text(detail(run)) : text(`Workflow run not found: ${action}`)
}
