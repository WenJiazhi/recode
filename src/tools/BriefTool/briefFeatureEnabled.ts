import { feature } from 'bun:bundle'
import { isEnvTruthy } from '../../utils/envUtils.js'

export function isBriefFeatureEnabled(): boolean {
  return feature('KAIROS') || feature('KAIROS_BRIEF')
    ? true
    : isEnvTruthy(process.env.FEATURE_KAIROS_BRIEF)
}
