import * as React from 'react';
import { useMemo, useState } from 'react';
import { dirname, resolve } from 'path';
import { ModelPicker } from '../../components/ModelPicker.js';
import { Select, type OptionWithDescription } from '../../components/CustomSelect/index.js';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js';
import { Byline } from '../../components/design-system/Byline.js';
import { KeyboardShortcutHint } from '../../components/design-system/KeyboardShortcutHint.js';
import { Pane } from '../../components/design-system/Pane.js';
import { Tab, Tabs, useTabHeaderFocus } from '../../components/design-system/Tabs.js';
import { Box, Text } from '../../ink.js';
import { useKeybindings } from '../../keybindings/useKeybinding.js';
import { useAppState, useSetAppState } from '../../state/AppState.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
import type { EffortLevel } from '../../utils/effort.js';
import { type ExternalProviderCatalogEntry, listExternalProviderCatalog } from '../../utils/externalProviderCatalog.js';
import {
  persistLocalProviderConfig,
  persistPortableSettingsOrFallback,
  readLocalProviderConfig,
} from '../../utils/portableProviderConfig.js';
import {
  activateCatalogProviderSource,
  activateClaudeProviderSource,
  type ProviderConfigSource,
} from '../../utils/providerRuntime.js';

type ProviderPanelState = {
  activeSource: ProviderConfigSource;
  catalogProviderId?: string;
  catalogDatabasePath?: string;
  providers: ExternalProviderCatalogEntry[];
  catalogError?: string;
};

