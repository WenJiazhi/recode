import axios from 'axios'
import isEqual from 'lodash-es/isEqual.js'
import {
  setCustomModelAliasMappings,
  type CustomModelAlias,
} from '../../bootstrap/state.js'
import {
  getAnthropicApiKey,
  getClaudeAIOAuthTokens,
  hasProfileScope,
} from 'src/utils/auth.js'
import { z } from 'zod'
import { getOauthConfig, OAUTH_BETA_HEADER } from '../../constants/oauth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logForDebugging } from '../../utils/debug.js'
import { withOAuth401Retry } from '../../utils/http.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { logError } from '../../utils/log.js'
import {
  persistModelCapabilities,
  type ModelCapability,
} from '../../utils/model/modelCapabilities.js'
import type { ModelOption } from '../../utils/model/modelOptions.js'
import {
  getAPIProvider,
  isCpaBaseUrl,
  isFirstPartyAnthropicBaseUrl,
} from '../../utils/model/providers.js'
import { isEssentialTrafficOnly } from '../../utils/privacyLevel.js'
import { getClaudeCodeUserAgent } from '../../utils/userAgent.js'

const bootstrapResponseSchema = lazySchema(() =>
  z.object({
    client_data: z.record(z.string(), z.unknown()).nullish(),
    additional_model_options: z
      .array(
        z
          .object({
            model: z.string(),
            name: z.string(),
            description: z.string(),
          })
          .transform(({ model, name, description }) => ({
            value: model,
            label: name,
            description,
          })),
      )
      .nullish(),
  }),
)

type BootstrapResponse = z.infer<ReturnType<typeof bootstrapResponseSchema>>

function normalizeModelOption(entry: unknown): ModelOption | null {
  if (typeof entry === 'string') {
    const id = entry.trim()
    if (!id) return null
    return {
      value: id,
      label: id,
      description: `Custom model (${id})`,
    }
  }

  if (!entry || typeof entry !== 'object') {
    return null
  }

  const raw = entry as Record<string, unknown>
  const id =
    typeof raw.id === 'string'
      ? raw.id
      : typeof raw.model === 'string'
        ? raw.model
        : typeof raw.name === 'string'
          ? raw.name
          : null

  if (!id || !id.trim()) {
    return null
  }

  return {
    value: id,
    label:
      typeof raw.display_name === 'string'
        ? raw.display_name
        : typeof raw.name === 'string'
          ? raw.name
          : id,
    description:
      typeof raw.description === 'string'
        ? raw.description
        : typeof raw.summary === 'string'
          ? raw.summary
          : `Custom model (${id})`,
  }
}

function normalizeCustomModelOptions(payload: unknown): ModelOption[] {
  let entries: unknown[] = []
  if (Array.isArray(payload)) {
    entries = payload
  } else if (payload && typeof payload === 'object') {
    const raw = payload as Record<string, unknown>
    if (Array.isArray(raw.data)) {
      entries = raw.data
    } else if (Array.isArray(raw.models)) {
      entries = raw.models
    } else if (Array.isArray(raw.items)) {
      entries = raw.items
    }
  }

  const deduped = new Map<string, ModelOption>()
  for (const entry of entries) {
    const normalized = normalizeModelOption(entry)
    if (!normalized) continue
    deduped.set(normalized.value, normalized)
  }
  return [...deduped.values()]
}

function parseCapabilityTokenSet(entry: Record<string, unknown>): Set<string> {
  const tokens = new Set<string>()
  const pushToken = (value: unknown) => {
    if (typeof value !== 'string') return
    const normalized = value.trim().toLowerCase()
    if (normalized) tokens.add(normalized)
  }

  const arrays: unknown[] = []
  if (Array.isArray(entry.supported_capabilities)) {
    arrays.push(...entry.supported_capabilities)
  }
  if (Array.isArray(entry.capabilities)) {
    arrays.push(...entry.capabilities)
  }
  if (typeof entry.supported_capabilities === 'string') {
    for (const part of entry.supported_capabilities.split(',')) {
      pushToken(part)
    }
  }
  if (entry.capabilities && typeof entry.capabilities === 'object') {
    const capabilityObject = entry.capabilities as Record<string, unknown>
    for (const [key, value] of Object.entries(capabilityObject)) {
      if (value === true) {
        pushToken(key)
      } else if (Array.isArray(value)) {
        for (const part of value) {
          pushToken(`${key}:${String(part)}`)
          pushToken(part)
        }
      }
    }
  }
  for (const item of arrays) {
    pushToken(item)
  }
  return tokens
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return undefined
}

