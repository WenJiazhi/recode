import { afterEach, describe, expect, test } from 'bun:test'
import {
  getPrivacyLevel,
  isEssentialTrafficOnly,
  isTelemetryDisabled,
} from '../privacyLevel.js'

const originalEnvironment = {
  disableNonessentialTraffic:
    process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC,
  disableTelemetry: process.env.DISABLE_TELEMETRY,
  telemetryEnabled: process.env.RECODE_TELEMETRY_ENABLED,
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

afterEach(() => {
  restoreEnvironment(
    'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
    originalEnvironment.disableNonessentialTraffic,
  )
  restoreEnvironment('DISABLE_TELEMETRY', originalEnvironment.disableTelemetry)
  restoreEnvironment(
    'RECODE_TELEMETRY_ENABLED',
    originalEnvironment.telemetryEnabled,
  )
})

describe('privacy level', () => {
  test('disables telemetry by default', () => {
    delete process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
    delete process.env.DISABLE_TELEMETRY
    delete process.env.RECODE_TELEMETRY_ENABLED

    expect(getPrivacyLevel()).toBe('no-telemetry')
    expect(isTelemetryDisabled()).toBe(true)
    expect(isEssentialTrafficOnly()).toBe(false)
  })

  test('enables telemetry only with an explicit truthy opt-in', () => {
    delete process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
    delete process.env.DISABLE_TELEMETRY
    process.env.RECODE_TELEMETRY_ENABLED = '1'

    expect(getPrivacyLevel()).toBe('default')
    expect(isTelemetryDisabled()).toBe(false)
  })

  test('explicit privacy restrictions override the opt-in', () => {
    delete process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
    process.env.RECODE_TELEMETRY_ENABLED = 'true'
    process.env.DISABLE_TELEMETRY = '1'

    expect(getPrivacyLevel()).toBe('no-telemetry')

    process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'
    expect(getPrivacyLevel()).toBe('essential-traffic')
    expect(isEssentialTrafficOnly()).toBe(true)
  })
})
