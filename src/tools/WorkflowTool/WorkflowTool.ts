import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import type { WorkflowRun } from '../../services/workflow/types.js'
import {
  MAX_WORKFLOW_TEMPLATE_ARGUMENT_CHARS,
  workflowTemplateNameSchema,
} from '../../services/workflow/templates.js'
import {
  MAX_WORKFLOW_CONCURRENCY,
  workflowSpecSchema,
} from '../../services/workflow/validation.js'
import { MAX_TOKEN_BUDGET } from '../../utils/tokenBudget.js'
import { WORKFLOW_TOOL_NAME } from './constants.js'
import {
  renderToolResultMessage,
  renderToolUseMessage,
  renderToolUseRejectedMessage,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z
    .strictObject({
      action: z
        .enum(['launch', 'status', 'resume', 'cancel', 'configure'])
        .default('launch'),
      spec: workflowSpecSchema.optional(),
      template_name: workflowTemplateNameSchema.optional(),
      template_arguments: z
        .string()
        .max(MAX_WORKFLOW_TEMPLATE_ARGUMENT_CHARS)
        .optional(),
      run_id: z.string().uuid().optional(),
      max_concurrency: z
        .number()
        .int()
        .min(1)
        .max(MAX_WORKFLOW_CONCURRENCY)
        .optional(),
      token_budget: z
        .number()
        .int()
        .min(1)
        .max(MAX_TOKEN_BUDGET)
        .nullable()
        .optional(),
    })
    .superRefine((value, context) => {
      if (
        value.action === 'launch' &&
        Number(value.spec !== undefined) +
          Number(value.template_name !== undefined) !==
          1
      ) {
        context.addIssue({
          code: 'custom',
          path: ['spec'],
          message: 'launch requires exactly one of spec or template_name',
        })
      }
      if (
        value.template_arguments !== undefined &&
        value.template_name === undefined
      ) {
        context.addIssue({
          code: 'custom',
          path: ['template_arguments'],
          message: 'template_arguments requires template_name',
        })
      }
      if (value.action !== 'launch' && !value.run_id) {
        context.addIssue({
          code: 'custom',
          path: ['run_id'],
          message: `run_id is required for ${value.action}`,
        })
      }
      if (
        value.action === 'configure' &&
        value.max_concurrency === undefined &&
        value.token_budget === undefined
      ) {
        context.addIssue({
          code: 'custom',
          path: ['max_concurrency'],
          message: 'configure requires max_concurrency, token_budget, or both',
        })
      }
      if (
        value.action !== 'configure' &&
        (value.max_concurrency !== undefined ||
          value.token_budget !== undefined)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['action'],
          message:
            'max_concurrency and token_budget are only valid for configure',
        })
      }
      if (value.action !== 'launch' && value.spec !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['spec'],
          message: 'spec is only valid when launching a workflow',
        })
      }
      if (
        value.action !== 'launch' &&
        (value.template_name !== undefined ||
          value.template_arguments !== undefined)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['template_name'],
          message:
            'template_name and template_arguments are only valid when launching a workflow',
        })
      }
    }),
)
type InputSchema = ReturnType<typeof inputSchema>
export type Input = z.infer<InputSchema>

const runSummarySchema = z.object({
  run_id: z.string(),
  name: z.string(),
  status: z.string(),
  completed_steps: z.number(),
  total_steps: z.number(),
  total_tokens: z.number(),
  token_budget: z.number().nullable(),
  max_concurrency: z.number(),
  estimated_cost_usd: z.number(),
  cost_estimate_complete: z.boolean(),
  error: z.string().optional(),
})

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean(),
    message: z.string().optional(),
    run: runSummarySchema.optional(),
    task_id: z.string().optional(),
    output_file: z.string().optional(),
    workflow_file: z.string().optional(),
    template_file: z.string().optional(),
    error: z.string().optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

function summarizeRun(run: WorkflowRun): z.infer<typeof runSummarySchema> {
  return {
    run_id: run.runId,
    name: run.spec.name,
    status: run.status,
    completed_steps: Object.values(run.steps).filter(
      step => step.status === 'completed',
    ).length,
    total_steps: run.spec.steps.length,
    total_tokens: run.totalTokens,
    token_budget: run.tokenBudget,
    max_concurrency: run.concurrencyLimit,
    estimated_cost_usd: run.estimatedCostUsd,
    cost_estimate_complete: !run.hasUnknownCost,
    error: run.error,
  }
}

