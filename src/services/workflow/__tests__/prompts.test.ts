import { expect, test } from 'bun:test'
import { createWorkflowRun } from '../engine.js'
import { buildWorkflowStepPrompt, ORCHESTRATE_PROMPT } from '../prompts.js'
import { validateWorkflowSpec } from '../validation.js'

test('workflow prompt marks structured dependencies and requires the output tool', () => {
  const spec = validateWorkflowSpec({
    version: 1,
    name: 'structured-prompt',
    objective: 'Synthesize verified findings',
    steps: [
      { id: 'inspect', title: 'Inspect', prompt: 'Inspect' },
      {
        id: 'synthesize',
        title: 'Synthesize',
        prompt: 'Synthesize',
        dependsOn: ['inspect'],
        outputSchema: {
          type: 'object',
          required: ['summary'],
          properties: { summary: { type: 'string' } },
        },
      },
    ],
  })
  const run = createWorkflowRun({
    spec,
    sessionId: 'session',
    projectRoot: '/project',
    runId: '77777777-7777-4777-8777-777777777777',
  })

  const prompt = buildWorkflowStepPrompt(run, spec.steps[1]!, {
    inspect: {
      output: '{"files":2}',
      structuredOutput: { files: 2 },
    },
  })

  expect(prompt).toContain('format="structured-json"')
  expect(prompt).toContain('StructuredOutput exactly once')
  expect(prompt).toContain('"required":["summary"]')
})

test('workflow prompts expose isolated writes without weakening shared writes', () => {
  const spec = validateWorkflowSpec({
    version: 1,
    name: 'isolated-prompts',
    objective: 'Apply independent changes',
    steps: [
      {
        id: 'shared',
        title: 'Shared',
        prompt: 'Write in place',
        mode: 'write',
      },
      {
        id: 'isolated',
        title: 'Isolated',
        prompt: 'Write independently',
        mode: 'write',
        isolation: 'worktree',
        dependsOn: ['shared'],
      },
    ],
  })
  const run = createWorkflowRun({
    spec,
    sessionId: 'session',
    projectRoot: '/project',
    runId: '77777777-7777-4777-8777-777777777777',
  })

  expect(buildWorkflowStepPrompt(run, spec.steps[0]!, {})).toContain(
    'only active shared-directory write step',
  )
  expect(buildWorkflowStepPrompt(run, spec.steps[1]!, {})).toContain(
    'isolated Git worktree',
  )
  expect(ORCHESTRATE_PROMPT).toContain('isolation="worktree"')
  expect(ORCHESTRATE_PROMPT).toContain('Omit tokenBudget')
})
