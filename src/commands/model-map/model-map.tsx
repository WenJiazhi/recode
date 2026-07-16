import { c as _c } from "react/compiler-runtime";
import chalk from 'chalk'
import * as React from 'react'
import { Box, Text } from '../../ink.js'
import type { CommandResultDisplay } from '../../commands.js'
import { Select, type OptionWithDescription } from '../../components/CustomSelect/index.js'
import { Byline } from '../../components/design-system/Byline.js'
import { KeyboardShortcutHint } from '../../components/design-system/KeyboardShortcutHint.js'
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js'
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { persistPortableSettingsOrFallback } from '../../utils/portableProviderConfig.js'
import { readLocalProviderConfig } from '../../utils/portableProviderConfig.js'
import type { SettingsJson } from '../../utils/settings/types.js'
import {
  CUSTOM_MODEL_ALIAS_ORDER,
  CUSTOM_MODEL_THINKING_PRESETS,
  type CustomModelThinkingValue,
  getDiscoveredCustomModelOptions,
  getPersistedCustomModelAliasMappings,
  isCustomModelAliasMappingHost,
  renderCustomModelAliasSummary,
  stripTrailingThinkingSuffix,
} from '../../utils/model/customModelAliasMappings.js'

type AliasName = (typeof CUSTOM_MODEL_ALIAS_ORDER)[number]

type WizardSelection = {
  model: string
  thinking: CustomModelThinkingValue
}

type WizardSelections = Record<AliasName, WizardSelection>

type WizardStep =
  | { kind: 'target' }
  | { kind: 'model'; alias: AliasName; index: number }
  | { kind: 'thinking'; alias: AliasName; index: number }
  | { kind: 'confirm' }

type PersistTarget = 'portableConfig' | 'userSettings'
const CONTEXT_ENV_KEY = 'CLAUDE_CODE_MAX_CONTEXT_TOKENS'

function defaultSelectionForAlias(alias: AliasName): WizardSelection {
  const persisted = getPersistedCustomModelAliasMappings()[alias]
  const firstDiscovered = getDiscoveredCustomModelOptions()[0]?.value ?? ''
  return {
    model: stripTrailingThinkingSuffix(persisted?.model ?? firstDiscovered),
    thinking: persisted?.thinking ?? 'auto',
  }
}

function createInitialSelections(): WizardSelections {
  return {
    opus: defaultSelectionForAlias('opus'),
    sonnet: defaultSelectionForAlias('sonnet'),
    haiku: defaultSelectionForAlias('haiku'),
  }
}

function formatAliasName(alias: AliasName): string {
  return alias[0]!.toUpperCase() + alias.slice(1)
}

function formatSummary(selections: WizardSelections): string {
  return CUSTOM_MODEL_ALIAS_ORDER.map(alias => {
    const selected = selections[alias]
    return `${formatAliasName(alias)} -> ${selected.model} (${selected.thinking})`
  }).join('\n')
}

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

function getThinkingOptions(): OptionWithDescription<string>[] {
  return CUSTOM_MODEL_THINKING_PRESETS.map(value => ({
    value,
    label: value === 'xhigh' ? 'xhigh' : value,
    description:
      value === 'auto'
        ? 'Let the upstream router decide.'
        : value === 'none'
          ? 'Disable router-level thinking when supported.'
          : value === 'minimal'
            ? 'Lowest deliberate reasoning budget.'
            : value === 'xhigh'
              ? 'Deepest router-level reasoning.'
              : `${value} router-level thinking preset.`,
  }))
}

function persistSelections(
  selections: WizardSelections,
  target: PersistTarget,
): { error?: Error; saved: SettingsJson } {
  const saved: SettingsJson = {
    customModelAliasMappings: {
      opus: selections.opus,
      sonnet: selections.sonnet,
      haiku: selections.haiku,
    },
  }
  const result = persistPortableSettingsOrFallback(saved, process.cwd(), target)
  return { error: result.error ?? undefined, saved }
}

function StatusAndClose({
  onDone,
}: {
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
}): React.ReactNode {
  const persisted = getPersistedCustomModelAliasMappings()
  const contextOverride = process.env[CONTEXT_ENV_KEY]
  const header = persisted.opus || persisted.sonnet || persisted.haiku
    ? 'Current custom alias mappings:'
    : 'No custom alias mappings saved. Auto-discovery fallback:'
  onDone(
    `${header}\n${CUSTOM_MODEL_ALIAS_ORDER.map(renderCustomModelAliasSummary).join('\n')}\nContext cap -> ${contextOverride ? `${contextOverride} tokens` : 'default'}`,
    { display: 'system' },
  )
  return null
}

