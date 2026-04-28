import { feature } from 'bun:bundle'
import { isEnvTruthy } from './envUtils.js'

export function isTokenBudgetFeatureEnabled(): boolean {
  return feature('TOKEN_BUDGET')
    ? true
    : isEnvTruthy(process.env.FEATURE_TOKEN_BUDGET)
}
