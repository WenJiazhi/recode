import { feature } from 'bun:bundle'
import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { LocalCommandCall } from '../../types/command.js'
import type { Command } from '../../commands.js'

const branch = {
  type: 'local-jsx',
  name: 'branch',
  // 'fork' alias only when /fork doesn't exist as its own command
  aliases: feature('FORK_SUBAGENT') ? [] : ['fork'],
  description: 'Create a branch of the current conversation at this point',
  argumentHint: '[name]',
  load: () => import('./branch.js'),
} satisfies Command

const branchNonInteractiveCall: LocalCommandCall = async () => ({
  type: 'text',
  value:
    '/branch is not available in non-interactive mode. Run it inside the interactive recode session.',
})

export const branchNonInteractive = {
  type: 'local',
  name: 'branch',
  supportsNonInteractive: true,
  description: 'Create a branch of the current conversation at this point',
  isEnabled: () => getIsNonInteractiveSession(),
  get isHidden() {
    return !getIsNonInteractiveSession()
  },
  load: async () => ({ call: branchNonInteractiveCall }),
} satisfies Command

export default branch
