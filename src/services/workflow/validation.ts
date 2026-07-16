import { z } from 'zod/v4'
import { MAX_TOKEN_BUDGET } from '../../utils/tokenBudget.js'
import type { WorkflowSpec, WorkflowStep } from './types.js'
import { validateWorkflowOutputSchemaDefinition } from './structuredOutput.js'

const MAX_WORKFLOW_STEPS = 24
export const MAX_WORKFLOW_CONCURRENCY = 6
const DEFAULT_WORKFLOW_CONCURRENCY = 3
const MAX_WORKFLOW_PROMPT_CHARS = 12_000
const MAX_WORKFLOW_TOTAL_PROMPT_CHARS = 80_000

const stepIdSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z][a-z0-9_-]*$/)

const stepSchema = z
  .strictObject({
    id: stepIdSchema,
    title: z.string().trim().min(1).max(120),
    prompt: z.string().trim().min(1).max(MAX_WORKFLOW_PROMPT_CHARS),
    dependsOn: z.array(stepIdSchema).max(MAX_WORKFLOW_STEPS).default([]),
    phase: z.string().trim().min(1).max(80).optional(),
    mode: z.enum(['read', 'write']).default('read'),
    isolation: z.literal('worktree').optional(),
    agentType: z.string().trim().min(1).max(80).optional(),
    model: z.string().trim().min(1).max(120).optional(),
    maxAttempts: z.number().int().min(1).max(3).default(1),
    timeoutMs: z
      .number()
      .int()
      .min(10_000)
      .max(60 * 60 * 1000)
      .default(10 * 60 * 1000),
    outputSchema: z
      .record(z.string(), z.unknown())
      .describe(
        'Optional JSON Schema with an object root. The step must return one matching StructuredOutput value.',
      )
      .optional(),
  })
  .superRefine((step, context) => {
    if (step.isolation === 'worktree' && step.mode !== 'write') {
      context.addIssue({
        code: 'custom',
        path: ['isolation'],
        message: 'worktree isolation is only supported for write steps',
      })
    }
    if (!step.outputSchema) return
    for (const issue of validateWorkflowOutputSchemaDefinition(
      step.outputSchema,
    )) {
      context.addIssue({
        code: 'custom',
        path: ['outputSchema'],
        message: issue,
      })
    }
  })

export const workflowSpecSchema = z.strictObject({
  version: z.literal(1).default(1),
  name: z.string().trim().min(1).max(80),
  objective: z.string().trim().min(1).max(4_000),
  maxConcurrency: z
    .number()
    .int()
    .min(1)
    .max(MAX_WORKFLOW_CONCURRENCY)
    .default(DEFAULT_WORKFLOW_CONCURRENCY),
  tokenBudget: z
    .number()
    .int()
    .min(1)
    .max(MAX_TOKEN_BUDGET)
    .nullable()
    .default(null),
  steps: z.array(stepSchema).min(1).max(MAX_WORKFLOW_STEPS),
})

export class WorkflowValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(issues.join('\n'))
    this.name = 'WorkflowValidationError'
  }
}

function buildDependencyMap(steps: WorkflowStep[]): Map<string, string[]> {
  return new Map(steps.map(step => [step.id, step.dependsOn]))
}

function reaches(
  from: string,
  target: string,
  dependencies: Map<string, string[]>,
  seen = new Set<string>(),
): boolean {
  if (from === target) return true
  if (seen.has(from)) return false
  seen.add(from)
  for (const dependency of dependencies.get(from) ?? []) {
    if (reaches(dependency, target, dependencies, seen)) return true
  }
  return false
}

function graphIssues(spec: WorkflowSpec): string[] {
  const issues: string[] = []
  const ids = new Set<string>()
  for (const step of spec.steps) {
    if (ids.has(step.id)) issues.push(`Duplicate workflow step id: ${step.id}`)
    ids.add(step.id)
  }

  for (const step of spec.steps) {
    const uniqueDependencies = new Set(step.dependsOn)
    if (uniqueDependencies.size !== step.dependsOn.length) {
      issues.push(`Step ${step.id} contains duplicate dependencies`)
    }
    for (const dependency of step.dependsOn) {
      if (dependency === step.id) {
        issues.push(`Step ${step.id} cannot depend on itself`)
      } else if (!ids.has(dependency)) {
        issues.push(`Step ${step.id} depends on unknown step ${dependency}`)
      }
    }
  }

  const dependencies = buildDependencyMap(spec.steps)
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      issues.push(`Workflow dependency cycle includes step ${id}`)
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of dependencies.get(id) ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const step of spec.steps) visit(step.id)

  if (spec.maxConcurrency > 1 && issues.length === 0) {
    for (const writeStep of spec.steps.filter(step => step.mode === 'write')) {
      for (const other of spec.steps) {
        if (other.id === writeStep.id) continue
        if (
          writeStep.isolation === 'worktree' &&
          other.mode === 'write' &&
          other.isolation === 'worktree'
        ) {
          continue
        }
        const ordered =
          reaches(writeStep.id, other.id, dependencies) ||
          reaches(other.id, writeStep.id, dependencies)
        if (!ordered) {
          issues.push(
            `Write step ${writeStep.id} is unordered with ${other.id}; add a dependency or set maxConcurrency to 1`,
          )
        }
      }
    }
  }

  return [...new Set(issues)]
}

export function validateWorkflowSpec(value: unknown): WorkflowSpec {
  const parsed = workflowSpecSchema.safeParse(value)
  if (!parsed.success) {
    throw new WorkflowValidationError(
      parsed.error.issues.map(issue => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
        return `${path}${issue.message}`
      }),
    )
  }

  const spec = parsed.data as WorkflowSpec
  const totalPromptChars = spec.steps.reduce(
    (total, step) => total + step.prompt.length,
    0,
  )
  const issues = graphIssues(spec)
  if (totalPromptChars > MAX_WORKFLOW_TOTAL_PROMPT_CHARS) {
    issues.push(
      `Workflow step prompts exceed ${MAX_WORKFLOW_TOTAL_PROMPT_CHARS} total characters`,
    )
  }
  if (issues.length > 0) throw new WorkflowValidationError(issues)
  return spec
}
