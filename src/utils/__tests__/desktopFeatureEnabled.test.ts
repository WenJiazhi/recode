import { afterEach, describe, expect, test } from 'bun:test'
import { isExtractMemoriesFeatureEnabled } from '../extractMemoriesFeatureEnabled.js'
import { isLodestoneFeatureEnabled } from '../lodestoneFeatureEnabled.js'

const ORIGINAL_EXTRACT_MEMORIES = process.env.FEATURE_EXTRACT_MEMORIES
const ORIGINAL_LODESTONE = process.env.FEATURE_LODESTONE

afterEach(() => {
  if (ORIGINAL_EXTRACT_MEMORIES === undefined) {
    delete process.env.FEATURE_EXTRACT_MEMORIES
  } else {
    process.env.FEATURE_EXTRACT_MEMORIES = ORIGINAL_EXTRACT_MEMORIES
  }

  if (ORIGINAL_LODESTONE === undefined) {
    delete process.env.FEATURE_LODESTONE
  } else {
    process.env.FEATURE_LODESTONE = ORIGINAL_LODESTONE
  }
})

describe('desktop/memory feature helpers', () => {
  test('enables EXTRACT_MEMORIES from source-first env fallback', () => {
    process.env.FEATURE_EXTRACT_MEMORIES = '1'
    expect(isExtractMemoriesFeatureEnabled()).toBe(true)
  })

  test('enables LODESTONE from source-first env fallback', () => {
    process.env.FEATURE_LODESTONE = '1'
    expect(isLodestoneFeatureEnabled()).toBe(true)
  })
})
