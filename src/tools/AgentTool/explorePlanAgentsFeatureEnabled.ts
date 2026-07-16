import { feature } from 'bun:bundle'
import { isEnvTruthy } from '../../utils/envUtils.js'

export function isExplorePlanAgentsFeatureEnabled(): boolean {
  return feature('BUILTIN_EXPLORE_PLAN_AGENTS')
    ? true
    : isEnvTruthy(process.env.FEATURE_BUILTIN_EXPLORE_PLAN_AGENTS)
}
