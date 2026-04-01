import type { LocalCommandCall } from '../../types/command.js'
import {
  CUSTOM_MODEL_ALIAS_ORDER,
  renderCustomModelAliasSummary,
} from '../../utils/model/customModelAliasMappings.js'
import { persistPortableSettingsOrFallback } from '../../utils/portableProviderConfig.js'

const CONTEXT_ENV_KEY = 'CLAUDE_CODE_MAX_CONTEXT_TOKENS'

function parseContextOverride(raw: string): number | null {
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.endsWith('k')) {
    const value = Number.parseInt(normalized.slice(0, -1), 10)
    return Number.isFinite(value) && value > 0 ? value * 1000 : null
  }
  const value = Number.parseInt(normalized, 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

export const call: LocalCommandCall = async (args) => {
  const normalizedArgs = args.trim().toLowerCase()

  if (
    normalizedArgs === '' ||
    normalizedArgs === 'help' ||
    normalizedArgs === '-h' ||
    normalizedArgs === '--help'
  ) {
    return {
      type: 'text',
      value:
        'Usage: /model-map [status|reset|context <tokens|258k>|context reset]\n\nThe interactive mapping wizard is only available in the full REPL. In non-interactive mode, use /model-map status, /model-map reset, /model-map context 258k, or /model-map context reset.',
    }
  }

  if (normalizedArgs === 'status' || normalizedArgs === 'current') {
    const contextOverride = process.env[CONTEXT_ENV_KEY]
    return {
      type: 'text',
      value: [
        ...CUSTOM_MODEL_ALIAS_ORDER.map(renderCustomModelAliasSummary),
        `Context cap -> ${contextOverride ? `${contextOverride} tokens` : 'default'}`,
      ].join('\n'),
    }
  }

  if (normalizedArgs === 'reset' || normalizedArgs === 'clear') {
    const result = persistPortableSettingsOrFallback({
      customModelAliasMappings: undefined,
    })
    return {
      type: 'text',
      value: result.error
        ? `Failed to reset custom alias mappings: ${result.error.message}`
        : 'Cleared custom alias mappings.',
    }
  }

  if (
    normalizedArgs === 'context reset' ||
    normalizedArgs === 'context clear'
  ) {
    const result = persistPortableSettingsOrFallback({
      env: {
        [CONTEXT_ENV_KEY]: undefined,
      },
    })
    delete process.env[CONTEXT_ENV_KEY]
    return {
      type: 'text',
      value: result.error
        ? `Failed to reset context cap: ${result.error.message}`
        : 'Cleared context cap override.',
    }
  }

  if (normalizedArgs.startsWith('context ')) {
    const parsed = parseContextOverride(normalizedArgs.slice('context '.length))
    if (!parsed) {
      return {
        type: 'text',
        value: 'Invalid context cap. Use a positive token count such as 258000 or 258k.',
      }
    }
    const result = persistPortableSettingsOrFallback({
      env: {
        [CONTEXT_ENV_KEY]: String(parsed),
      },
    })
    if (!result.error) {
      process.env[CONTEXT_ENV_KEY] = String(parsed)
    }
    return {
      type: 'text',
      value: result.error
        ? `Failed to save context cap: ${result.error.message}`
        : `Saved context cap override: ${parsed} tokens.`,
    }
  }

  return {
    type: 'text',
    value:
      'The /model-map wizard needs the interactive REPL. Use /model-map status, /model-map reset, /model-map context 258k, or launch recode without -p.',
  }
}