function resolveCapabilityBoolean(
  entry: Record<string, unknown>,
  tokens: Set<string>,
  directKeys: string[],
  tokenKeys: string[],
): boolean | undefined {
  for (const key of directKeys) {
    const parsed = parseOptionalBoolean(entry[key])
    if (parsed !== undefined) {
      return parsed
    }
  }

  if (tokenKeys.some(token => tokens.has(token))) {
    return true
  }
  return undefined
}

function normalizeCustomModelCapabilities(payload: unknown): ModelCapability[] {
  let entries: unknown[] = []
  if (Array.isArray(payload)) {
    entries = payload
  } else if (payload && typeof payload === 'object') {
    const raw = payload as Record<string, unknown>
    if (Array.isArray(raw.data)) {
      entries = raw.data
    } else if (Array.isArray(raw.models)) {
      entries = raw.models
    } else if (Array.isArray(raw.items)) {
      entries = raw.items
    }
  }

  const deduped = new Map<string, ModelCapability>()
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const raw = entry as Record<string, unknown>
    const id =
      typeof raw.id === 'string'
        ? raw.id
        : typeof raw.model === 'string'
          ? raw.model
          : typeof raw.name === 'string'
            ? raw.name
            : null
    if (!id || !id.trim()) {
      continue
    }

    const tokens = parseCapabilityTokenSet(raw)
    const maxInputTokens =
      typeof raw.max_input_tokens === 'number'
        ? raw.max_input_tokens
        : typeof raw.context_window === 'number'
          ? raw.context_window
          : undefined
    const maxTokens =
      typeof raw.max_tokens === 'number'
        ? raw.max_tokens
        : typeof raw.max_output_tokens === 'number'
          ? raw.max_output_tokens
          : undefined

    deduped.set(id, {
      id,
      ...(maxInputTokens !== undefined
        ? { max_input_tokens: maxInputTokens }
        : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(resolveCapabilityBoolean(
        raw,
        tokens,
        ['supports_thinking', 'thinking'],
        ['thinking', 'reasoning', 'budget_tokens'],
      ) !== undefined
        ? {
            supports_thinking: resolveCapabilityBoolean(
              raw,
              tokens,
              ['supports_thinking', 'thinking'],
              ['thinking', 'reasoning', 'budget_tokens'],
            ),
          }
        : {}),
      ...(resolveCapabilityBoolean(
        raw,
        tokens,
        ['supports_adaptive_thinking', 'adaptive_thinking'],
        ['adaptive_thinking'],
      ) !== undefined
        ? {
            supports_adaptive_thinking: resolveCapabilityBoolean(
              raw,
              tokens,
              ['supports_adaptive_thinking', 'adaptive_thinking'],
              ['adaptive_thinking'],
            ),
          }
        : {}),
      ...(resolveCapabilityBoolean(
        raw,
        tokens,
        ['supports_effort', 'supports_reasoning_effort'],
        ['effort', 'reasoning_effort'],
      ) !== undefined
        ? {
            supports_effort: resolveCapabilityBoolean(
              raw,
              tokens,
              ['supports_effort', 'supports_reasoning_effort'],
              ['effort', 'reasoning_effort'],
            ),
          }
        : {}),
      ...(resolveCapabilityBoolean(
        raw,
        tokens,
        ['supports_max_effort'],
        ['max_effort'],
      ) !== undefined
        ? {
            supports_max_effort: resolveCapabilityBoolean(
              raw,
              tokens,
              ['supports_max_effort'],
              ['max_effort'],
            ),
          }
        : {}),
    })
  }

  return [...deduped.values()]
}

