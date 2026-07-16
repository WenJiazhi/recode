import { expect, test } from 'bun:test'

import { getVisibleSkillCommands } from '../SkillsMenu.js'
import type { Command } from '../../../commands.js'

test('getVisibleSkillCommands includes bundled skills alongside user/plugin/mcp skills', () => {
  const commands = [
    {
      type: 'prompt',
      name: 'loop',
      description: 'Bundled loop skill',
      loadedFrom: 'bundled',
      source: 'bundled',
      progressMessage: 'running',
      contentLength: 0,
      getPromptForCommand: async () => [],
    },
    {
      type: 'prompt',
      name: 'local-skill',
      description: 'Local skill',
      loadedFrom: 'skills',
      source: 'localSettings',
      progressMessage: 'running',
      contentLength: 0,
      getPromptForCommand: async () => [],
    },
    {
      type: 'local-jsx',
      name: 'doctor',
      description: 'Non-skill command',
      load: async () => ({ call: async () => null }),
    },
  ] satisfies Command[]

  const visible = getVisibleSkillCommands(commands)

  expect(visible.map(cmd => cmd.name)).toEqual(['loop', 'local-skill'])
})
