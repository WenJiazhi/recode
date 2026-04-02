import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'

const diff = {
  type: 'local-jsx',
  name: 'diff',
  description: 'View uncommitted changes and per-turn diffs',
  isEnabled: () => !getIsNonInteractiveSession(),
  get isHidden() {
    return getIsNonInteractiveSession()
  },
  load: () => import('./diff.js'),
} satisfies Command

export const diffNonInteractive: Command = {
  type: 'local',
  name: 'diff',
  supportsNonInteractive: true,
  description: 'View uncommitted changes and per-turn diffs',
  isEnabled: () => getIsNonInteractiveSession(),
  get isHidden() {
    return !getIsNonInteractiveSession()
  },
  load: () => import('./diff-noninteractive.js'),
}

export default diff
