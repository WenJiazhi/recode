import { feature } from 'bun:bundle'
import { isEnvTruthy } from './envUtils.js'

export function isAgentTriggersFeatureEnabled(): boolean {
  return feature('AGENT_TRIGGERS')
    ? true
    : isEnvTruthy(process.env.FEATURE_AGENT_TRIGGERS)
}
