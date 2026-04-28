import { feature } from 'bun:bundle'
import { isEnvTruthy } from '../../utils/envUtils.js'

export function isVerificationAgentFeatureEnabled(): boolean {
  return feature('VERIFICATION_AGENT')
    ? true
    : isEnvTruthy(process.env.FEATURE_VERIFICATION_AGENT)
}
