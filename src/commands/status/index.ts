import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'

const status = {
  type: 'local-jsx',
  name: 'status',
  description:
    'Show recode status including version, model, account, API connectivity, and tool statuses',
  isEnabled: () => !getIsNonInteractiveSession(),
  get isHidden() {
    return getIsNonInteractiveSession()
  },
  immediate: true,
  load: () => import('./status.js'),
} satisfies Command

export const statusNonInteractive: Command = {
  type: 'local',
  name: 'status',
  supportsNonInteractive: true,
  description:
    'Show recode status including version, model, account, API connectivity, and tool statuses',
  isEnabled: () => getIsNonInteractiveSession(),
  get isHidden() {
    return !getIsNonInteractiveSession()
  },
  load: () => import('./status-noninteractive.js'),
}

export default status
