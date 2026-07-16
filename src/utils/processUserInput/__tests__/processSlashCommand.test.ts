import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { setIsInteractive } from '../../../bootstrap/state.js'
import { clearCommandsCache, getCommands } from '../../../commands.js'
import { getDefaultAppState } from '../../../state/AppStateStore.js'
import { createFileStateCacheWithSizeLimit } from '../../fileStateCache.js'
import { processSlashCommand } from '../processSlashCommand.js'

const ORIGINAL_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ORIGINAL_FEATURE_ULTRAPLAN = process.env.FEATURE_ULTRAPLAN
const ORIGINAL_FEATURE_VOICE_MODE = process.env.FEATURE_VOICE_MODE
const ORIGINAL_FEATURE_KAIROS_BRIEF = process.env.FEATURE_KAIROS_BRIEF
const ORIGINAL_FEATURE_BRIDGE_MODE = process.env.FEATURE_BRIDGE_MODE

function createHeadlessContext(commands: Awaited<ReturnType<typeof getCommands>>) {
  let appState = getDefaultAppState()

  return {
    options: {
      commands,
      debug: false,
      mainLoopModel: 'test-model',
      tools: [],
      verbose: false,
      thinkingConfig: { type: 'disabled' as const },
      mcpClients: [],
      mcpResources: {},
      isNonInteractiveSession: true,
      agentDefinitions: { activeAgents: [], allAgents: [] },
    },
    abortController: new AbortController(),
    readFileState: createFileStateCacheWithSizeLimit(10),
    getAppState: () => appState,
    setAppState: (updater: (prev: typeof appState) => typeof appState) => {
      appState = updater(appState)
    },
    setMessages: () => {},
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
    updateFileHistoryState: () => {},
    updateAttributionState: () => {},
    onChangeAPIKey: () => {},
    messages: [],
  } as any
}

async function getHeadlessCommands() {
  const commands = await getCommands(process.cwd())
  return commands.filter(
    command =>
      (command.type === 'prompt' && !command.disableNonInteractive) ||
      (command.type === 'local' && command.supportsNonInteractive),
  )
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  process.env.FEATURE_ULTRAPLAN = '1'
  process.env.FEATURE_VOICE_MODE = '1'
  process.env.FEATURE_KAIROS_BRIEF = '1'
  process.env.FEATURE_BRIDGE_MODE = '1'
  setIsInteractive(false)
  clearCommandsCache()
})

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_API_KEY
  if (ORIGINAL_FEATURE_ULTRAPLAN === undefined) {
    delete process.env.FEATURE_ULTRAPLAN
  } else {
    process.env.FEATURE_ULTRAPLAN = ORIGINAL_FEATURE_ULTRAPLAN
  }
  if (ORIGINAL_FEATURE_VOICE_MODE === undefined) {
    delete process.env.FEATURE_VOICE_MODE
  } else {
    process.env.FEATURE_VOICE_MODE = ORIGINAL_FEATURE_VOICE_MODE
  }
  if (ORIGINAL_FEATURE_KAIROS_BRIEF === undefined) {
    delete process.env.FEATURE_KAIROS_BRIEF
  } else {
    process.env.FEATURE_KAIROS_BRIEF = ORIGINAL_FEATURE_KAIROS_BRIEF
  }
  if (ORIGINAL_FEATURE_BRIDGE_MODE === undefined) {
    delete process.env.FEATURE_BRIDGE_MODE
  } else {
    process.env.FEATURE_BRIDGE_MODE = ORIGINAL_FEATURE_BRIDGE_MODE
  }
  setIsInteractive(true)
  clearCommandsCache()
})

describe('processSlashCommand headless built-in fallback', () => {
  test.each([
    ['/resume', "/resume isn't available in non-interactive mode. Run it inside the interactive recode session."],
    ['/continue', "/continue isn't available in non-interactive mode. Run it inside the interactive recode session."],
    ['/session', "/session isn't available in non-interactive mode. Run it inside the interactive recode session."],
    ['/remote', "/remote isn't available in non-interactive mode. Run it inside the interactive recode session."],
    ['/permissions', "/permissions isn't available in non-interactive mode. Run it inside the interactive recode session."],
    ['/allowed-tools', "/allowed-tools isn't available in non-interactive mode. Run it inside the interactive recode session."],
    ['/ultraplan', 'Unknown skill: ultraplan'],
    ['/voice', 'Unknown skill: voice'],
    ['/brief', "/brief isn't available in non-interactive mode. Run it inside the interactive recode session."],
    ['/remote-control', 'Unknown skill: remote-control'],
  ])('returns a precise fallback for %s', async (input, expected) => {
    const headlessCommands = await getHeadlessCommands()
    const result = await processSlashCommand(
      input,
      [],
      [],
      [],
      createHeadlessContext(headlessCommands),
      () => {},
    )

    expect(result.shouldQuery).toBe(false)
    expect(result.resultText).toBe(expected)
  })
})

describe('processSlashCommand local command context', () => {
  test('forwards canUseTool to local commands', async () => {
    const canUseTool = async () => ({
      behavior: 'allow' as const,
      updatedInput: {},
    })
    const command = {
      type: 'local' as const,
      name: 'context-probe',
      description: 'Inspect the local command context',
      supportsNonInteractive: true,
      load: async () => ({
        call: async (_args: string, context: { canUseTool?: unknown }) => ({
          type: 'text' as const,
          value: context.canUseTool === canUseTool ? 'forwarded' : 'missing',
        }),
      }),
    }
    const context = createHeadlessContext([command] as any)

    const result = await processSlashCommand(
      '/context-probe',
      [],
      [],
      [],
      context,
      () => {},
      undefined,
      false,
      canUseTool,
    )

    expect(result.resultText).toBe('forwarded')
  })
})
