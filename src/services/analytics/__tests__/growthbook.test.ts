import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  checkGate_CACHED_OR_BLOCKING,
  checkStatsigFeatureGate_CACHED_MAY_BE_STALE,
  getFeatureValue_CACHED_MAY_BE_STALE,
  getFeatureValue_DEPRECATED,
} from '../growthbook.js'

const envSnapshot = {
  disableLocalGates: process.env.CLAUDE_CODE_DISABLE_LOCAL_GATES,
  useBedrock: process.env.CLAUDE_CODE_USE_BEDROCK,
}

function restoreEnv(name: 'CLAUDE_CODE_DISABLE_LOCAL_GATES' | 'CLAUDE_CODE_USE_BEDROCK', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}

beforeEach(() => {
  // Force GrowthBook fully unavailable through the same shared analytics
  // disable path used in production provider routing.
  process.env.CLAUDE_CODE_USE_BEDROCK = '1'
  restoreEnv('CLAUDE_CODE_DISABLE_LOCAL_GATES', envSnapshot.disableLocalGates)
})

afterEach(() => {
  restoreEnv('CLAUDE_CODE_DISABLE_LOCAL_GATES', envSnapshot.disableLocalGates)
  restoreEnv('CLAUDE_CODE_USE_BEDROCK', envSnapshot.useBedrock)
})

describe('GrowthBook local gate defaults', () => {
  test('returns local defaults for cached getters when GrowthBook is unavailable', () => {
    expect(getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_brief', false)).toBe(
      true,
    )
    expect(
      getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_brief_config', {
        enable_slash_command: false,
      }),
    ).toEqual({ enable_slash_command: true })
    expect(checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_hive_evidence')).toBe(
      true,
    )
  })

  test('returns local defaults for blocking getters when GrowthBook is unavailable', async () => {
    expect(await getFeatureValue_DEPRECATED('tengu_session_memory', false)).toBe(
      true,
    )
    expect(await checkGate_CACHED_OR_BLOCKING('tengu_hive_evidence')).toBe(true)
  })

  test('can bypass local defaults with CLAUDE_CODE_DISABLE_LOCAL_GATES', async () => {
    process.env.CLAUDE_CODE_DISABLE_LOCAL_GATES = '1'

    expect(getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_brief', false)).toBe(
      false,
    )
    expect(
      await getFeatureValue_DEPRECATED('tengu_session_memory', false),
    ).toBe(false)
    expect(checkStatsigFeatureGate_CACHED_MAY_BE_STALE('tengu_hive_evidence')).toBe(
      false,
    )
    expect(await checkGate_CACHED_OR_BLOCKING('tengu_hive_evidence')).toBe(
      false,
    )
  })
})
