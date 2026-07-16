import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'
import { shouldInferenceConfigCommandBeImmediate } from '../../utils/immediateCommand.js'

const modelMap = {
  type: 'local-jsx',
  name: 'model-map',
  aliases: ['model-aliases'],
  description:
    'Configure custom opus/sonnet/haiku alias mappings for discovered models',
  argumentHint: '[status|reset]',
  isEnabled: () => !getIsNonInteractiveSession(),
  get isHidden() {
    return getIsNonInteractiveSession()
  },
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./model-map.js'),
} satisfies Command

export const modelMapNonInteractive: Command = {
  type: 'local',
  name: 'model-map',
  aliases: ['model-aliases'],
  supportsNonInteractive: true,
  description:
    'Configure custom opus/sonnet/haiku alias mappings for discovered models',
  argumentHint: '[status|reset]',
  isEnabled: () => getIsNonInteractiveSession(),
  get isHidden() {
    return !getIsNonInteractiveSession()
  },
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./model-map-noninteractive.js'),
}

export default modelMap
