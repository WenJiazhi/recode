import { feature } from 'bun:bundle'
import { isEnvTruthy } from './envUtils.js'

export function isShotStatsFeatureEnabled(): boolean {
  return feature('SHOT_STATS')
    ? true
    : isEnvTruthy(process.env.FEATURE_SHOT_STATS)
}
