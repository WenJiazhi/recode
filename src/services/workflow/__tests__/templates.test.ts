import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  discoverWorkflowTemplates,
  getWorkflowTemplatesDirectory,
  instantiateWorkflowTemplate,
  MAX_WORKFLOW_TEMPLATE_ARGUMENT_CHARS,
  MAX_WORKFLOW_TEMPLATE_FILE_BYTES,
  resolveWorkflowTemplate,
} from '../templates.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(root => rm(root, { recursive: true, force: true })),
  )
})

async function project(): Promise<{ root: string; directory: string }> {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflow-templates-'))
  roots.push(root)
  const directory = getWorkflowTemplatesDirectory(root)
  await mkdir(directory, { recursive: true })
  return { root, directory }
}

function envelope(
  name: string,
  options: { arguments?: boolean; spec?: Record<string, unknown> } = {},
): Record<string, unknown> {
  const usesArguments = options.arguments === true
  return {
    templateVersion: 1,
    name,
    description: `Run ${name}`,
    ...(usesArguments ? { argumentHint: '<target>' } : {}),
    spec: {
      version: 1,
      name,
      objective: usesArguments
        ? 'Review $ARGUMENTS and report concrete evidence'
        : `Run ${name}`,
      maxConcurrency: 2,
      steps: [
        {
          id: 'inspect',
          title: 'Inspect',
          prompt: usesArguments ? 'Inspect $ARGUMENTS' : 'Inspect the project',
        },
        {
          id: 'verify',
          title: 'Verify',
          prompt: 'Verify the findings',
        },
      ],
      ...options.spec,
    },
  }
}

describe('workflow template discovery', () => {
  test('loads sorted JSON and JSONC templates and normalizes their specs', async () => {
    const { root, directory } = await project()
    await writeFile(
      join(directory, 'zeta.json'),
      JSON.stringify(envelope('zeta')),
    )
    await writeFile(
      join(directory, 'review.jsonc'),
      `{
        // Project-owned declarative workflow
        "templateVersion": 1,
        "name": "review",
        "description": "Review a target",
        "argumentHint": "<target>",
        "spec": {
          "version": 1,
          "name": "review",
          "objective": "Review $ARGUMENTS",
          "steps": [
            { "id": "inspect", "title": "Inspect", "prompt": "Inspect $ARGUMENTS", },
          ],
        },
      }`,
    )

    const discovery = await discoverWorkflowTemplates(root)

    expect(discovery.diagnostics).toEqual([])
    expect(discovery.templates.map(template => template.name)).toEqual([
      'review',
      'zeta',
    ])
    expect(discovery.templates[0]?.spec.steps[0]).toMatchObject({
      mode: 'read',
      dependsOn: [],
      maxAttempts: 1,
    })
  })

  test('reports invalid specs, name mismatches, and strict JSON syntax independently', async () => {
    const { root, directory } = await project()
    await writeFile(
      join(directory, 'bad-graph.json'),
      JSON.stringify(
        envelope('bad-graph', {
          spec: {
            steps: [
              {
                id: 'inspect',
                title: 'Inspect',
                prompt: 'Inspect',
                dependsOn: ['missing'],
              },
            ],
          },
        }),
      ),
    )
    await writeFile(
      join(directory, 'wrong-file.json'),
      JSON.stringify(envelope('different-name')),
    )
    await writeFile(
      join(directory, 'strict.json'),
      '{ // comments need the .jsonc extension\n }',
    )

    const discovery = await discoverWorkflowTemplates(root)

    expect(discovery.templates).toEqual([])
    expect(discovery.diagnostics).toHaveLength(3)
    expect(
      discovery.diagnostics.map(item => item.message).join('\n'),
    ).toContain('depends on unknown step missing')
    expect(
      discovery.diagnostics.map(item => item.message).join('\n'),
    ).toContain('must match filename')
    expect(
      discovery.diagnostics.map(item => item.message).join('\n'),
    ).toContain('invalid JSON')
  })

  test('rejects ambiguous extensions and symbolic links instead of choosing implicitly', async () => {
    const { root, directory } = await project()
    await writeFile(
      join(directory, 'duplicate.json'),
      JSON.stringify(envelope('duplicate')),
    )
    await writeFile(
      join(directory, 'duplicate.jsonc'),
      JSON.stringify(envelope('duplicate')),
    )
    if (process.platform !== 'win32') {
      const target = join(root, 'outside.json')
      await writeFile(target, JSON.stringify(envelope('linked')))
      await symlink(target, join(directory, 'linked.json'))
    }

    const discovery = await discoverWorkflowTemplates(root)

    expect(discovery.templates).toEqual([])
    expect(
      discovery.diagnostics.filter(item => item.message.includes('duplicate')),
    ).toHaveLength(2)
    if (process.platform !== 'win32') {
      expect(
        discovery.diagnostics.some(item =>
          item.message.includes('symbolic links'),
        ),
      ).toBe(true)
    }
  })

  test('does not follow a symbolic link used as the template directory', async () => {
    if (process.platform === 'win32') return
    const { root, directory } = await project()
    const outside = await mkdtemp(join(tmpdir(), 'recode-workflow-outside-'))
    roots.push(outside)
    await rm(directory, { recursive: true, force: true })
    await writeFile(
      join(outside, 'outside.json'),
      JSON.stringify(envelope('outside')),
    )
    await symlink(outside, directory)

    const discovery = await discoverWorkflowTemplates(root)

    expect(discovery.templates).toEqual([])
    expect(discovery.diagnostics[0]?.message).toContain('real directory')
  })

  test('enforces the file-size boundary before parsing', async () => {
    const { root, directory } = await project()
    await writeFile(
      join(directory, 'oversized.json'),
      ' '.repeat(MAX_WORKFLOW_TEMPLATE_FILE_BYTES + 1),
    )

    const discovery = await discoverWorkflowTemplates(root)

    expect(discovery.templates).toEqual([])
    expect(discovery.diagnostics[0]?.message).toContain('exceeds')
  })
})

