import { afterEach, describe, expect, test } from 'bun:test'
import { getConfiguredCustomModelOptionsFromEnv } from '../model/customModelAliasMappings.js'

const MODEL_ENV_KEYS = [
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL_NAME',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL_NAME',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME',
  'ANTHROPIC_DEFAULT_FABLE_MODEL',
  'ANTHROPIC_DEFAULT_FABLE_MODEL_NAME',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_CUSTOM_MODEL_OPTION',
  'ANTHROPIC_CUSTOM_MODEL_OPTION_NAME',
] as const

const originalEnv = Object.fromEntries(
  MODEL_ENV_KEYS.map(key => [key, process.env[key]]),
)

afterEach(() => {
  for (const key of MODEL_ENV_KEYS) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('configured custom model options', () => {
  test('uses active Claude mappings when /v1/models discovery is unavailable', () => {
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = 'grok-4.5-console[1M]'
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME = 'Grok Console'
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = 'grok-4.5-console[1M]'
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = 'grok-4.5-console'
    process.env.ANTHROPIC_MODEL = 'grok-4.5-console'

    expect(getConfiguredCustomModelOptionsFromEnv()).toEqual([
      {
        value: 'grok-4.5-console',
        label: 'Grok Console',
        description: 'Configured model from ANTHROPIC_DEFAULT_OPUS_MODEL',
        descriptionForModel: 'Configured model (grok-4.5-console)',
      },
    ])
  })
})
