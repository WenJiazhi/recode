import {
  getCustomModelAliasMappings as getAutoCustomModelAliasMappings,
  type CustomModelAlias,
} from '../../bootstrap/state.js'
import { getGlobalConfig } from '../config.js'
import { getSettings_DEPRECATED } from '../settings/settings.js'
import type { SettingsJson } from '../settings/types.js'
import { getAPIProvider, isFirstPartyAnthropicBaseUrl } from './providers.js'
import type { ModelOption } from './modelOptions.js'

export const CUSTOM_MODEL_ALIAS_ORDER = [
  'opus',
  'sonnet',
  'haiku',
] as const satisfies readonly CustomModelAlias[]

export const CUSTOM_MODEL_THINKING_PRESETS = [
  'auto',
  'xhigh',
  'high',
  'medium',
  'low',
  'minimal',
  'none',
] as const

export type CustomModelThinkingPreset =
  (typeof CUSTOM_MODEL_THINKING_PRESETS)[number]
export type CustomModelThinkingValue = CustomModelThinkingPreset | number

export type PersistedCustomModelAliasMapping = {
  model: string
  thinking?: CustomModelThinkingValue
}

export type PersistedCustomModelAliasMappings = Partial<
  Record<CustomModelAlias, PersistedCustomModelAliasMapping>
>

export function isCustomModelAliasMappingHost(): boolean {
  return getAPIProvider() === 'firstParty' && !isFirstPartyAnthropicBaseUrl()
}

export function getPersistedCustomModelAliasMappings(
  settings: SettingsJson | null = getSettings_DEPRECATED() || {},
): PersistedCustomModelAliasMappings {
  if (!settings?.customModelAliasMappings) {
    return {}
  }
  return settings.customModelAliasMappings
}

export function formatModelWithThinkingSuffix(
  model: string,
  thinking?: CustomModelThinkingValue,
): string {
  const normalizedModel = stripTrailingThinkingSuffix(model)
  if (thinking === undefined) {
    return normalizedModel
  }
  return `${normalizedModel}(${thinking})`
}

export function stripTrailingThinkingSuffix(model: string): string {
  return model.replace(/\([^()]*\)\s*$/u, '').trim()
}

export function getDiscoveredCustomModelOptions(): ModelOption[] {
  const options = new Map<string, ModelOption>()
  for (const option of getGlobalConfig().additionalModelOptionsCache ?? []) {
    options.set(String(option.value), option)
  }
  for (const option of getConfiguredCustomModelOptionsFromEnv()) {
    if (!options.has(String(option.value))) {
      options.set(String(option.value), option)
    }
  }
  return [...options.values()]
}

const CONFIGURED_MODEL_ENV_KEYS = [
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_FABLE_MODEL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_CUSTOM_MODEL_OPTION',
] as const

function stripConfiguredModelDecorators(model: string): string {
  let normalized = model.trim()
  for (let pass = 0; pass < 2; pass++) {
    normalized = stripTrailingThinkingSuffix(normalized)
      .replace(/\[(?:1|2)m]$/i, '')
      .trim()
  }
  return normalized
}

export function getConfiguredCustomModelOptionsFromEnv(): ModelOption[] {
  const options = new Map<string, ModelOption>()

  for (const key of CONFIGURED_MODEL_ENV_KEYS) {
    const rawModel = process.env[key]
    if (!rawModel) continue

    const model = stripConfiguredModelDecorators(rawModel)
    if (!model || options.has(model)) continue

    const name = process.env[`${key}_NAME`]?.trim()
    options.set(model, {
      value: model,
      label: name || model,
      description: `Configured model from ${key}`,
      descriptionForModel: `Configured model (${model})`,
    })
  }

  return [...options.values()]
}

function getManualAliasOption(
  alias: CustomModelAlias,
): ModelOption | undefined {
  const persisted = getPersistedCustomModelAliasMappings()[alias]
  if (!persisted?.model) {
    return undefined
  }
  const baseModel = stripTrailingThinkingSuffix(persisted.model)
  const discovered = getDiscoveredCustomModelOptions().find(
    option => option.value === baseModel,
  )
  const thinkingSuffix =
    persisted.thinking !== undefined ? ` (${persisted.thinking})` : ''

  if (discovered) {
    return {
      value: discovered.value,
      label: discovered.label,
      description: `${discovered.description}${thinkingSuffix}`,
      descriptionForModel:
        discovered.descriptionForModel ??
        `${discovered.description} (${discovered.value})`,
    }
  }

  return {
    value: baseModel,
    label: baseModel,
    description: `Custom mapped model${thinkingSuffix}`,
    descriptionForModel: `${baseModel}${thinkingSuffix}`,
  }
}

export function getEffectiveCustomModelAliasOption(
  alias: CustomModelAlias,
): ModelOption | undefined {
  return getManualAliasOption(alias) ?? getAutoCustomModelAliasMappings()[alias]
}

export function getEffectiveCustomModelAliasValue(
  alias: CustomModelAlias,
): string | undefined {
  if (!isCustomModelAliasMappingHost()) {
    return undefined
  }

  const persisted = getPersistedCustomModelAliasMappings()[alias]
  if (persisted?.model) {
    return formatModelWithThinkingSuffix(persisted.model, persisted.thinking)
  }

  const autoMapped = getAutoCustomModelAliasMappings()[alias]
  return autoMapped?.value
}

export function renderCustomModelAliasSummary(
  alias: CustomModelAlias,
): string {
  const persisted = getPersistedCustomModelAliasMappings()[alias]
  const label = alias[0]!.toUpperCase() + alias.slice(1)
  if (persisted?.model) {
    const display = formatModelWithThinkingSuffix(
      persisted.model,
      persisted.thinking,
    )
    return `${label}: ${display}`
  }

  const autoMapped = getAutoCustomModelAliasMappings()[alias]
  if (autoMapped) {
    return `${label}: ${autoMapped.value} (auto-discovered)`
  }

  return `${label}: not configured`
}
