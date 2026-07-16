import type { Command, LocalCommandCall } from '../../types/command.js'

const call: LocalCommandCall = async () => ({
  type: 'text',
  value:
    '/reset-limits is not available in this build yet. The command name is reserved so the CLI can surface a stable message instead of `Unknown skill`.',
})

export const resetLimits = {
  type: 'local',
  name: 'reset-limits',
  description: 'Reset local usage/rate limit state',
  supportsNonInteractive: false,
  load: async () => ({ call }),
} satisfies Command

export const resetLimitsNonInteractive = {
  ...resetLimits,
  supportsNonInteractive: true,
} satisfies Command
