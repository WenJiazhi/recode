import { feature } from 'bun:bundle'
import { isEnvTruthy } from './envUtils.js'

export function isExtractMemoriesFeatureEnabled(): boolean {
  return feature('EXTRACT_MEMORIES')
    ? true
    : isEnvTruthy(process.env.FEATURE_EXTRACT_MEMORIES)
}
