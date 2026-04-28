import { feature } from 'bun:bundle'
import { isEnvTruthy } from './envUtils.js'

export function isAgentTriggersRemoteFeatureEnabled(): boolean {
  return feature('AGENT_TRIGGERS_REMOTE')
    ? true
    : isEnvTruthy(process.env.FEATURE_AGENT_TRIGGERS_REMOTE)
}
