import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'

export default {
  type: 'local-jsx',
  name: 'goal',
  description: 'Set or control a persistent autonomous development goal',
  argumentHint:
    '[<objective> | status | pause | resume | continue | budget | checkpoint | complete | clear]',
  isEnabled: () => !getIsNonInteractiveSession(),
  get isHidden() {
    return getIsNonInteractiveSession()
  },
  load: () => import('./goal.js'),
} satisfies Command
