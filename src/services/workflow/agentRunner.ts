import type { CanUseToolFn } from '../../hooks/useCanUseTool.js'
import { toolMatchesName, type ToolUseContext, type Tools } from '../../Tool.js'
import type { Message } from '../../types/message.js'
import { extractTextContent, createUserMessage } from '../../utils/messages.js'
import { getAgentModel } from '../../utils/model/agent.js'
import type { ModelAlias } from '../../utils/model/aliases.js'
import { createAgentId } from '../../utils/uuid.js'
import type { AgentDefinition } from '../../tools/AgentTool/loadAgentsDir.js'
import type {
  WorkflowRun,
  WorkflowStep,
  WorkflowStepExecutionResult,
} from './types.js'
import { buildWorkflowStepPrompt } from './prompts.js'
import {
  createSyntheticOutputTool,
  SYNTHETIC_OUTPUT_TOOL_NAME,
} from '../../tools/SyntheticOutputTool/SyntheticOutputTool.js'
import { registerStructuredOutputEnforcement } from '../../utils/hooks/hookHelpers.js'
import { clearSessionHooks } from '../../utils/hooks/sessionHooks.js'
import type { WorkflowDependencyResult } from './types.js'
import {
  MAX_WORKFLOW_STEP_OUTPUT_CHARS,
  type WorkflowStructuredOutput,
} from './structuredOutput.js'
import { runWithCwdOverride } from '../../utils/cwd.js'
import { WorkflowStepExecutionError } from './errors.js'
import { summarizeWorkflowUsage } from './usage.js'

const READ_ONLY_TOOLS = new Set([
  'Read',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'LSP',
  'ListMcpResourcesTool',
  'ReadMcpResourceTool',
])
const WORKER_BLOCKED_TOOLS = new Set([
  'Agent',
  'Goal',
  'Workflow',
  'TeamCreate',
  'TeamDelete',
  'SendMessage',
])

const WORKFLOW_WORKER: AgentDefinition = {
  agentType: 'workflow-worker',
  whenToUse: 'A deterministic workflow step needs an isolated worker context',
  tools: ['*'],
  source: 'built-in',
  baseDir: 'built-in',
  getSystemPrompt: () =>
    'You are a workflow worker. Complete exactly one declared step, respect its read/write boundary, and return evidence-rich output for downstream steps.',
}

function resolveAgentDefinition(
  step: WorkflowStep,
  context: ToolUseContext,
): AgentDefinition {
  if (!step.agentType) return WORKFLOW_WORKER
  const normalized = step.agentType.toLowerCase()
  const found = context.options.agentDefinitions.activeAgents.find(
    agent => agent.agentType.toLowerCase() === normalized,
  )
  if (!found) {
    throw new Error(`Unknown workflow agent type: ${step.agentType}`)
  }
  // Workflow workers use the host's tool and permission boundary. Agent-local
  // hooks, MCP servers, and permission overrides could otherwise execute
  // outside the declared read/write step contract.
  return {
    ...found,
    hooks: undefined,
    mcpServers: undefined,
    permissionMode: undefined,
  }
}

function toolsForStep(
  step: WorkflowStep,
  tools: Tools,
  structuredOutputTool?: Tools[number],
): Tools {
  const filtered = tools.filter(tool => {
    if (WORKER_BLOCKED_TOOLS.has(tool.name)) return false
    if (toolMatchesName(tool, SYNTHETIC_OUTPUT_TOOL_NAME)) return false
    return step.mode === 'write' || READ_ONLY_TOOLS.has(tool.name)
  })
  return structuredOutputTool ? [...filtered, structuredOutputTool] : filtered
}

export type WorkflowAgentRunnerContext = {
  toolUseContext: ToolUseContext
  canUseTool: CanUseToolFn
}

type WorkflowAgentStepInput = {
  run: WorkflowRun
  step: WorkflowStep
  dependencyResults: Record<string, WorkflowDependencyResult>
  signal: AbortSignal
  host: WorkflowAgentRunnerContext
  workingDirectory?: string
  worktreePath?: string
}

