import { describe, expect, test } from 'bun:test'
import type { Command } from '../../../commands.js'
import { generateCommandSuggestions } from '../commandSuggestions.js'

function promptCommand(
  name: string,
  source: 'projectSettings' | 'localSettings' | 'userSettings',
  kind?: 'workflow',
): Command {
  return {
    type: 'prompt',
    name,
    description: `${name} description`,
    loadedFrom: 'skills',
    source,
    kind,
  } as Command
}

describe('generateCommandSuggestions', () => {
  test('marks project and local prompt commands with a local tag', () => {
    const commands = [
      promptCommand('project-skill', 'projectSettings'),
      promptCommand('local-skill', 'localSettings'),
    ]

    const suggestions = generateCommandSuggestions('/local-skill', commands)
    expect(suggestions[0]?.displayText).toContain('/local-skill')
    expect(suggestions[0]?.tag).toBe('local')

    const projectSuggestions = generateCommandSuggestions('/project-skill', commands)
    expect(projectSuggestions[0]?.displayText).toContain('/project-skill')
    expect(projectSuggestions[0]?.tag).toBe('local')
  })

  test('keeps workflow tags higher priority than local scope tags', () => {
    const commands = [
      promptCommand('project-workflow', 'projectSettings', 'workflow'),
    ]

    const suggestions = generateCommandSuggestions('/project', commands)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.tag).toBe('workflow')
  })

  test('does not add local tags to user-level prompt commands', () => {
    const commands = [promptCommand('user-skill', 'userSettings')]

    const suggestions = generateCommandSuggestions('/user', commands)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.tag).toBeUndefined()
  })
})