function scoreAliasCandidate(
  alias: CustomModelAlias,
  option: ModelOption,
  capability: ModelCapability | undefined,
): number {
  const haystack =
    `${option.value} ${option.label} ${option.description}`.toLowerCase()
  let score = 0

  if (haystack.includes(alias)) {
    score += 1000
  }

  if (alias === 'opus') {
    if (capability?.supports_max_effort) score += 500
    if (haystack.includes('4.6') || haystack.includes('4-6')) score += 80
    if (haystack.includes('4.5') || haystack.includes('4-5')) score += 70
  } else if (alias === 'sonnet') {
    if (capability?.supports_effort) score += 120
    if (capability?.supports_thinking) score += 60
    if (haystack.includes('4.6') || haystack.includes('4-6')) score += 80
    if (haystack.includes('4.5') || haystack.includes('4-5')) score += 70
    if (haystack.includes('3.7') || haystack.includes('3-7')) score += 40
  } else if (alias === 'haiku') {
    if (capability?.supports_thinking === false) score += 120
    if (capability?.supports_effort === false) score += 120
    if (haystack.includes('4.5') || haystack.includes('4-5')) score += 70
    if (haystack.includes('3.5') || haystack.includes('3-5')) score += 40
  }

  if (typeof capability?.max_input_tokens === 'number') {
    if (alias === 'opus') {
      score += Math.min(capability.max_input_tokens, 1_000_000) / 50_000
    } else if (alias === 'sonnet') {
      score += Math.min(capability.max_input_tokens, 1_000_000) / 100_000
    } else if (alias === 'haiku') {
      score -= Math.min(capability.max_input_tokens, 1_000_000) / 200_000
    }
  }

  return score
}

function selectCustomModelAliasMappings(
  options: ModelOption[],
  capabilities: ModelCapability[],
): Partial<Record<CustomModelAlias, ModelOption>> {
  const capabilityMap = new Map(capabilities.map(cap => [cap.id, cap]))
  const used = new Set<string>()
  const mappings: Partial<Record<CustomModelAlias, ModelOption>> = {}

  for (const alias of ['sonnet', 'opus', 'haiku'] as const) {
    const ranked = options
      .filter(option => !used.has(String(option.value)))
      .map(option => ({
        option,
        score: scoreAliasCandidate(
          alias,
          option,
          capabilityMap.get(String(option.value)),
        ),
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)

    const picked = ranked[0]?.option
    if (!picked) continue
    mappings[alias] = picked
    used.add(String(picked.value))
  }

  return mappings
}

async function fetchCustomBaseUrlModelOptionsAPI(): Promise<ModelOption[] | null> {
  if (isEssentialTrafficOnly()) {
    logForDebugging('[Bootstrap] Custom model fetch skipped: Nonessential traffic disabled')
    return null
  }

  if (getAPIProvider() !== 'firstParty') {
    logForDebugging('[Bootstrap] Custom model fetch skipped: 3P provider mode')
    return null
  }

  if (isFirstPartyAnthropicBaseUrl()) {
    logForDebugging('[Bootstrap] Custom model fetch skipped: first-party Anthropic base URL')
    return null
  }

  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return null
  }

  const apiKey = getAnthropicApiKey()
  const token = getClaudeAIOAuthTokens()?.accessToken
  if (!apiKey && !token) {
    logForDebugging('[Bootstrap] Custom model fetch skipped: no auth available')
    return null
  }

  const trimmedBaseUrl = baseUrl.replace(/\/+$/, '')
  const endpoint = trimmedBaseUrl.endsWith('/v1')
    ? `${trimmedBaseUrl}/models`
    : `${trimmedBaseUrl}/v1/models`

  try {
    logForDebugging(`[Bootstrap] Fetching custom model options from ${endpoint}`)
    const response = await axios.get<unknown>(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': getClaudeCodeUserAgent(),
        ...(apiKey
          ? { 'x-api-key': apiKey }
          : token
            ? { Authorization: `Bearer ${token}` }
            : {}),
      },
      timeout: 5000,
    })

    const options = normalizeCustomModelOptions(response.data)
    const capabilities = normalizeCustomModelCapabilities(response.data)
    setCustomModelAliasMappings(
      selectCustomModelAliasMappings(options, capabilities),
    )
    if (capabilities.length > 0) {
      await persistModelCapabilities(capabilities)
    }
    logForDebugging(
      `[Bootstrap] Custom model fetch ok (${options.length} option${options.length === 1 ? '' : 's'})`,
    )
    return options
  } catch (error) {
    logForDebugging(
      `[Bootstrap] Custom model fetch failed: ${axios.isAxiosError(error) ? (error.response?.status ?? error.code) : 'unknown'}`,
    )
    throw error
  }
}

