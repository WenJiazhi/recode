import { describe, expect, test } from 'bun:test'
import {
  getOptionalCapabilitySummary,
  OPTIONAL_CAPABILITIES,
  OPTIONAL_CAPABILITY_STATES,
} from '../optionalCapabilities.js'

describe('optional capability registry', () => {
  test('uses unique stable IDs and explicit non-public visibility', () => {
    const ids = OPTIONAL_CAPABILITIES.map(capability => capability.id)

    expect(new Set(ids).size).toBe(ids.length)
    for (const capability of OPTIONAL_CAPABILITIES) {
      expect(OPTIONAL_CAPABILITY_STATES).toContain(capability.state)
      if (capability.state === 'not-independently-implemented') {
        expect(capability.visibility).toBe('hidden')
      }
    }
  })

  test('accounts for the current static audit contract', () => {
    expect(getOptionalCapabilitySummary()).toEqual({
      total: 28,
      byState: {
        available: 1,
        'build-disabled': 5,
        'not-independently-implemented': 18,
        'external-dependency-required': 4,
      },
      hidden: 23,
      unresolvedImports: 47,
      retainedFiles: 11,
      externalBinaryUses: 14,
      runtimeDependencyExceptions: 1,
    })
  })
})
