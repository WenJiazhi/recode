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
  if (thinking === undefined || thinking === null || thinking === '') {
    return normalizedModel
  }
  return `${normalizedModel}(${thinking})`
}

export function stripTrailingThinkingSuffix(model: string): string {
  return model.replace(/\([^()]*\)\s*$/u, '').trim()
}

export function getDiscoveredCustomModelOptions(): ModelOption[] {
  return getGlobalConfig().additionalModelOptionsCache ?? []
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