async function fetchBootstrapAPI(): Promise<BootstrapResponse | null> {
  if (isEssentialTrafficOnly()) {
    logForDebugging('[Bootstrap] Skipped: Nonessential traffic disabled')
    return null
  }

  if (getAPIProvider() !== 'firstParty') {
    logForDebugging('[Bootstrap] Skipped: 3P provider')
    return null
  }

  if (!isFirstPartyAnthropicBaseUrl() || isCpaBaseUrl()) {
    logForDebugging(
      '[Bootstrap] Skipped: custom base URL provider uses /v1/models instead',
    )
    return null
  }

  // OAuth preferred (requires user:profile scope — service-key OAuth tokens
  // lack it and would 403). Fall back to API key auth for console users.
  const apiKey = getAnthropicApiKey()
  const hasUsableOAuth =
    getClaudeAIOAuthTokens()?.accessToken && hasProfileScope()
  if (!hasUsableOAuth && !apiKey) {
    logForDebugging('[Bootstrap] Skipped: no usable OAuth or API key')
    return null
  }

  const endpoint = `${getOauthConfig().BASE_API_URL}/api/claude_cli/bootstrap`

  // withOAuth401Retry handles the refresh-and-retry. API key users fail
  // through on 401 (no refresh mechanism — no OAuth token to pass).
  try {
    return await withOAuth401Retry(async () => {
      // Re-read OAuth each call so the retry picks up the refreshed token.
      const token = getClaudeAIOAuthTokens()?.accessToken
      let authHeaders: Record<string, string>
      if (token && hasProfileScope()) {
        authHeaders = {
          Authorization: `Bearer ${token}`,
          'anthropic-beta': OAUTH_BETA_HEADER,
        }
      } else if (apiKey) {
        authHeaders = { 'x-api-key': apiKey }
      } else {
        logForDebugging('[Bootstrap] No auth available on retry, aborting')
        return null
      }

      logForDebugging('[Bootstrap] Fetching')
      const response = await axios.get<unknown>(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': getClaudeCodeUserAgent(),
          ...authHeaders,
        },
        timeout: 5000,
      })
      const parsed = bootstrapResponseSchema().safeParse(response.data)
      if (!parsed.success) {
        logForDebugging(
          `[Bootstrap] Response failed validation: ${parsed.error.message}`,
        )
        return null
      }
      logForDebugging('[Bootstrap] Fetch ok')
      return parsed.data
    })
  } catch (error) {
    logForDebugging(
      `[Bootstrap] Fetch failed: ${axios.isAxiosError(error) ? (error.response?.status ?? error.code) : 'unknown'}`,
    )
    throw error
  }
}

/**
 * Fetch bootstrap data from the API and persist to disk cache.
 */
export async function fetchBootstrapData(): Promise<void> {
  let response: BootstrapResponse | null = null
  try {
    response = await fetchBootstrapAPI()
  } catch (error) {
    logError(error)
  }

  let customModelOptions: ModelOption[] | null = null
  try {
    customModelOptions = await fetchCustomBaseUrlModelOptionsAPI()
  } catch (error) {
    logError(error)
  }

  try {
    if (!response && customModelOptions === null) return

    const config = getGlobalConfig()
    const clientData =
      response !== null ? (response.client_data ?? null) : config.clientDataCache
    const additionalModelOptions =
      customModelOptions ??
      (response !== null
        ? (response.additional_model_options ?? [])
        : (config.additionalModelOptionsCache ?? []))

    // Only persist if data actually changed — avoids a config write on every startup.
    if (
      isEqual(config.clientDataCache, clientData) &&
      isEqual(config.additionalModelOptionsCache, additionalModelOptions)
    ) {
      logForDebugging('[Bootstrap] Cache unchanged, skipping write')
      return
    }

    logForDebugging('[Bootstrap] Cache updated, persisting to disk')
    saveGlobalConfig(current => ({
      ...current,
      clientDataCache: clientData,
      additionalModelOptionsCache: additionalModelOptions,
    }))
  } catch (error) {
    logError(error)
  }
}
