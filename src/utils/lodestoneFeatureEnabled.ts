import { feature } from 'bun:bundle'
import { isEnvTruthy } from './envUtils.js'

export function isLodestoneFeatureEnabled(): boolean {
  return feature('LODESTONE')
    ? true
    : isEnvTruthy(process.env.FEATURE_LODESTONE)
}
