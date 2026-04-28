import { afterEach, expect, test } from 'bun:test'

import { isUltraplanFeatureEnabled } from '../ultraplanFeatureEnabled.js'

const ORIGINAL = process.env.FEATURE_ULTRAPLAN

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.FEATURE_ULTRAPLAN
  } else {
    process.env.FEATURE_ULTRAPLAN = ORIGINAL
  }
})

test('isUltraplanFeatureEnabled is false by default in source-first tests', () => {
  delete process.env.FEATURE_ULTRAPLAN
  expect(isUltraplanFeatureEnabled()).toBe(false)
})

test('isUltraplanFeatureEnabled honors FEATURE_ULTRAPLAN in source-first tests', () => {
  process.env.FEATURE_ULTRAPLAN = '1'
  expect(isUltraplanFeatureEnabled()).toBe(true)
})
