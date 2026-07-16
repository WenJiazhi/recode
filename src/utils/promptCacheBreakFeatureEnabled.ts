import { feature } from 'bun:bundle'
import { isEnvTruthy } from './envUtils.js'

export function isPromptCacheBreakFeatureEnabled(): boolean {
  return feature('PROMPT_CACHE_BREAK_DETECTION')
    ? true
    : isEnvTruthy(process.env.FEATURE_PROMPT_CACHE_BREAK_DETECTION)
}
