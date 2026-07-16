import type { Command } from '../../commands.js'

export default {
  type: 'local',
  name: 'workflows',
  supportsNonInteractive: true,
  description:
    'Run templates or list, inspect, configure, stop, and resume workflows',
  load: () => import('./workflows.js'),
} satisfies Command
