import { getIsNonInteractiveSession } from '../../bootstrap/state.js'
import type { Command } from '../../commands.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

const doctor: Command = {
  name: 'doctor',
  description: 'Diagnose and verify your recode installation and settings',
  isEnabled: () =>
    !isEnvTruthy(process.env.DISABLE_DOCTOR_COMMAND) &&
    !getIsNonInteractiveSession(),
  get isHidden() {
    return getIsNonInteractiveSession()
  },
  type: 'local-jsx',
  load: () => import('./doctor.js'),
}

export const doctorNonInteractive: Command = {
  name: 'doctor',
  description: 'Diagnose and verify your recode installation and settings',
  isEnabled: () =>
    !isEnvTruthy(process.env.DISABLE_DOCTOR_COMMAND) &&
    getIsNonInteractiveSession(),
  get isHidden() {
    return !getIsNonInteractiveSession()
  },
  type: 'local',
  supportsNonInteractive: true,
  load: () => import('./doctor-noninteractive.js'),
}

export default doctor
