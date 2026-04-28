import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

const ORIGINAL_FEATURE_CHICAGO_MCP = process.env.FEATURE_CHICAGO_MCP

beforeEach(() => {
  delete process.env.FEATURE_CHICAGO_MCP
})

afterEach(() => {
  if (ORIGINAL_FEATURE_CHICAGO_MCP === undefined) {
    delete process.env.FEATURE_CHICAGO_MCP
  } else {
    process.env.FEATURE_CHICAGO_MCP = ORIGINAL_FEATURE_CHICAGO_MCP
  }
})

describe('computer use source-first feature gate', () => {
  test('isChicagoFeatureEnabled is false by default in source-first tests', async () => {
    const { isChicagoFeatureEnabled } = await import('../gates.js')
    expect(isChicagoFeatureEnabled()).toBe(false)
  })

  test('isChicagoFeatureEnabled honors FEATURE_CHICAGO_MCP in source-first tests', async () => {
    process.env.FEATURE_CHICAGO_MCP = '1'
    const { isChicagoFeatureEnabled } = await import('../gates.js')
    expect(isChicagoFeatureEnabled()).toBe(true)
  })
})