async function runWorkflowAgentStepInCurrentDirectory(
  input: WorkflowAgentStepInput,
): Promise<WorkflowStepExecutionResult> {
  const { run, step, dependencyResults, signal, host } = input
  const [
    { runAgent },
    { countToolUses, finalizeAgentTool },
    { isBuiltInAgent },
  ] = await Promise.all([
    import('../../tools/AgentTool/runAgent.js'),
    import('../../tools/AgentTool/agentToolUtils.js'),
    import('../../tools/AgentTool/loadAgentsDir.js'),
  ])

  const agentDefinition = resolveAgentDefinition(step, host.toolUseContext)
  const appState = host.toolUseContext.getAppState()
  const resolvedModel = getAgentModel(
    agentDefinition.model,
    host.toolUseContext.options.mainLoopModel,
    step.model as ModelAlias | undefined,
    appState.toolPermissionContext.mode,
  )
  const agentId = createAgentId()
  const abortController = new AbortController()
  const onAbort = (): void => abortController.abort()
  if (signal.aborted) abortController.abort()
  else signal.addEventListener('abort', onAbort, { once: true })

  const messages: Message[] = []
  const prompt = buildWorkflowStepPrompt(run, step, dependencyResults)
  const startTime = Date.now()
  let structuredOutput: WorkflowStructuredOutput | undefined
  let structuredOutputCount = 0
  let structuredOutputTool: Tools[number] | undefined
  let structuredOutputEnforcementRegistered = false
  try {
    if (step.outputSchema) {
      const created = createSyntheticOutputTool(step.outputSchema)
      if ('error' in created) {
        throw new Error(`Invalid workflow output schema: ${created.error}`)
      }
      structuredOutputTool = created.tool
      registerStructuredOutputEnforcement(
        host.toolUseContext.setAppState,
        agentId,
      )
      structuredOutputEnforcementRegistered = true
    }
    try {
      for await (const message of runAgent({
        agentDefinition,
        promptMessages: [createUserMessage({ content: prompt })],
        toolUseContext: host.toolUseContext,
        canUseTool: host.canUseTool,
        isAsync: true,
        canShowPermissionPrompts: false,
        querySource: 'workflow',
        override: { agentId, abortController },
        model: step.model as ModelAlias | undefined,
        availableTools: toolsForStep(
          step,
          host.toolUseContext.options.tools,
          structuredOutputTool,
        ),
        description: step.title,
        transcriptSubdir: `workflows/${run.runId}`,
        worktreePath: input.worktreePath,
      })) {
        if (
          message.type === 'attachment' &&
          message.attachment.type === 'structured_output'
        ) {
          structuredOutputCount += 1
          structuredOutput = message.attachment.data as WorkflowStructuredOutput
        } else {
          messages.push(message)
        }
      }
    } catch (error) {
      const usage = summarizeWorkflowUsage(messages, resolvedModel)
      if (
        usage.tokens > 0 ||
        countToolUses(messages) > 0 ||
        messages.some(message => message.type === 'assistant')
      ) {
        throw new WorkflowStepExecutionError(error, {
          ...usage,
          toolUses: countToolUses(messages),
        })
      }
      throw error
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
    if (structuredOutputEnforcementRegistered) {
      clearSessionHooks(host.toolUseContext.setAppState, agentId)
    }
  }

  const usage = summarizeWorkflowUsage(messages, resolvedModel)
  const toolUses = countToolUses(messages)
  const metrics = {
    ...usage,
    toolUses,
  }
  let finalized
  try {
    finalized = finalizeAgentTool(messages, agentId, {
      prompt: step.prompt,
      resolvedAgentModel: resolvedModel,
      isBuiltInAgent: isBuiltInAgent(agentDefinition),
      startTime,
      agentType: agentDefinition.agentType,
      isAsync: true,
    })
  } catch (error) {
    if (
      metrics.tokens > 0 ||
      metrics.toolUses > 0 ||
      messages.some(message => message.type === 'assistant')
    ) {
      throw new WorkflowStepExecutionError(error, metrics)
    }
    throw error
  }
  metrics.toolUses = finalized.totalToolUseCount
  if (step.outputSchema) {
    if (structuredOutputCount !== 1 || structuredOutput === undefined) {
      throw new WorkflowStepExecutionError(
        new Error(
          `Workflow agent must return exactly one StructuredOutput value; received ${structuredOutputCount}`,
        ),
        metrics,
      )
    }
    return {
      output: JSON.stringify(structuredOutput),
      structuredOutput,
      ...metrics,
    }
  }

  const output = extractTextContent(finalized.content, '\n')
  if (!output.trim()) {
    throw new WorkflowStepExecutionError(
      new Error('Workflow agent returned no text output'),
      metrics,
    )
  }
  const normalizedOutput =
    output.length <= MAX_WORKFLOW_STEP_OUTPUT_CHARS
      ? output
      : `${output.slice(0, MAX_WORKFLOW_STEP_OUTPUT_CHARS)}\n[workflow step output truncated]`
  return {
    output: normalizedOutput,
    ...metrics,
  }
}

export function runWorkflowAgentStep(
  input: WorkflowAgentStepInput,
): Promise<WorkflowStepExecutionResult> {
  return input.workingDirectory
    ? runWithCwdOverride(input.workingDirectory, () =>
        runWorkflowAgentStepInCurrentDirectory(input),
      )
    : runWorkflowAgentStepInCurrentDirectory(input)
}
