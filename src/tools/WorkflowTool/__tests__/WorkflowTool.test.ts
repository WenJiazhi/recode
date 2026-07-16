import { describe, expect, test } from 'bun:test'
import { WorkflowTool } from '../WorkflowTool.js'

const validSpec = {
  version: 1 as const,
  name: 'review',
  objective: 'Review the change from independent perspectives',
  maxConcurrency: 2,
  steps: [
    {
      id: 'correctness',
      title: 'Correctness',
      prompt: 'Review correctness',
      outputSchema: {
        type: 'object',
        required: ['findings'],
        properties: { findings: { type: 'array' } },
      },
    },
    { id: 'tests', title: 'Tests', prompt: 'Review test coverage' },
  ],
}

describe('WorkflowTool', () => {
  test('accepts a bounded declarative launch specification', () => {
    const parsed = WorkflowTool.inputSchema.safeParse({
      action: 'launch',
      spec: validSpec,
    })
    expect(parsed.success).toBe(true)
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'launch',
        spec: {
          ...validSpec,
          steps: [
            {
              id: 'invalid',
              title: 'Invalid',
              prompt: 'Invalid',
              outputSchema: { type: 'array' },
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  test('accepts exactly one inline spec or named project template', () => {
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'launch',
        template_name: 'project-review',
        template_arguments: 'src/auth',
      }).success,
    ).toBe(true)
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'launch',
        spec: validSpec,
        template_name: 'project-review',
      }).success,
    ).toBe(false)
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'launch',
        template_arguments: 'src/auth',
      }).success,
    ).toBe(false)
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'status',
        run_id: '33333333-3333-4333-8333-333333333333',
        template_name: 'project-review',
      }).success,
    ).toBe(false)
  })

  test('requires the correct payload for every action', () => {
    expect(
      WorkflowTool.inputSchema.safeParse({ action: 'launch' }).success,
    ).toBe(false)
    expect(
      WorkflowTool.inputSchema.safeParse({ action: 'resume' }).success,
    ).toBe(false)
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'status',
        run_id: '33333333-3333-4333-8333-333333333333',
        unexpected: true,
      }).success,
    ).toBe(false)
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'configure',
        run_id: '33333333-3333-4333-8333-333333333333',
        max_concurrency: 2,
        spec: validSpec,
      }).success,
    ).toBe(false)
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'configure',
        run_id: '33333333-3333-4333-8333-333333333333',
      }).success,
    ).toBe(false)
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'configure',
        run_id: '33333333-3333-4333-8333-333333333333',
        max_concurrency: 4,
        token_budget: null,
      }).success,
    ).toBe(true)
    expect(
      WorkflowTool.inputSchema.safeParse({
        action: 'status',
        run_id: '33333333-3333-4333-8333-333333333333',
        max_concurrency: 4,
      }).success,
    ).toBe(false)
  })

  test('only status reads are concurrency safe', () => {
    expect(
      WorkflowTool.isConcurrencySafe({
        action: 'status',
        run_id: '33333333-3333-4333-8333-333333333333',
      }),
    ).toBe(true)
    expect(
      WorkflowTool.isConcurrencySafe({ action: 'launch', spec: validSpec }),
    ).toBe(false)
  })

  test('renders Ink nodes for results and rejections', () => {
    expect(
      WorkflowTool.renderToolResultMessage({
        success: true,
        message: 'Workflow launched.',
      }),
    ).toBeObject()
    expect(WorkflowTool.renderToolUseRejectedMessage()).toBeObject()
  })
})