export const WorkflowTool = buildTool({
  name: WORKFLOW_TOOL_NAME,
  searchHint:
    'launch, inspect, configure, resume, or cancel a multi-agent workflow',
  maxResultSizeChars: 20_000,
  async description() {
    return 'Run a bounded declarative DAG of collaborating coding agents'
  },
  async prompt() {
    return `Launch a declarative multi-agent workflow only after the user explicitly requests orchestration.

Launch with either an inline spec or template_name, never both. Named templates are validated JSON/JSONC files under the project root's .recode/workflows directory. Pass template_arguments only when that template declares $ARGUMENTS; the value is substituted as text into objective and step prompts before the normal workflow validation runs.

The spec is a DAG. Each step has id, title, prompt, optional dependsOn/phase/agentType/model/outputSchema/isolation, mode (read or write), maxAttempts (1-3), and timeoutMs. The run may set tokenBudget; omit it unless the user explicitly requested a token cap. outputSchema is an optional JSON Schema with an object root; matching structured JSON is validated before the step completes and passed to dependencies. Independent read steps can run concurrently. A shared-directory write step must be dependency-ordered with every other step. A write step may set isolation to worktree; isolated writes can run concurrently with other isolated writes and their non-conflicting patches are merged back serially. Isolated writes must still be ordered with read steps.

Use action=status to inspect a run, action=cancel to stop it, and action=resume to continue a failed, budget-limited, or cancelled run from its journal. action=configure can change max_concurrency (1-6) or token_budget while preserving the journal, but only when the user explicitly requested that change. Completed steps and cumulative usage are reused on resume. Workflows run in the background and return a task ID immediately.`
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName() {
    return 'Workflow'
  },
  shouldDefer: false,
  isEnabled() {
    return true
  },
  isConcurrencySafe(input) {
    return input.action === 'status'
  },
  isReadOnly(input) {
    return input.action === 'status'
  },
  toAutoClassifierInput(input) {
    return `${input.action} ${input.run_id ?? input.template_name ?? input.spec?.name ?? ''}`.trim()
  },
  async checkPermissions(input) {
    return { behavior: 'allow' as const, updatedInput: input }
  },
  renderToolUseMessage,
  renderToolResultMessage,
  renderToolUseRejectedMessage,
  async call(input, toolUseContext, canUseTool): Promise<{ data: Output }> {
    try {
      const [service, storage, store, cwd] = await Promise.all([
        import('../../services/workflow/service.js'),
        import('../../services/workflow/storage.js'),
        import('../../services/workflow/store.js'),
        import('../../utils/cwd.js'),
      ])
      if (input.action === 'launch') {
        let spec = input.spec
        let templateFile: string | undefined
        if (input.template_name) {
          const [templates, bootstrap] = await Promise.all([
            import('../../services/workflow/templates.js'),
            import('../../bootstrap/state.js'),
          ])
          const template = await templates.resolveWorkflowTemplate(
            bootstrap.getProjectRoot(),
            input.template_name,
          )
          spec = templates.instantiateWorkflowTemplate(
            template,
            input.template_arguments,
          )
          templateFile = template.filePath
        }
        const launched = await service.launchWorkflow(spec!, {
          toolUseContext,
          canUseTool,
        })
        const run = await storage.loadWorkflowRun(cwd.getCwd(), launched.runId)
        return {
          data: {
            success: true,
            message: `Workflow launched in the background as task ${launched.taskId}.`,
            run: run ? summarizeRun(run) : undefined,
            task_id: launched.taskId,
            output_file: launched.outputFile,
            workflow_file: launched.workflowFile,
            template_file: templateFile,
          },
        }
      }

      const runId = input.run_id!
      if (input.action === 'status') {
        const run = await storage.loadWorkflowRun(cwd.getCwd(), runId)
        if (!run) {
          return {
            data: { success: false, error: `Workflow run not found: ${runId}` },
          }
        }
        store.setWorkflowRun(run)
        return { data: { success: true, run: summarizeRun(run) } }
      }
      if (input.action === 'cancel') {
        const stopped = service.stopWorkflow(runId)
        return {
          data: stopped
            ? { success: true, message: `Workflow ${runId} is stopping.` }
            : {
                success: false,
                error: `Workflow ${runId} is not active in this process.`,
              },
        }
      }

      if (input.action === 'configure') {
        const configured = await service.configureWorkflowRun(runId, {
          ...(input.max_concurrency === undefined
            ? {}
            : { maxConcurrency: input.max_concurrency }),
          ...(input.token_budget === undefined
            ? {}
            : { tokenBudget: input.token_budget }),
        })
        return {
          data: {
            success: true,
            message: `Workflow ${runId} configuration updated.`,
            run: summarizeRun(configured),
          },
        }
      }

      const resumed = await service.resumeWorkflow(runId, {
        toolUseContext,
        canUseTool,
      })
      const run = await storage.loadWorkflowRun(cwd.getCwd(), resumed.runId)
      return {
        data: {
          success: true,
          message: `Workflow resumed as task ${resumed.taskId}.`,
          run: run ? summarizeRun(run) : undefined,
          task_id: resumed.taskId,
          output_file: resumed.outputFile,
          workflow_file: resumed.workflowFile,
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
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    const content = output.error
      ? `Error: ${output.error}`
      : [output.message, output.run ? jsonStringify(output.run) : undefined]
          .filter(Boolean)
          .join('\n')
    return {
      type: 'tool_result',
      tool_use_id: toolUseID,
      content: content || 'Done',
      ...(output.error ? { is_error: true } : {}),
    }
  },
} satisfies ToolDef<InputSchema, Output>)
