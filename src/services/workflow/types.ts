import type { WorkflowStructuredOutput } from './structuredOutput.js'

export const WORKFLOW_SCHEMA_VERSION = 4

type WorkflowStepMode = 'read' | 'write'
type WorkflowStepIsolation = 'worktree'
type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'budget_limited'
  | 'cancelled'
type WorkflowStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled'

export type WorkflowStep = {
  id: string
  title: string
  prompt: string
  dependsOn: string[]
  phase?: string
  mode: WorkflowStepMode
  isolation?: WorkflowStepIsolation
  agentType?: string
  model?: string
  maxAttempts: number
  timeoutMs: number
  outputSchema?: WorkflowStructuredOutput
}

export type WorkflowStepWorktree = {
  slug: string
  path: string
  branch: string
  sourceHead: string
  inputTree: string
  outputTree?: string
  status: 'active' | 'merging' | 'merged' | 'cleaned' | 'retained'
  attempt: number
  resumeCount: number
  createdAt: number
  completedAt?: number
  error?: string
  result?: WorkflowStepExecutionResult
}

export type WorkflowSpec = {
  version: 1
  name: string
  objective: string
  maxConcurrency: number
  tokenBudget: number | null
  steps: WorkflowStep[]
}

export type WorkflowTokenUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export type WorkflowStepState = {
  id: string
  status: WorkflowStepStatus
  attempts: number
  startedAt?: number
  completedAt?: number
  output?: string
  structuredOutput?: WorkflowStructuredOutput
  worktrees?: WorkflowStepWorktree[]
  usage?: WorkflowTokenUsage
  models?: string[]
  estimatedCostUsd?: number
  hasUnknownCost?: boolean
  error?: string
  tokens: number
  toolUses: number
}

export type WorkflowRun = {
  schemaVersion: 4
  runId: string
  sessionId: string
  projectRoot: string
  spec: WorkflowSpec
  status: WorkflowRunStatus
  createdAt: number
  updatedAt: number
  completedAt?: number
  resumeCount: number
  concurrencyLimit: number
  tokenBudget: number | null
  totalTokens: number
  totalToolUses: number
  estimatedCostUsd: number
  hasUnknownCost: boolean
  error?: string
  steps: Record<string, WorkflowStepState>
}

export type WorkflowAttemptMetrics = {
  tokens: number
  toolUses: number
  usage?: WorkflowTokenUsage
  model?: string
  estimatedCostUsd?: number
  hasUnknownCost?: boolean
}

export type WorkflowStepExecutionResult = WorkflowAttemptMetrics & {
  output: string
  structuredOutput?: WorkflowStructuredOutput
}

export type WorkflowDependencyResult = {
  output: string
  structuredOutput?: WorkflowStructuredOutput
}

export type WorkflowEngineEvent =
  | {
      type: 'run_updated'
      status: WorkflowRunStatus
      updatedAt: number
      completedAt?: number
      resumeCount: number
      totalTokens: number
      totalToolUses: number
      estimatedCostUsd: number
      hasUnknownCost: boolean
      error?: string
    }
  | {
      type: 'run_configured'
      updatedAt: number
      concurrencyLimit: number
      tokenBudget: number | null
    }
  | { type: 'step_updated'; step: WorkflowStepState }

export type WorkflowJournalEvent =
  | { type: 'run_created'; timestamp: string; run: WorkflowRun }
  | ({ timestamp: string } & WorkflowEngineEvent)
