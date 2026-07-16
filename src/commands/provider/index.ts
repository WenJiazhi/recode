import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'

export default {
  type: 'local-jsx',
  name: 'provider',
  description: 'Choose the .claude or .recode provider configuration',
  isEnabled: () => !getIsNonInteractiveSession(),
  get isHidden() {
    return getIsNonInteractiveSession()
  },
  immediate: true,
  load: () => import('./provider.js'),
} satisfies Command