describe('workflow template instantiation', () => {
  test('substitutes arguments as literal text and leaves the stored template unchanged', async () => {
    const { root, directory } = await project()
    await writeFile(
      join(directory, 'review.json'),
      JSON.stringify(envelope('review', { arguments: true })),
    )
    const template = await resolveWorkflowTemplate(root, 'review')
    const spec = instantiateWorkflowTemplate(template, 'src/auth $& handler')

    expect(spec.objective).toContain('src/auth $& handler')
    expect(spec.steps[0]?.prompt).toBe('Inspect src/auth $& handler')
    expect(template.spec.objective).toContain('$ARGUMENTS')
  })

  test('enforces each template argument contract and post-expansion limits', async () => {
    const { root, directory } = await project()
    await writeFile(
      join(directory, 'required.json'),
      JSON.stringify(envelope('required', { arguments: true })),
    )
    await writeFile(
      join(directory, 'fixed.json'),
      JSON.stringify(envelope('fixed')),
    )
    const required = await resolveWorkflowTemplate(root, 'required')
    const fixed = await resolveWorkflowTemplate(root, 'fixed')

    expect(() => instantiateWorkflowTemplate(required)).toThrow(
      'requires arguments',
    )
    expect(() => instantiateWorkflowTemplate(fixed, 'extra')).toThrow(
      'does not accept arguments',
    )
    expect(() =>
      instantiateWorkflowTemplate(
        required,
        'x'.repeat(MAX_WORKFLOW_TEMPLATE_ARGUMENT_CHARS + 1),
      ),
    ).toThrow('arguments exceed')
    expect(() =>
      instantiateWorkflowTemplate(required, 'x'.repeat(4_001)),
    ).toThrow('objective')
  })

  test('rejects traversal-like names before reading the directory', async () => {
    const { root } = await project()

    await expect(resolveWorkflowTemplate(root, '../outside')).rejects.toThrow(
      'Invalid workflow template name',
    )
    await expect(resolveWorkflowTemplate(root, 'missing')).rejects.toThrow(
      'was not found',
    )
  })
})
