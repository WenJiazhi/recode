import { afterEach, expect, test } from 'bun:test'
import { isAwaySummaryFeatureEnabled } from '../awaySummaryFeatureEnabled.js'

const ORIGINAL_FEATURE_AWAY_SUMMARY = process.env.FEATURE_AWAY_SUMMARY

afterEach(() => {
  if (ORIGINAL_FEATURE_AWAY_SUMMARY === undefined) {
    delete process.env.FEATURE_AWAY_SUMMARY
  } else {
    process.env.FEATURE_AWAY_SUMMARY = ORIGINAL_FEATURE_AWAY_SUMMARY
  }
})

test('isAwaySummaryFeatureEnabled is false by default in source-first tests', () => {
  delete process.env.FEATURE_AWAY_SUMMARY
  expect(isAwaySummaryFeatureEnabled()).toBe(false)
})

test('isAwaySummaryFeatureEnabled honors FEATURE_AWAY_SUMMARY in source-first tests', () => {
  process.env.FEATURE_AWAY_SUMMARY = '1'
  expect(isAwaySummaryFeatureEnabled()).toBe(true)
})
