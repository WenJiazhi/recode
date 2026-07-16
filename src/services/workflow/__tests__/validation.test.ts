import { describe, expect, test } from 'bun:test'
import { validateWorkflowSpec, WorkflowValidationError } from '../validation.js'

function spec(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    name: 'review',
    objective: 'Review the repository and apply verified fixes',
    maxConcurrency: 3,
    steps: [
      { id: 'bugs', title: 'Find bugs', prompt: 'Inspect correctness' },
      { id: 'tests', title: 'Inspect tests', prompt: 'Inspect test gaps' },
      {
        id: 'apply',
        title: 'Apply fixes',
        prompt: 'Use the verified findings',
        mode: 'write',
        dependsOn: ['bugs', 'tests'],
      },
    ],
    ...overrides,
  }
}

describe('workflow specification validation', () => {
  test('normalizes defaults for a safe read fan-out and ordered write step', () => {
    const parsed = validateWorkflowSpec(spec())

    expect(parsed.maxConcurrency).toBe(3)
    expect(parsed.tokenBudget).toBeNull()
    expect(parsed.steps[0]).toMatchObject({
      mode: 'read',
      dependsOn: [],
      maxAttempts: 1,
      timeoutMs: 600_000,
    })
  })

  test('accepts only bounded run token budgets', () => {
    expect(
      validateWorkflowSpec(spec({ tokenBudget: 80_000 })).tokenBudget,
    ).toBe(80_000)
    for (const tokenBudget of [0, -1, 1.5, 100_000_001]) {
      expect(() => validateWorkflowSpec(spec({ tokenBudget }))).toThrow()
    }
  })

  test('rejects unknown dependencies and duplicate ids', () => {
    expect(() =>
      validateWorkflowSpec(
        spec({
          steps: [
            { id: 'a', title: 'A', prompt: 'A', dependsOn: ['b'] },
            { id: 'a', title: 'Again', prompt: 'Again' },
            { id: 'b', title: 'B', prompt: 'B', dependsOn: ['a', 'missing'] },
          ],
        }),
      ),
    ).toThrow(WorkflowValidationError)

    try {
      validateWorkflowSpec(
        spec({
          steps: [
            { id: 'a', title: 'A', prompt: 'A', dependsOn: ['b'] },
            { id: 'a', title: 'Again', prompt: 'Again' },
            { id: 'b', title: 'B', prompt: 'B', dependsOn: ['a', 'missing'] },
          ],
        }),
      )
    } catch (error) {
      expect(String(error)).toContain('Duplicate workflow step id: a')
      expect(String(error)).toContain('depends on unknown step missing')
    }
  })

  test('rejects dependency cycles', () => {
    expect(() =>
      validateWorkflowSpec(
        spec({
          steps: [
            { id: 'a', title: 'A', prompt: 'A', dependsOn: ['b'] },
            { id: 'b', title: 'B', prompt: 'B', dependsOn: ['a'] },
          ],
        }),
      ),
    ).toThrow('dependency cycle')
  })

  test('rejects every write step that could overlap another step', () => {
    expect(() =>
      validateWorkflowSpec(
        spec({
          steps: [
            { id: 'read', title: 'Read', prompt: 'Read' },
            { id: 'write', title: 'Write', prompt: 'Write', mode: 'write' },
          ],
        }),
      ),
    ).toThrow('Write step write is unordered with read')
  })

  test('allows unordered writes only when the whole workflow is serial', () => {
    const parsed = validateWorkflowSpec(
      spec({
        maxConcurrency: 1,
        steps: [
          { id: 'write_a', title: 'Write A', prompt: 'Write A', mode: 'write' },
          { id: 'write_b', title: 'Write B', prompt: 'Write B', mode: 'write' },
        ],
      }),
    )
    expect(parsed.steps).toHaveLength(2)
  })

  test('allows parallel isolated writes but keeps shared writes ordered', () => {
    const parsed = validateWorkflowSpec(
      spec({
        maxConcurrency: 2,
        steps: [
          {
            id: 'write_a',
            title: 'Write A',
            prompt: 'Write A',
            mode: 'write',
            isolation: 'worktree',
          },
          {
            id: 'write_b',
            title: 'Write B',
            prompt: 'Write B',
            mode: 'write',
            isolation: 'worktree',
          },
        ],
      }),
    )
    expect(parsed.steps.every(step => step.isolation === 'worktree')).toBe(true)

    expect(() =>
      validateWorkflowSpec(
        spec({
          maxConcurrency: 2,
          steps: [
            {
              id: 'isolated',
              title: 'Isolated',
              prompt: 'Isolated',
              mode: 'write',
              isolation: 'worktree',
            },
            {
              id: 'shared',
              title: 'Shared',
              prompt: 'Shared',
              mode: 'write',
            },
          ],
        }),
      ),
    ).toThrow('Write step shared is unordered with isolated')

    expect(() =>
      validateWorkflowSpec(
        spec({
          maxConcurrency: 2,
          steps: [
            {
              id: 'isolated',
              title: 'Isolated',
              prompt: 'Isolated',
              mode: 'write',
              isolation: 'worktree',
            },
            { id: 'read', title: 'Read', prompt: 'Read' },
          ],
        }),
      ),
    ).toThrow('Write step isolated is unordered with read')
  })

  test('rejects worktree isolation on read-only steps', () => {
    expect(() =>
      validateWorkflowSpec(
        spec({
          steps: [
            {
              id: 'read',
              title: 'Read',
              prompt: 'Read',
              isolation: 'worktree',
            },
          ],
        }),
      ),
    ).toThrow('worktree isolation is only supported for write steps')
  })

  test('accepts bounded object output schemas and rejects invalid definitions', () => {
    const parsed = validateWorkflowSpec(
      spec({
        steps: [
          {
            id: 'review',
            title: 'Review',
            prompt: 'Return findings',
            outputSchema: {
              type: 'object',
              required: ['findings'],
              properties: { findings: { type: 'array' } },
            },
          },
        ],
      }),
    )
    expect(parsed.steps[0]?.outputSchema).toMatchObject({ type: 'object' })

    expect(() =>
      validateWorkflowSpec(
        spec({
          steps: [
            {
              id: 'review',
              title: 'Review',
              prompt: 'Return findings',
              outputSchema: { type: 'array' },
            },
          ],
        }),
      ),
    ).toThrow('steps.0.outputSchema: schema root type must be object')
  })
})
