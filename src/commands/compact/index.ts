import type { Command } from '../../commands.js'
import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { LocalCommandCall } from '../../types/command.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

const compact = {
  type: 'local',
  name: 'compact',
  description:
    'Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization]',
  isEnabled: () => !isEnvTruthy(process.env.DISABLE_COMPACT),
  supportsNonInteractive: true,
  argumentHint: '<optional custom summarization instructions>',
  load: () => import('./compact.js'),
} satisfies Command

const compactNonInteractiveCall: LocalCommandCall = async () => ({
  type: 'text',
  value:
    '/compact is not available in non-interactive mode. Run it inside the interactive recode session.',
})

export const compactNonInteractive = {
  type: 'local',
  name: 'compact',
  supportsNonInteractive: true,
  description:
    'Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization]',
  isEnabled: () =>
    getIsNonInteractiveSession() && !isEnvTruthy(process.env.DISABLE_COMPACT),
  get isHidden() {
    return !getIsNonInteractiveSession()
  },
  argumentHint: '<optional custom summarization instructions>',
  load: async () => ({ call: compactNonInteractiveCall }),
} satisfies Command

export default compact
