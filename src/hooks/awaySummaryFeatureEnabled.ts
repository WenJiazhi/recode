import { feature } from 'bun:bundle'
import { isEnvTruthy } from '../utils/envUtils.js'

export function isAwaySummaryFeatureEnabled(): boolean {
  return feature('AWAY_SUMMARY')
    ? true
    : isEnvTruthy(process.env.FEATURE_AWAY_SUMMARY)
}
