import { feature } from 'bun:bundle'
import { isEnvTruthy } from './envUtils.js'

export function isUltraplanFeatureEnabled(): boolean {
  if (feature('ULTRAPLAN')) {
    return true
  }
  return isEnvTruthy(process.env.FEATURE_ULTRAPLAN)
}
