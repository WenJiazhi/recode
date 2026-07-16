import { lstat, readdir, readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import {
  parse as parseJsonc,
  type ParseError,
  printParseErrorCode,
} from 'jsonc-parser/lib/esm/main.js'
import { z } from 'zod/v4'
import { stripBOM } from '../../utils/jsonRead.js'
import type { WorkflowSpec } from './types.js'
import { validateWorkflowSpec } from './validation.js'

export const WORKFLOW_TEMPLATES_RELATIVE_DIR = join('.recode', 'workflows')
export const WORKFLOW_TEMPLATE_ARGUMENT_TOKEN = '$ARGUMENTS'
export const MAX_WORKFLOW_TEMPLATES = 64
export const MAX_WORKFLOW_TEMPLATE_FILE_BYTES = 256 * 1024
export const MAX_WORKFLOW_TEMPLATE_ARGUMENT_CHARS = 12_000

const WORKFLOW_TEMPLATE_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,47}$/

export const workflowTemplateNameSchema = z
  .string()
  .trim()
  .regex(
    WORKFLOW_TEMPLATE_NAME_PATTERN,
    'must start with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores (max 48 characters)',
  )

const workflowTemplateEnvelopeSchema = z.strictObject({
  templateVersion: z.literal(1),
  name: workflowTemplateNameSchema,
  description: z.string().trim().min(1).max(200),
  argumentHint: z.string().trim().min(1).max(80).optional(),
  spec: z.unknown(),
})

export type WorkflowTemplate = {
  templateVersion: 1
  name: string
  description: string
  argumentHint?: string
  spec: WorkflowSpec
  filePath: string
  usesArguments: boolean
}

export type WorkflowTemplateDiagnostic = {
  filePath: string
  message: string
}

export type WorkflowTemplateDiscovery = {
  directory: string
  templates: WorkflowTemplate[]
  diagnostics: WorkflowTemplateDiagnostic[]
}

export class WorkflowTemplateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowTemplateError'
  }
}

type TemplateCandidate = {
  name: string
  stem: string
  filePath: string
  extension: '.json' | '.jsonc'
  isFile: boolean
  isSymbolicLink: boolean
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    .join('; ')
}

function jsoncLocation(content: string, error: ParseError): string {
  const prefix = content.slice(0, error.offset)
  const lines = prefix.split('\n')
  return `${lines.length}:${(lines.at(-1)?.length ?? 0) + 1}`
}

function parseTemplateDocument(
  content: string,
  extension: TemplateCandidate['extension'],
): unknown {
  const normalized = stripBOM(content)
  if (extension === '.json') return JSON.parse(normalized)

  const errors: ParseError[] = []
  const parsed = parseJsonc(normalized, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  })
  if (errors.length > 0) {
    throw new Error(
      errors
        .slice(0, 3)
        .map(
          error =>
            `${printParseErrorCode(error.error)} at ${jsoncLocation(normalized, error)}`,
        )
        .join(', '),
    )
  }
  return parsed
}

function usesTemplateArguments(spec: WorkflowSpec): boolean {
  return (
    spec.objective.includes(WORKFLOW_TEMPLATE_ARGUMENT_TOKEN) ||
    spec.steps.some(step =>
      step.prompt.includes(WORKFLOW_TEMPLATE_ARGUMENT_TOKEN),
    )
  )
}