function getHostLabel(baseUrl?: string): string {
  if (!baseUrl) return 'Default API endpoint';
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function readProviderPanelState(): ProviderPanelState {
  let activeSource: ProviderConfigSource = 'claude';
  let catalogProviderId: string | undefined;
  let catalogDatabasePath: string | undefined;

  try {
    const { config, configPath } = readLocalProviderConfig();
    if (config && config.enabled !== false) {
      activeSource = config.configSource ?? 'recode';
      catalogProviderId = config.catalogProviderId;
      catalogDatabasePath = config.catalogDatabasePath
        ? resolve(dirname(configPath), config.catalogDatabasePath)
        : undefined;
    }
  } catch (error) {
    return {
      activeSource,
      providers: [],
      catalogError: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    return {
      activeSource,
      catalogProviderId,
      catalogDatabasePath,
      providers: listExternalProviderCatalog(catalogDatabasePath),
    };
  } catch (error) {
    return {
      activeSource,
      catalogProviderId,
      catalogDatabasePath,
      providers: [],
      catalogError: error instanceof Error ? error.message : String(error),
    };
  }
}

function CatalogErrorTab({ message, onCancel }: { message: string; onCancel: () => void }): React.ReactNode {
  useKeybindings({ 'select:cancel': onCancel }, { context: 'Select', isActive: true });
  return (
    <Box flexDirection="column">
      <Text color="error">{message}</Text>
      <Text dimColor italic>
        <Byline>
          <KeyboardShortcutHint shortcut="←/→" action="switch source" />
          <ConfigurableShortcutHint action="select:cancel" context="Select" fallback="Esc" description="exit" />
        </Byline>
      </Text>
    </Box>
  );
}

function ProviderFooter(): React.ReactNode {
  return (
    <Text dimColor italic>
      <Byline>
        <KeyboardShortcutHint shortcut="←/→" action="switch source" />
        <KeyboardShortcutHint shortcut="↓" action="open list" />
        <ConfigurableShortcutHint action="select:cancel" context="Select" fallback="Esc" description="exit" />
      </Byline>
    </Text>
  );
}

function ClaudeSourceTab({
  active,
  onActivate,
  onCancel,
}: {
  active: boolean;
  onActivate: () => void;
  onCancel: () => void;
}): React.ReactNode {
  const { headerFocused, focusHeader } = useTabHeaderFocus();
  const options: OptionWithDescription<string>[] = [
    {
      value: 'claude',
      label: 'Follow external configuration',
      description: active
        ? 'Active · provider and model mappings follow .claude/settings.json'
        : 'Use provider and model mappings from .claude/settings.json',
    },
  ];

  return (
    <Box flexDirection="column">
      <Select
        isDisabled={headerFocused}
        options={options}
        defaultValue={active ? 'claude' : undefined}
        defaultFocusValue="claude"
        onUpFromFirstItem={focusHeader}
        onChange={onActivate}
        onCancel={onCancel}
      />
      <ProviderFooter />
    </Box>
  );
}

function RecodeSourceTab({
  activeProviderId,
  providers,
  onSelect,
  onCancel,
}: {
  activeProviderId?: string;
  providers: ExternalProviderCatalogEntry[];
  onSelect: (providerId: string) => void;
  onCancel: () => void;
}): React.ReactNode {
  const { headerFocused, focusHeader } = useTabHeaderFocus();
  const options: OptionWithDescription<string>[] = providers.map(provider => ({
    value: provider.id,
    label: provider.name,
    description: provider.compatible
      ? [
          provider.id === activeProviderId ? 'Active' : undefined,
          provider.isExternalCurrent ? 'External current' : undefined,
          getHostLabel(provider.baseUrl),
          provider.defaultModel ?? provider.sonnetModel ?? provider.opusModel,
        ]
          .filter(Boolean)
          .join(' · ')
      : `Unavailable · ${provider.incompatibilityReason}`,
    disabled: !provider.compatible,
  }));

  return (
    <Box flexDirection="column">
      <Select
        isDisabled={headerFocused}
        options={options}
        defaultValue={activeProviderId}
        defaultFocusValue={activeProviderId ?? options[0]?.value}
        visibleOptionCount={10}
        onUpFromFirstItem={focusHeader}
        onChange={onSelect}
        onCancel={onCancel}
      />
      <ProviderFooter />
    </Box>
  );
}

function ProviderPanel({ onDone }: { onDone: Parameters<LocalJSXCommandCall>[0] }): React.ReactNode {
  const panelState = useMemo(readProviderPanelState, []);
  const [selectedSource, setSelectedSource] = useState<ProviderConfigSource>(panelState.activeSource);
  const [activeSource, setActiveSource] = useState<ProviderConfigSource>(panelState.activeSource);
  const [activeProviderId, setActiveProviderId] = useState(panelState.catalogProviderId);
  const [selectedProvider, setSelectedProvider] = useState<ExternalProviderCatalogEntry | null>(null);
  const mainLoopModel = useAppState(state => state.mainLoopModel);
  const setAppState = useSetAppState();

  const setProviderDefaultModel = () => {
    setAppState(previous => ({
      ...previous,
      mainLoopModel: process.env.ANTHROPIC_MODEL ?? null,
      mainLoopModelForSession: null,
    }));
  };

  const activateClaude = () => {
    try {
      activateClaudeProviderSource();
      const persisted = persistLocalProviderConfig(
        {
          configSource: 'claude',
        },
        process.cwd(),
        'user',
      );
      if (persisted.error) throw persisted.error;
      setProviderDefaultModel();
      setActiveSource('claude');
      onDone('Now following the external .claude provider configuration.', {
        display: 'system',
      });
    } catch (error) {
      onDone(`Unable to activate .claude configuration: ${error instanceof Error ? error.message : String(error)}`, {
        display: 'system',
      });
    }
  };

  const activateRecodeProvider = (providerId: string) => {
    try {
      const provider = activateCatalogProviderSource(providerId, panelState.catalogDatabasePath);
      const persisted = persistLocalProviderConfig(
        {
          configSource: 'recode',
          catalogProviderId: providerId,
        },
        process.cwd(),
        'user',
      );
      if (persisted.error) throw persisted.error;
      setProviderDefaultModel();
      setActiveSource('recode');
      setActiveProviderId(providerId);
      setSelectedProvider(provider);
    } catch (error) {
      onDone(`Unable to activate provider: ${error instanceof Error ? error.message : String(error)}`, {
        display: 'system',
      });
    }
  };

  if (selectedProvider) {
    return (
      <Pane color="permission">
        <ModelPicker
          initial={process.env.ANTHROPIC_MODEL ?? mainLoopModel}
          onSelect={(model, effort: EffortLevel | undefined) => {
            setAppState(previous => ({
              ...previous,
              mainLoopModel: model,
              mainLoopModelForSession: null,
              ...(effort !== undefined ? { effortValue: effort } : {}),
            }));
            if (effort !== undefined) {
              persistPortableSettingsOrFallback(
                { effortLevel: effort === 'max' ? undefined : effort },
                process.cwd(),
                'portableConfig',
              );
            }
            onDone(
              `Using ${selectedProvider.name} with ${model ?? 'the default model'}${effort ? ` and ${effort} effort` : ''}.`,
              { display: 'system' },
            );
          }}
          onCancel={() => setSelectedProvider(null)}
          isStandaloneCommand
          skipSettingsWrite
          headerText={`Provider: ${selectedProvider.name}. Choose the model route for this Recode session.`}
        />
      </Pane>
    );
  }

  return (
    <Pane color="permission">
      <Box flexDirection="column">
        <Box marginBottom={1} flexDirection="column">
          <Text color="remember" bold>
            Select provider configuration
          </Text>
          <Text dimColor>Choose which configuration Recode uses for inference.</Text>
        </Box>
        <Tabs
          selectedTab={selectedSource}
          onTabChange={tab => setSelectedSource(tab as ProviderConfigSource)}
          navFromContent
        >
          <Tab id="claude" title=".claude">
            <ClaudeSourceTab
              active={activeSource === 'claude'}
              onActivate={activateClaude}
              onCancel={() => onDone('Kept the current provider configuration.')}
            />
          </Tab>
          <Tab id="recode" title=".recode">
            {panelState.catalogError || panelState.providers.length === 0 ? (
              <CatalogErrorTab
                message={panelState.catalogError ?? 'No Claude providers were found in the provider catalog.'}
                onCancel={() => onDone('Kept the current provider configuration.')}
              />
            ) : (
              <RecodeSourceTab
                activeProviderId={activeSource === 'recode' ? activeProviderId : undefined}
                providers={panelState.providers}
                onSelect={activateRecodeProvider}
                onCancel={() => onDone('Kept the current provider configuration.')}
              />
            )}
          </Tab>
        </Tabs>
      </Box>
    </Pane>
  );
}

export const call: LocalJSXCommandCall = async onDone => {
  return <ProviderPanel onDone={onDone} />;
};
