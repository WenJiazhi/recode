import { describe, expect, test } from 'bun:test'
import { deduplicateSkillFrontmatter } from '../analyzeContext.js'

describe('deduplicateSkillFrontmatter', () => {
  test('removes duplicate skill rows with the same source and name', () => {
    const result = deduplicateSkillFrontmatter([
      { name: 'frontend-design', source: 'plugin', tokens: 67 },
      { name: 'frontend-design', source: 'plugin', tokens: 108 },
      { name: 'skill-creator', source: 'plugin', tokens: 64 },
    ])

    expect(result).toEqual([
      { name: 'frontend-design', source: 'plugin', tokens: 67 },
      { name: 'skill-creator', source: 'plugin', tokens: 64 },
    ])
  })

  test('keeps same-name skills when they come from different sources', () => {
    const result = deduplicateSkillFrontmatter([
      { name: 'setup', source: 'plugin', tokens: 26 },
      { name: 'setup', source: 'localSettings', tokens: 31 },
    ])

    expect(result).toEqual([
      { name: 'setup', source: 'plugin', tokens: 26 },
      { name: 'setup', source: 'localSettings', tokens: 31 },
    ])
  })
})
