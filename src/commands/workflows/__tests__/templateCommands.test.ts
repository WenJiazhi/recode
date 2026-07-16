import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getProjectRoot, setProjectRoot } from '../../../bootstrap/state.js'
import {
  clearCommandsCache,
  getCommands,
  type Command,
} from '../../../commands.js'
import {
  filterWorkflowTemplateCommandCollisions,
  getWorkflowTemplateCommands,
} from '../templateCommands.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(root => rm(root, { recursive: true, force: true })),
  )
})

async function writeTemplate(root: string, name: string): Promise<void> {
  const directory = join(root, '.recode', 'workflows')
  await mkdir(directory, { recursive: true })
  await writeFile(
    join(directory, `${name}.json`),
    JSON.stringify({
      templateVersion: 1,
      name,
      description: 'Review a target with independent workers',
      argumentHint: '<target>',
      spec: {
        version: 1,
        name,
        objective: 'Review $ARGUMENTS',
        steps: [
          {
            id: 'review',
            title: 'Review',
            prompt: 'Review $ARGUMENTS',
          },
        ],
      },
    }),
  )
}

test('project templates become user-only workflow slash commands', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-template-commands-'))
  roots.push(root)
  await writeTemplate(root, 'target-review')

  const commands = await getWorkflowTemplateCommands(root)
  const command = commands[0]

  expect(command).toMatchObject({
    type: 'prompt',
    name: 'target-review',
    kind: 'workflow',
    source: 'projectSettings',
    argumentHint: '<target>',
    userInvocable: true,
    disableModelInvocation: true,
  })
  if (!command || command.type !== 'prompt') throw new Error('missing command')
  const blocks = await command.getPromptForCommand(
    'src/auth "quoted"',
    {} as never,
  )
  const text = blocks[0]?.type === 'text' ? blocks[0].text : ''
  expect(text).toContain('"template_name":"target-review"')
  expect(text).toContain('src/auth \\"quoted\\"')
  expect(text).toContain('Do not rewrite or inline')
})

test('built-in names, aliases, and user-facing names win command collisions', () => {
  const template = {
    type: 'prompt',
    name: 'review',
    description: 'Template',
  } as Command
  const unique = {
    type: 'prompt',
    name: 'project-audit',
    description: 'Template',
  } as Command
  const existing = [
    {
      type: 'local',
      name: 'builtin-review',
      aliases: ['review'],
      description: 'Built in',
    } as Command,
  ]

  expect(
    filterWorkflowTemplateCommandCollisions([template, unique], existing).map(
      command => command.name,
    ),
  ).toEqual(['project-audit'])
})

test('the command registry discovers templates from the stable project root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-template-registry-'))
  roots.push(root)
  await writeTemplate(root, 'registry-review')
  const previousRoot = getProjectRoot()

  try {
    setProjectRoot(root)
    clearCommandsCache()
    const commands = await getCommands(join(root, 'nested-working-directory'))
    expect(
      commands.find(command => command.name === 'registry-review'),
    ).toMatchObject({
      kind: 'workflow',
      source: 'projectSettings',
    })
  } finally {
    setProjectRoot(previousRoot)
    clearCommandsCache()
  }
})
