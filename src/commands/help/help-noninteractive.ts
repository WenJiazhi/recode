import {
  formatDescriptionWithSource,
  getCommandName,
  isCommandEnabled,
} from '../../commands.js'
import type { LocalCommandCall } from '../../types/command.js'

export const call: LocalCommandCall = async (_args, context) => {
  const commands = context.options.commands
    .filter((command) => isCommandEnabled(command) && !command.isHidden)
    .sort((a, b) => getCommandName(a).localeCompare(getCommandName(b)))

  return {
    type: 'text',
    value: [
      'Available commands:',
      ...commands.map(
        (command) =>
          `/${getCommandName(command)} - ${formatDescriptionWithSource(command)}`,
      ),
    ].join('\n'),
  }
}