function ResetAndClose({
  onDone,
}: {
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
}): React.ReactNode {
  React.useEffect(() => {
    const result = persistPortableSettingsOrFallback({
      customModelAliasMappings: undefined,
    })
    if (result.error) {
      onDone(`Failed to reset custom alias mappings: ${result.error.message}`, {
        display: 'system',
      })
      return
    }
    onDone('Cleared custom alias mappings. Alias resolution will fall back to auto-discovery.', {
      display: 'system',
    })
  }, [onDone])
  return null
}

function ModelMapWizard({
  onDone,
}: {
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
}): React.ReactNode {
  const $ = _c(23)
  const exitState = useExitOnCtrlCDWithKeybindings()
  const discoveredOptions = getDiscoveredCustomModelOptions()
  const hasPortableConfig = Boolean(readLocalProviderConfig().config)
  const [stepIndex, setStepIndex] = React.useState(0)
  const [selections, setSelections] = React.useState(createInitialSelections)
  const [persistTarget, setPersistTarget] =
    React.useState<PersistTarget>(
      hasPortableConfig ? 'portableConfig' : 'userSettings',
    )

  if (!isCustomModelAliasMappingHost()) {
    onDone(
      'Custom alias mapping is only available when using a custom ANTHROPIC_BASE_URL on the first-party provider path.',
      { display: 'system' },
    )
    return null
  }

  if (discoveredOptions.length === 0) {
    onDone(
      'No models are available from /v1/models or the active Claude-compatible configuration.',
      { display: 'system' },
    )
    return null
  }

  const steps: WizardStep[] = [
    ...(hasPortableConfig ? [{ kind: 'target' as const }] : []),
    { kind: 'model', alias: 'opus', index: 1 },
    { kind: 'thinking', alias: 'opus', index: 2 },
    { kind: 'model', alias: 'sonnet', index: 3 },
    { kind: 'thinking', alias: 'sonnet', index: 4 },
    { kind: 'model', alias: 'haiku', index: 5 },
    { kind: 'thinking', alias: 'haiku', index: 6 },
    { kind: 'confirm' },
  ]
  const step = steps[stepIndex]!

  const handleCancel = () => {
    if (stepIndex === 0) {
      onDone('Cancelled custom alias mapping wizard.', { display: 'system' })
      return
    }
    setStepIndex(prev => prev - 1)
  }

  if (step.kind === 'target') {
    const targetOptions: OptionWithDescription<PersistTarget>[] = [
      {
        value: 'portableConfig',
        label: 'Project config',
        description:
          'Save mappings into .recode/local-provider.json for portable use.',
      },
      {
        value: 'userSettings',
        label: 'Legacy global mode',
        description:
          'Save mappings into the existing user settings path instead.',
      },
    ]
    return (
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text color="remember" bold={true}>
            Choose mapping storage
          </Text>
          <Text dimColor={true}>
            Pick where /model-map should persist the alias mappings.
          </Text>
        </Box>
        <Select
          options={targetOptions}
          defaultValue={persistTarget}
          defaultFocusValue={persistTarget}
          onChange={value => {
            setPersistTarget(value)
            setStepIndex(prev => prev + 1)
          }}
          onCancel={() =>
            onDone('Cancelled custom alias mapping wizard.', {
              display: 'system',
            })
          }
        />
        <Text dimColor={true} italic={true}>
          <Byline>
            <KeyboardShortcutHint shortcut="Enter" action="select" />
            <ConfigurableShortcutHint
              action="select:cancel"
              context="Select"
              fallback="Esc"
              description="exit"
            />
          </Byline>
        </Text>
      </Box>
    )
  }

  if (step.kind === 'confirm') {
    const confirmOptions: OptionWithDescription<string>[] = [
      {
        value: 'save',
        label: 'Save mappings',
        description: 'Persist all three alias mappings to user settings.',
      },
      {
        value: 'cancel',
        label: 'Cancel',
        description: 'Leave the existing mappings unchanged.',
      },
    ]
    return (
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text color="remember" bold={true}>Confirm alias mappings</Text>
          <Text dimColor={true}>
            Review all three aliases before saving.
          </Text>
        </Box>
        <Box marginBottom={1} flexDirection="column">
          {CUSTOM_MODEL_ALIAS_ORDER.map(alias => (
            <Text key={alias}>
              {formatAliasName(alias)}: {selections[alias].model} ({String(selections[alias].thinking)})
            </Text>
          ))}
        </Box>
        <Select
          options={confirmOptions}
          onChange={value => {
            if (value === 'cancel') {
              onDone('Cancelled custom alias mapping wizard.', {
                display: 'system',
              })
              return
            }
            const result = persistSelections(selections, persistTarget)
            if (result.error) {
              onDone(
                `Failed to save custom alias mappings: ${result.error.message}`,
                { display: 'system' },
              )
              return
            }
            onDone(
              `Saved custom alias mappings to ${persistTarget === 'portableConfig' ? '.recode/local-provider.json' : 'user settings'}:\n${formatSummary(selections)}`,
              { display: 'system' },
            )
          }}
          onCancel={handleCancel}
        />
        <Text dimColor={true} italic={true}>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : (
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint
                action="select:cancel"
                context="Select"
                fallback="Esc"
                description="back"
              />
            </Byline>
          )}
        </Text>
      </Box>
    )
  }

  if (step.kind === 'model') {
    const alias = step.alias
    const selectOptions: OptionWithDescription<string>[] = discoveredOptions.map(
      option => ({
        value: String(option.value),
        label: option.label,
        description:
          option.descriptionForModel ??
          `${option.description} (${String(option.value)})`,
      }),
    )
    const currentValue = selections[alias].model
    return (
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text color="remember" bold={true}>
            {step.index}/6 Choose {formatAliasName(alias)} model
          </Text>
          <Text dimColor={true}>
            Pick a discovered model for the {formatAliasName(alias)} alias.
          </Text>
        </Box>
        <Select
          options={selectOptions}
          defaultValue={currentValue}
          defaultFocusValue={currentValue}
          visibleOptionCount={10}
          onChange={value => {
            setSelections(prev => ({
              ...prev,
              [alias]: {
                ...prev[alias],
                model: value,
              },
            }))
            setStepIndex(prev => prev + 1)
          }}
          onCancel={handleCancel}
        />
        <Text dimColor={true} italic={true}>
          <Byline>
            <KeyboardShortcutHint shortcut="Enter" action="select" />
            <ConfigurableShortcutHint
              action="select:cancel"
              context="Select"
              fallback="Esc"
              description={stepIndex === 0 ? 'exit' : 'back'}
            />
          </Byline>
        </Text>
      </Box>
    )
  }

  const alias = step.alias
  const selectOptions = getThinkingOptions()
  const currentValue = String(selections[alias].thinking)
  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text color="remember" bold={true}>
          {step.index}/6 Choose {formatAliasName(alias)} thinking
        </Text>
        <Text dimColor={true}>
          Select the router-level thinking preset to append after the model name.
        </Text>
        <Text dimColor={true}>
          Current model: {chalk.bold(selections[alias].model)}
        </Text>
      </Box>
      <Select
        options={selectOptions}
        defaultValue={currentValue}
        defaultFocusValue={currentValue}
        onChange={value => {
          setSelections(prev => ({
            ...prev,
            [alias]: {
              ...prev[alias],
              thinking: value as CustomModelThinkingValue,
            },
          }))
          setStepIndex(prev => prev + 1)
        }}
        onCancel={handleCancel}
      />
      <Text dimColor={true} italic={true}>
        <Byline>
          <KeyboardShortcutHint shortcut="Enter" action="select" />
          <ConfigurableShortcutHint
            action="select:cancel"
            context="Select"
            fallback="Esc"
            description="back"
          />
        </Byline>
      </Text>
    </Box>
  )
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const normalizedArgs = args?.trim().toLowerCase() ?? ''
  if (normalizedArgs === 'help' || normalizedArgs === '-h' || normalizedArgs === '--help') {
    onDone(
      'Usage: /model-map [status|reset|context <tokens|258k>|context reset]\n\nInteractive mode can first choose project config or legacy global mode, then walks Opus -> Sonnet -> Haiku. Each alias first chooses a discovered model, then a router thinking preset.',
      { display: 'system' },
    )
    return
  }
  if (normalizedArgs === 'context reset' || normalizedArgs === 'context clear') {
    const result = persistPortableSettingsOrFallback({
      env: {
        [CONTEXT_ENV_KEY]: undefined,
      },
    })
    delete process.env[CONTEXT_ENV_KEY]
    onDone(
      result.error
        ? `Failed to reset context cap: ${result.error.message}`
        : 'Cleared context cap override.',
      { display: 'system' },
    )
    return
  }
  if (normalizedArgs.startsWith('context ')) {
    const parsed = parseContextOverride(normalizedArgs.slice('context '.length))
    if (!parsed) {
      onDone(
        'Invalid context cap. Use a positive token count such as 258000 or 258k.',
        { display: 'system' },
      )
      return
    }
    const result = persistPortableSettingsOrFallback({
      env: {
        [CONTEXT_ENV_KEY]: String(parsed),
      },
    })
    if (!result.error) {
      process.env[CONTEXT_ENV_KEY] = String(parsed)
    }
    onDone(
      result.error
        ? `Failed to save context cap: ${result.error.message}`
        : `Saved context cap override: ${parsed} tokens.`,
      { display: 'system' },
    )
    return
  }
  if (normalizedArgs === 'status' || normalizedArgs === 'current') {
    return <StatusAndClose onDone={onDone} />
  }
  if (normalizedArgs === 'reset' || normalizedArgs === 'clear') {
    return <ResetAndClose onDone={onDone} />
  }
  return <ModelMapWizard onDone={onDone} />
}
