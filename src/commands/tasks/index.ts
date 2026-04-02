import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'

const tasks = {
  type: 'local-jsx',
  name: 'tasks',
  aliases: ['bashes'],
  description: 'List and manage background tasks',
  isEnabled: () => !getIsNonInteractiveSession(),
  get isHidden() {
    return getIsNonInteractiveSession()
  },
  load: () => import('./tasks.js'),
} satisfies Command

export const tasksNonInteractive: Command = {
  type: 'local',
  name: 'tasks',
  aliases: ['bashes'],
  supportsNonInteractive: true,
  description: 'List and manage background tasks',
  isEnabled: () => getIsNonInteractiveSession(),
  get isHidden() {
    return !getIsNonInteractiveSession()
  },
  load: () => import('./tasks-noninteractive.js'),
}

export default tasks
