import { afterEach, describe, expect, test } from 'bun:test'
import {
  getMainLoopModelOverride,
  setMainLoopModelOverride,
} from '../../bootstrap/state.js'
import type { AppState } from '../../state/AppStateStore.js'
import { onChangeAppState } from '../../state/onChangeAppState.js'
import { modelSupportsEffort } from '../effort.js'
import {
  getDefaultMainLoopModel,
  getMainLoopModel,
  parseUserSpecifiedModel,
} from '../model/model.js'
import { getModelOptions } from '../model/modelOptions.js'

const originalModel = process.env.ANTHROPIC_MODEL
const originalHaiku = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
const originalOpus = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
const originalSonnet = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
const originalBaseUrl = process.env.ANTHROPIC_BASE_URL

afterEach(() => {
  setMainLoopModelOverride(undefined)
  if (originalModel === undefined) delete process.env.ANTHROPIC_MODEL
  else process.env.ANTHROPIC_MODEL = originalModel
  if (originalHaiku === undefined)
    delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
  else process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = originalHaiku
  if (originalOpus === undefined)
    delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
  else process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = originalOpus
  if (originalSonnet === undefined)
    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
  else process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = originalSonnet
  if (originalBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL
  else process.env.ANTHROPIC_BASE_URL = originalBaseUrl
})

describe('session model selection', () => {
  test('AppState model changes update the session override', () => {
    const settings = {}
    const oldState = {
      toolPermissionContext: { mode: 'default' },
      mainLoopModel: 'claude-fable-5',
      expandedView: 'none',
      verbose: false,
      settings,
    } as AppState
    const newState = { ...oldState, mainLoopModel: 'haiku' } as AppState

    onChangeAppState({ oldState, newState })

    expect(getMainLoopModelOverride()).toBe('haiku')
  })

  test('selected Haiku overrides a pinned default model', () => {
    process.env.ANTHROPIC_MODEL = 'claude-fable-5'
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = 'qwen3.7-max'

    setMainLoopModelOverride('haiku')

    expect(getMainLoopModelOverride()).toBe('haiku')
    expect(getMainLoopModel()).toBe('qwen3.7-max')
  })

  test('selected Opus resolves through the configured family mapping', () => {
    process.env.ANTHROPIC_MODEL = 'claude-fable-5'
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = 'provider-opus-model'

    setMainLoopModelOverride('opus')

    expect(getMainLoopModel()).toBe('provider-opus-model')
  })

  test('custom provider picker preserves semantic model routes', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://custom-provider.example'
    process.env.ANTHROPIC_MODEL = 'claude-fable-5'
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = 'claude-fable-5'
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = 'claude-fable-5'
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = 'qwen3.7-max'

    const options = getModelOptions()
    const resolvedModels = options.map(option =>
      parseUserSpecifiedModel(option.value!),
    )

    expect(resolvedModels).toEqual([
      'claude-fable-5',
      'claude-fable-5',
      'claude-fable-5',
      'qwen3.7-max',
    ])
    expect(options.map(option => option.label)).toEqual([
      'Default',
      'Opus',
      'Sonnet',
      'Haiku',
    ])
  })

  test('configured 1M family models do not duplicate context suffixes', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://custom-provider.example'
    process.env.ANTHROPIC_MODEL = 'claude-opus-4-8'
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = 'claude-opus-4-8[1M]'
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = 'claude-opus-4-8[1M]'
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = 'claude-opus-4-8'

    expect(parseUserSpecifiedModel('sonnet[1m]')).toBe('claude-opus-4-8[1m]')
    expect(parseUserSpecifiedModel('opus[1m]')).toBe('claude-opus-4-8[1m]')
    const options = getModelOptions()
    expect(options.map(option => option.label)).toEqual([
      'Default',
      'Opus',
      'Sonnet',
      'Haiku',
    ])
    expect(options.map(option => option.description)).toEqual([
      'claude-opus-4-8 · Configured default route',
      'claude-opus-4-8[1M] · Configured opus route',
      'claude-opus-4-8[1M] · Configured sonnet route',
      'claude-opus-4-8 · Configured haiku route',
    ])
  })

  test('custom Anthropic-compatible models allow effort by default', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://custom-provider.example'

    expect(modelSupportsEffort('claude-opus-4-8[1m]')).toBe(true)
  })
})
