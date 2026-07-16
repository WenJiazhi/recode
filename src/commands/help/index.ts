import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'

const help = {
  type: 'local-jsx',
  name: 'help',
  description: 'Show help and available commands',
  isEnabled: () => !getIsNonInteractiveSession(),
  get isHidden() {
    return getIsNonInteractiveSession()
  },
  load: () => import('./help.js'),
} satisfies Command

export const helpNonInteractive: Command = {
  type: 'local',
  name: 'help',
  supportsNonInteractive: true,
  description: 'Show help and available commands',
  isEnabled: () => getIsNonInteractiveSession(),
  get isHidden() {
    return !getIsNonInteractiveSession()
  },
  load: () => import('./help-noninteractive.js'),
}

export default help
