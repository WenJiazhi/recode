import { describe, expect, test } from 'bun:test'
import {
  MAX_WORKFLOW_OUTPUT_SCHEMA_CHARS,
  validateWorkflowOutputSchemaDefinition,
  validateWorkflowStructuredOutput,
} from '../structuredOutput.js'

const findingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['path', 'severity'],
  properties: {
    path: { type: 'string' },
    severity: { type: 'string', enum: ['low', 'high'] },
  },
}

describe('workflow structured output', () => {
  test('validates and normalizes a JSON object', () => {
    const result = validateWorkflowStructuredOutput(findingSchema, {
      severity: 'high',
      path: 'src/index.ts',
    })

    expect(result).toEqual({
      success: true,
      output: '{"severity":"high","path":"src/index.ts"}',
      value: { severity: 'high', path: 'src/index.ts' },
    })
  })

  test('reports required, enum, and additional-property failures', () => {
    const result = validateWorkflowStructuredOutput(findingSchema, {
      severity: 'urgent',
      extra: true,
    })

    expect(result.success).toBe(false)
    if ('issues' in result) {
      expect(result.issues.join('\n')).toContain('required property')
      expect(result.issues.join('\n')).toContain('must be equal to one')
      expect(result.issues.join('\n')).toContain('additional properties')
    }
  })

  test('rejects schemas that cannot be safely compiled locally', () => {
    expect(validateWorkflowOutputSchemaDefinition({ type: 'array' })).toContain(
      'schema root type must be object',
    )
    expect(
      validateWorkflowOutputSchemaDefinition({
        type: 'object',
        properties: { result: { $ref: 'https://example.com/schema.json' } },
      }).join('\n'),
    ).toContain('$ref must be a local JSON Pointer')
    expect(
      validateWorkflowOutputSchemaDefinition({
        type: 'object',
        properties: { result: { type: 'string', unsupportedKeyword: true } },
      }).join('\n'),
    ).toContain('unknown keyword')
    expect(
      validateWorkflowOutputSchemaDefinition({
        $async: true,
        type: 'object',
      }).join('\n'),
    ).toContain('asynchronous output schemas are not supported')
    expect(
      validateWorkflowOutputSchemaDefinition({
        type: 'object',
        description: 'x'.repeat(MAX_WORKFLOW_OUTPUT_SCHEMA_CHARS),
      }).join('\n'),
    ).toContain('schema exceeds')
  })

  test('rejects cyclic non-JSON values before Ajv compilation', () => {
    const schema: Record<string, unknown> = { type: 'object' }
    schema.self = schema
    expect(validateWorkflowOutputSchemaDefinition(schema).join('\n')).toContain(
      'circular reference',
    )

    const value: Record<string, unknown> = {}
    value.self = value
    const result = validateWorkflowStructuredOutput({ type: 'object' }, value)
    expect(result).toEqual({
      success: false,
      issues: ['output is not JSON-serializable'],
    })
  })
})
