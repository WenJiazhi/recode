const call = async () => ({
  type: 'text',
  value:
    '/reset-limits is not available in this build yet. The command name is reserved so the CLI can surface a stable message instead of `Unknown skill`.',
})

export const resetLimits = {
  type: 'local',
  name: 'reset-limits',
  description: 'Reset local usage/rate limit state',
  load: async () => ({ call }),
}

export const resetLimitsNonInteractive = {
  ...resetLimits,
  supportsNonInteractive: true,
}

export default resetLimits
