import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  getIsInteractive,
  setIsInteractive,
} from '../bootstrap/state.js'
import { clearCommandsCache, getCommands } from '../commands.js'
import { getCwd } from '../utils/cwd.js'

const ORIGINAL_INTERACTIVE = getIsInteractive()
const ORIGINAL_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  clearCommandsCache()
})

afterEach(() => {
  setIsInteractive(ORIGINAL_INTERACTIVE)
  process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_API_KEY
  delete process.env.USER_TYPE
  clearCommandsCache()
})

describe('non-interactive command ordering', () => {
  test('headless git workflow commands resolve to local fallbacks before prompt commands', async () => {
    setIsInteractive(false)

    const commands = await getCommands(getCwd())

    const commitCommands = commands.filter(command => command.name === 'commit')
    const reviewCommands = commands.filter(command => command.name === 'review')
    const branchCommands = commands.filter(command => command.name === 'branch')
    const commitPushPrCommands = commands.filter(
      command => command.name === 'commit-push-pr',
    )
    const compactCommands = commands.filter(command => command.name === 'compact')
    const initCommands = commands.filter(command => command.name === 'init')

    expect(commitCommands[0]?.type).toBe('local')
    expect(reviewCommands[0]?.type).toBe('local')
    expect(branchCommands[0]?.type).toBe('local')
    expect(commitPushPrCommands[0]?.type).toBe('local')
    expect(compactCommands[0]?.type).toBe('local')
    expect(initCommands[0]?.type).toBe('local')
  })

  test('command registry can load before config reads are enabled', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    setIsInteractive(false)

    try {
      await expect(getCommands(getCwd())).resolves.toBeArray()
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  test('external builds do not expose internal-only commands', async () => {
    delete process.env.USER_TYPE
    setIsInteractive(false)

    const commands = await getCommands(getCwd())
    const commandNames = new Set(commands.map(command => command.name))

    expect(commandNames.has('reset-limits')).toBe(false)
    expect(commandNames.has('version')).toBe(false)
  })
})
