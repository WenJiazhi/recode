import { Ajv, type AsyncValidateFunction, type ValidateFunction } from 'ajv'

export const MAX_WORKFLOW_OUTPUT_SCHEMA_CHARS = 20_000
export const MAX_WORKFLOW_OUTPUT_SCHEMA_DEPTH = 16
export const MAX_WORKFLOW_OUTPUT_SCHEMA_NODES = 512
export const MAX_WORKFLOW_STEP_OUTPUT_CHARS = 100_000

export type WorkflowStructuredOutput = Record<string, unknown>

type InspectionState = {
  issues: string[]
  nodes: number
  seen: WeakSet<object>
}

type StructuredOutputValidation =
  | {
      success: true
      output: string
      value: WorkflowStructuredOutput
    }
  | { success: false; issues: string[] }

const definitionCache = new WeakMap<object, readonly string[]>()
const validatorCache = new WeakMap<object, ValidateFunction>()

function isAsyncValidator(
  validator: ValidateFunction,
): validator is AsyncValidateFunction {
  return '$async' in validator && validator.$async === true
}

function inspectSchemaValue(
  value: unknown,
  path: string,
  depth: number,
  state: InspectionState,
): void {
  if (state.issues.length >= 20) return
  state.nodes += 1
  if (state.nodes > MAX_WORKFLOW_OUTPUT_SCHEMA_NODES) {
    state.issues.push(
      `schema exceeds ${MAX_WORKFLOW_OUTPUT_SCHEMA_NODES} JSON nodes`,
    )
    return
  }
  if (depth > MAX_WORKFLOW_OUTPUT_SCHEMA_DEPTH) {
    state.issues.push(
      `${path} exceeds maximum depth ${MAX_WORKFLOW_OUTPUT_SCHEMA_DEPTH}`,
    )
    return
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) state.issues.push(`${path} must be finite`)
    return
  }
  if (typeof value !== 'object') {
    state.issues.push(`${path} is not JSON-serializable`)
    return
  }
  if (state.seen.has(value)) {
    state.issues.push(`${path} contains a circular reference`)
    return
  }
  state.seen.add(value)

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      inspectSchemaValue(item, `${path}[${index}]`, depth + 1, state)
    }
    return
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    state.issues.push(`${path} must contain only plain JSON objects`)
    return
  }
  for (const [key, item] of Object.entries(value)) {
    if (
      key === '$ref' &&
      typeof item === 'string' &&
      item !== '#' &&
      !item.startsWith('#/')
    ) {
      state.issues.push(`${path}.$ref must be a local JSON Pointer`)
    }
    inspectSchemaValue(item, `${path}.${key}`, depth + 1, state)
  }
}

function compileSchema(
  schema: WorkflowStructuredOutput,
  issues: string[],
): ValidateFunction | null {
  try {
    // Match SyntheticOutputTool's strict compilation contract so a schema
    // accepted at launch cannot fail later when the worker tool is created.
    const ajv = new Ajv({ allErrors: true, logger: false })
    if (!ajv.validateSchema(schema)) {
      issues.push(
        ...(ajv.errors ?? []).map(
          error =>
            `${error.instancePath || 'schema'}: ${error.message ?? 'invalid schema'}`,
        ),
      )
      return null
    }
    const validator = ajv.compile(schema)
    if (isAsyncValidator(validator)) {
      issues.push('asynchronous output schemas are not supported')
      return null
    }
    return validator
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error))
    return null
  }
}

export function validateWorkflowOutputSchemaDefinition(
  schema: WorkflowStructuredOutput,
): string[] {
  const cached = definitionCache.get(schema)
  if (cached) return [...cached]

  const state: InspectionState = {
    issues: [],
    nodes: 0,
    seen: new WeakSet(),
  }
  inspectSchemaValue(schema, 'schema', 0, state)
  if (schema.type !== 'object') {
    state.issues.push('schema root type must be object')
  }

  if (state.issues.length === 0) {
    const serialized = JSON.stringify(schema)
    if (serialized.length > MAX_WORKFLOW_OUTPUT_SCHEMA_CHARS) {
      state.issues.push(
        `schema exceeds ${MAX_WORKFLOW_OUTPUT_SCHEMA_CHARS} characters`,
      )
    }
  }

  if (state.issues.length === 0) {
    const validator = compileSchema(schema, state.issues)
    if (validator) validatorCache.set(schema, validator)
  }

  const issues = [...new Set(state.issues)]
  definitionCache.set(schema, issues)
  return [...issues]
}

function validatorFor(
  schema: WorkflowStructuredOutput,
): ValidateFunction | null {
  const cached = validatorCache.get(schema)
  if (cached) return cached
  const issues = validateWorkflowOutputSchemaDefinition(schema)
  if (issues.length > 0) return null
  return validatorCache.get(schema) ?? null
}

export function validateWorkflowStructuredOutput(
  schema: WorkflowStructuredOutput,
  value: unknown,
): StructuredOutputValidation {
  const definitionIssues = validateWorkflowOutputSchemaDefinition(schema)
  if (definitionIssues.length > 0) {
    return {
      success: false,
      issues: definitionIssues.map(issue => `invalid output schema: ${issue}`),
    }
  }

  let compact: string
  let normalized: unknown
  try {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
      return { success: false, issues: ['output is not JSON-serializable'] }
    }
    compact = serialized
    normalized = JSON.parse(serialized)
  } catch {
    return { success: false, issues: ['output is not JSON-serializable'] }
  }

  if (compact.length > MAX_WORKFLOW_STEP_OUTPUT_CHARS) {
    return {
      success: false,
      issues: [`output exceeds ${MAX_WORKFLOW_STEP_OUTPUT_CHARS} characters`],
    }
  }

  const validator = validatorFor(schema)
  if (!validator) {
    return { success: false, issues: ['output schema could not be compiled'] }
  }
  let valid: boolean
  try {
    valid = validator(normalized) as boolean
  } catch (error) {
    return {
      success: false,
      issues: [
        `output validation failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
  if (!valid) {
    return {
      success: false,
      issues: (validator.errors ?? []).map(
        error =>
          `${error.instancePath || 'root'}: ${error.message ?? 'validation error'}`,
      ),
    }
  }

  return {
    success: true,
    output: compact,
    value: normalized as WorkflowStructuredOutput,
  }
}