async function loadWorkflowTemplate(
  candidate: TemplateCandidate,
): Promise<WorkflowTemplate> {
  if (!candidate.isFile || candidate.isSymbolicLink) {
    throw new WorkflowTemplateError(
      'workflow templates must be regular files; symbolic links and directories are not supported',
    )
  }
  if (!WORKFLOW_TEMPLATE_NAME_PATTERN.test(candidate.stem)) {
    throw new WorkflowTemplateError(
      `invalid template filename "${candidate.name}"; use lowercase letters, digits, hyphens, or underscores`,
    )
  }

  const fileStat = await lstat(candidate.filePath)
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
    throw new WorkflowTemplateError(
      'workflow template is not a regular file or became a symbolic link',
    )
  }
  if (fileStat.size > MAX_WORKFLOW_TEMPLATE_FILE_BYTES) {
    throw new WorkflowTemplateError(
      `workflow template exceeds ${MAX_WORKFLOW_TEMPLATE_FILE_BYTES} bytes`,
    )
  }

  let document: unknown
  try {
    document = parseTemplateDocument(
      await readFile(candidate.filePath, 'utf8'),
      candidate.extension,
    )
  } catch (error) {
    throw new WorkflowTemplateError(
      `invalid ${candidate.extension.slice(1).toUpperCase()}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const envelope = workflowTemplateEnvelopeSchema.safeParse(document)
  if (!envelope.success) {
    throw new WorkflowTemplateError(formatZodIssues(envelope.error))
  }
  if (envelope.data.name !== candidate.stem) {
    throw new WorkflowTemplateError(
      `template name "${envelope.data.name}" must match filename "${candidate.stem}"`,
    )
  }

  let spec: WorkflowSpec
  try {
    spec = validateWorkflowSpec(envelope.data.spec)
  } catch (error) {
    throw new WorkflowTemplateError(
      `spec: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (spec.name !== envelope.data.name) {
    throw new WorkflowTemplateError(
      `spec.name "${spec.name}" must match template name "${envelope.data.name}"`,
    )
  }

  const usesArguments = usesTemplateArguments(spec)
  if (usesArguments && envelope.data.argumentHint === undefined) {
    throw new WorkflowTemplateError(
      `argumentHint is required when ${WORKFLOW_TEMPLATE_ARGUMENT_TOKEN} is used`,
    )
  }
  if (!usesArguments && envelope.data.argumentHint !== undefined) {
    throw new WorkflowTemplateError(
      `argumentHint requires ${WORKFLOW_TEMPLATE_ARGUMENT_TOKEN} in objective or a step prompt`,
    )
  }

  return {
    templateVersion: 1,
    name: envelope.data.name,
    description: envelope.data.description,
    ...(envelope.data.argumentHint === undefined
      ? {}
      : { argumentHint: envelope.data.argumentHint }),
    spec,
    filePath: candidate.filePath,
    usesArguments,
  }
}

function templateStem(name: string): string {
  const extension = extname(name)
  return basename(name, extension)
}

export function getWorkflowTemplatesDirectory(projectRoot: string): string {
  return join(projectRoot, WORKFLOW_TEMPLATES_RELATIVE_DIR)
}

export async function discoverWorkflowTemplates(
  projectRoot: string,
): Promise<WorkflowTemplateDiscovery> {
  const directory = getWorkflowTemplatesDirectory(projectRoot)
  try {
    const directoryStat = await lstat(directory)
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
      return {
        directory,
        templates: [],
        diagnostics: [
          {
            filePath: directory,
            message:
              'workflow template directory must be a real directory, not a file or symbolic link',
          },
        ],
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { directory, templates: [], diagnostics: [] }
    }
    return {
      directory,
      templates: [],
      diagnostics: [
        {
          filePath: directory,
          message: `cannot inspect workflow template directory: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }

  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    return {
      directory,
      templates: [],
      diagnostics: [
        {
          filePath: directory,
          message: `cannot read workflow template directory: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }

  const candidates = entries
    .flatMap(entry => {
      const extension = extname(entry.name)
      if (extension !== '.json' && extension !== '.jsonc') return []
      return [
        {
          name: entry.name,
          stem: templateStem(entry.name),
          filePath: join(directory, entry.name),
          extension,
          isFile: entry.isFile(),
          isSymbolicLink: entry.isSymbolicLink(),
        } satisfies TemplateCandidate,
      ]
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))

  const diagnostics: WorkflowTemplateDiagnostic[] = []
  const limited = candidates.slice(0, MAX_WORKFLOW_TEMPLATES)
  if (candidates.length > MAX_WORKFLOW_TEMPLATES) {
    diagnostics.push({
      filePath: directory,
      message: `found ${candidates.length} template files; only the first ${MAX_WORKFLOW_TEMPLATES} are inspected`,
    })
  }

  const counts = new Map<string, number>()
  for (const candidate of candidates) {
    counts.set(candidate.stem, (counts.get(candidate.stem) ?? 0) + 1)
  }

  const templates: WorkflowTemplate[] = []
  for (const candidate of limited) {
    if ((counts.get(candidate.stem) ?? 0) > 1) {
      diagnostics.push({
        filePath: candidate.filePath,
        message: `duplicate template name "${candidate.stem}"; keep only one .json or .jsonc file`,
      })
      continue
    }
    try {
      templates.push(await loadWorkflowTemplate(candidate))
    } catch (error) {
      diagnostics.push({
        filePath: candidate.filePath,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { directory, templates, diagnostics }
}

export async function resolveWorkflowTemplate(
  projectRoot: string,
  name: string,
): Promise<WorkflowTemplate> {
  const parsedName = workflowTemplateNameSchema.safeParse(name)
  if (!parsedName.success) {
    throw new WorkflowTemplateError(
      `Invalid workflow template name: ${formatZodIssues(parsedName.error)}`,
    )
  }

  const discovery = await discoverWorkflowTemplates(projectRoot)
  const template = discovery.templates.find(
    item => item.name === parsedName.data,
  )
  if (template) return template

  const relevant = discovery.diagnostics.find(
    diagnostic =>
      templateStem(basename(diagnostic.filePath)) === parsedName.data,
  )
  if (relevant) {
    throw new WorkflowTemplateError(
      `Workflow template "${parsedName.data}" is invalid: ${relevant.message}`,
    )
  }
  throw new WorkflowTemplateError(
    `Workflow template "${parsedName.data}" was not found in ${WORKFLOW_TEMPLATES_RELATIVE_DIR}`,
  )
}

export function instantiateWorkflowTemplate(
  template: WorkflowTemplate,
  argumentsText?: string,
): WorkflowSpec {
  const args = argumentsText?.trim() ?? ''
  if (args.length > MAX_WORKFLOW_TEMPLATE_ARGUMENT_CHARS) {
    throw new WorkflowTemplateError(
      `Workflow template arguments exceed ${MAX_WORKFLOW_TEMPLATE_ARGUMENT_CHARS} characters`,
    )
  }
  if (template.usesArguments && args.length === 0) {
    throw new WorkflowTemplateError(
      `Workflow template "${template.name}" requires arguments${template.argumentHint ? `: ${template.argumentHint}` : ''}`,
    )
  }
  if (!template.usesArguments && args.length > 0) {
    throw new WorkflowTemplateError(
      `Workflow template "${template.name}" does not accept arguments`,
    )
  }

  const render = (value: string): string =>
    value.replaceAll(WORKFLOW_TEMPLATE_ARGUMENT_TOKEN, () => args)
  return validateWorkflowSpec({
    ...template.spec,
    objective: render(template.spec.objective),
    steps: template.spec.steps.map(step => ({
      ...step,
      prompt: render(step.prompt),
    })),
  })
}
