export const OPTIONAL_CAPABILITY_STATES = [
  'available',
  'build-disabled',
  'not-independently-implemented',
  'external-dependency-required',
] as const

export type OptionalCapabilityState =
  (typeof OPTIONAL_CAPABILITY_STATES)[number]

export type OptionalCapabilityVisibility = 'public' | 'conditional' | 'hidden'

export type CapabilityImportReference = {
  importer: string
  specifier: string
}

export type CapabilityBinaryReference = {
  source: string
  binary: string
}

export type CapabilityAuditContract = {
  unresolvedImports?: readonly CapabilityImportReference[]
  retainedFiles?: readonly string[]
  externalBinaryUses?: readonly CapabilityBinaryReference[]
  runtimeDependencyExceptions?: readonly string[]
}

export type OptionalCapability = {
  id: string
  title: string
  area:
    | 'account'
    | 'automation'
    | 'commands'
    | 'network'
    | 'platform'
    | 'sdk'
    | 'skills'
    | 'tools'
    | 'ui'
  state: OptionalCapabilityState
  visibility: OptionalCapabilityVisibility
  description: string
  buildFlags?: readonly string[]
  requiresAccountAuth?: boolean
  audit?: CapabilityAuditContract
}

const missingImport = (
  importer: string,
  specifier: string,
): CapabilityImportReference => ({ importer, specifier })

const binaryUse = (
  source: string,
  binary: string,
): CapabilityBinaryReference => ({ source, binary })

const CLAUDE_API_SKILL_ASSETS = [
  './claude-api/csharp/claude-api.md',
  './claude-api/curl/examples.md',
  './claude-api/go/claude-api.md',
  './claude-api/java/claude-api.md',
  './claude-api/php/claude-api.md',
  './claude-api/python/agent-sdk/patterns.md',
  './claude-api/python/agent-sdk/README.md',
  './claude-api/python/claude-api/batches.md',
  './claude-api/python/claude-api/files-api.md',
  './claude-api/python/claude-api/README.md',
  './claude-api/python/claude-api/streaming.md',
  './claude-api/python/claude-api/tool-use.md',
  './claude-api/ruby/claude-api.md',
  './claude-api/SKILL.md',
  './claude-api/shared/error-codes.md',
  './claude-api/shared/live-sources.md',
  './claude-api/shared/models.md',
  './claude-api/shared/prompt-caching.md',
  './claude-api/shared/tool-use-concepts.md',
  './claude-api/typescript/agent-sdk/patterns.md',
  './claude-api/typescript/agent-sdk/README.md',
  './claude-api/typescript/claude-api/batches.md',
  './claude-api/typescript/claude-api/files-api.md',
  './claude-api/typescript/claude-api/README.md',
  './claude-api/typescript/claude-api/streaming.md',
  './claude-api/typescript/claude-api/tool-use.md',
] as const

export const OPTIONAL_CAPABILITIES = [
  {
    id: 'anthropic-account-auth',
    title: 'Anthropic account authentication',
    area: 'account',
    state: 'build-disabled',
    visibility: 'hidden',
    description:
      'The current product accepts API keys and local Provider profiles only. Account OAuth remains frozen behind a compile-time product boundary.',
  },
  {
    id: 'proactive-runtime',
    title: 'Proactive runtime',
    area: 'automation',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'Registration points remain, but the proactive command, React hook, and sleep tool are not present in this repository.',
    buildFlags: ['PROACTIVE', 'KAIROS'],
    audit: {
      unresolvedImports: [
        missingImport('src/commands.ts', './commands/proactive.js'),
        missingImport('src/screens/REPL.tsx', '../proactive/useProactive.js'),
        missingImport('src/tools.ts', './tools/SleepTool/SleepTool.js'),
      ],
    },
  },
  {
    id: 'assistant-mode',
    title: 'Account assistant mode',
    area: 'automation',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'The command registration is retained, but the account-backed implementation is absent and account authentication is disabled.',
    buildFlags: ['KAIROS'],
    requiresAccountAuth: true,
    audit: {
      unresolvedImports: [
        missingImport('src/commands.ts', './commands/assistant/index.js'),
      ],
    },
  },
  {
    id: 'remote-control-daemon',
    title: 'Remote control daemon',
    area: 'automation',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'The daemon command is not shipped because its local module and account-backed control plane are unavailable.',
    buildFlags: ['DAEMON', 'BRIDGE_MODE'],
    requiresAccountAuth: true,
    audit: {
      unresolvedImports: [
        missingImport(
          'src/commands.ts',
          './commands/remoteControlServer/index.js',
        ),
      ],
    },
  },
  {
    id: 'history-snip',
    title: 'History snipping',
    area: 'commands',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'Command and tool registration slots are retained, but no independently implemented history-snip modules are available.',
    buildFlags: ['HISTORY_SNIP'],
    audit: {
      unresolvedImports: [
        missingImport('src/commands.ts', './commands/force-snip.js'),
        missingImport('src/tools.ts', './tools/SnipTool/SnipTool.js'),
      ],
    },
  },
  {
    id: 'pull-request-subscriptions',
    title: 'Pull request subscriptions',
    area: 'automation',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'Webhook command and tool slots remain unavailable until a standalone subscription backend is implemented.',
    buildFlags: ['KAIROS_GITHUB_WEBHOOKS'],
    audit: {
      unresolvedImports: [
        missingImport('src/commands.ts', './commands/subscribe-pr.js'),
        missingImport(
          'src/tools.ts',
          './tools/SubscribePRTool/SubscribePRTool.js',
        ),
      ],
    },
  },
  {
    id: 'torch-command',
    title: 'Torch command',
    area: 'commands',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'The build flag and command slot are retained while the command implementation is absent.',
    buildFlags: ['TORCH'],
    audit: {
      unresolvedImports: [
        missingImport('src/commands.ts', './commands/torch.js'),
      ],
    },
  },
  {
    id: 'internal-model-callouts',
    title: 'Internal model callouts',
    area: 'ui',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'Internal-only model callout components are excluded from the external build and have no public implementation.',
    audit: {
      unresolvedImports: [
        missingImport(
          'src/screens/REPL.tsx',
          '../components/AntModelSwitchCallout.js',
        ),
        missingImport(
          'src/screens/REPL.tsx',
          '../components/UndercoverAutoCallout.js',
        ),
      ],
    },
  },
  {
    id: 'bundled-api-guide',
    title: 'Bundled API guide skill',
    area: 'skills',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'The skill loader is retained, but its documentation asset bundle is not distributed with Recode.',
    buildFlags: ['BUILDING_CLAUDE_APPS'],
    audit: {
      unresolvedImports: CLAUDE_API_SKILL_ASSETS.map(specifier =>
        missingImport('src/skills/bundled/claudeApiContent.ts', specifier),
      ),
    },
  },
  {
    id: 'dream-skill',
    title: 'Dream skill',
    area: 'skills',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description: 'The optional skill is not present in the public build.',
    buildFlags: ['KAIROS', 'KAIROS_DREAM'],
    audit: {
      unresolvedImports: [
        missingImport('src/skills/bundled/index.ts', './dream.js'),
      ],
    },
  },
  {
    id: 'review-artifact-hunter',
    title: 'Review artifact hunter skill',
    area: 'skills',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'The review artifact skill is not present in the public build.',
    buildFlags: ['REVIEW_ARTIFACT'],
    audit: {
      unresolvedImports: [
        missingImport('src/skills/bundled/index.ts', './hunter.js'),
      ],
    },
  },
  {
    id: 'skill-generator',
    title: 'Bundled skill generator',
    area: 'skills',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'The generator registration slot is retained, but no independently implemented generator skill is shipped.',
    buildFlags: ['RUN_SKILL_GENERATOR'],
    audit: {
      unresolvedImports: [
        missingImport('src/skills/bundled/index.ts', './runSkillGenerator.js'),
      ],
    },
  },
  {
    id: 'user-file-delivery',
    title: 'User file delivery tool',
    area: 'tools',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'The account-backed file delivery tool has no standalone transport implementation.',
    buildFlags: ['KAIROS'],
    requiresAccountAuth: true,
    audit: {
      unresolvedImports: [
        missingImport(
          'src/tools.ts',
          './tools/SendUserFileTool/SendUserFileTool.js',
        ),
      ],
    },
  },
  {
    id: 'push-notifications',
    title: 'Push notification tool',
    area: 'tools',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'Push delivery requires a standalone backend that is not implemented in this repository.',
    buildFlags: ['KAIROS', 'KAIROS_PUSH_NOTIFICATION'],
    audit: {
      unresolvedImports: [
        missingImport(
          'src/tools.ts',
          './tools/PushNotificationTool/PushNotificationTool.js',
        ),
      ],
    },
  },
  {
    id: 'context-inspection',
    title: 'Context inspection tool',
    area: 'tools',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'Context-collapse inspection remains a reserved tool slot without a local implementation.',
    buildFlags: ['CONTEXT_COLLAPSE'],
    audit: {
      unresolvedImports: [
        missingImport(
          'src/tools.ts',
          './tools/CtxInspectTool/CtxInspectTool.js',
        ),
      ],
    },
  },
  {
    id: 'terminal-capture',
    title: 'Terminal capture tool',
    area: 'tools',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'The terminal-panel capture module is not present in the current build.',
    buildFlags: ['TERMINAL_PANEL'],
    audit: {
      unresolvedImports: [
        missingImport(
          'src/tools.ts',
          './tools/TerminalCaptureTool/TerminalCaptureTool.js',
        ),
      ],
    },
  },
  {
    id: 'embedded-web-browser',
    title: 'Embedded web browser tool',
    area: 'tools',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'Browser integrations currently use MCP; the reserved embedded browser tool is not implemented.',
    buildFlags: ['WEB_BROWSER_TOOL'],
    audit: {
      unresolvedImports: [
        missingImport(
          'src/tools.ts',
          './tools/WebBrowserTool/WebBrowserTool.js',
        ),
      ],
    },
  },
  {
    id: 'peer-inbox',
    title: 'Local peer inbox',
    area: 'automation',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'The peer-list tool is reserved until the local peer transport has a supported product contract.',
    buildFlags: ['UDS_INBOX'],
    audit: {
      unresolvedImports: [
        missingImport('src/tools.ts', './tools/ListPeersTool/ListPeersTool.js'),
      ],
    },
  },
  {
    id: 'agent-sdk-runtime',
    title: 'Agent SDK runtime',
    area: 'sdk',
    state: 'not-independently-implemented',
    visibility: 'hidden',
    description:
      'Type contracts are retained for internal compilation, but session/query functions are not offered as a stable SDK.',
    audit: {
      retainedFiles: [
        'src/entrypoints/agentSdkTypes.ts',
        'src/entrypoints/sdk/controlTypes.ts',
        'src/entrypoints/sdk/runtimeTypes.ts',
        'src/entrypoints/sdk/settingsTypes.generated.ts',
        'src/entrypoints/sdk/toolTypes.ts',
      ],
    },
  },
  {
    id: 'remote-managed-settings-security',
    title: 'Remote managed settings security review',
    area: 'account',
    state: 'build-disabled',
    visibility: 'hidden',
    description:
      'The review UI and typed implementation are retained while remote managed settings remain outside the API-key-only product.',
    requiresAccountAuth: true,
    audit: {
      retainedFiles: [
        'src/components/ManagedSettingsSecurityDialog/ManagedSettingsSecurityDialog.tsx',
        'src/components/ManagedSettingsSecurityDialog/utils.ts',
        'src/services/remoteManagedSettings/securityCheck.tsx',
      ],
    },
  },
  {
    id: 'usage-limit-reset',
    title: 'Account usage limit reset',
    area: 'commands',
    state: 'build-disabled',
    visibility: 'hidden',
    description:
      'The typed command placeholder is retained, but account usage controls are hidden in the API-key-only product.',
    requiresAccountAuth: true,
    audit: {
      retainedFiles: ['src/commands/reset-limits/index.ts'],
    },
  },
  {
    id: 'internal-terminal-tool',
    title: 'Internal terminal tool',
    area: 'tools',
    state: 'build-disabled',
    visibility: 'hidden',
    description:
      'The internal terminal abstraction is excluded while the public product uses Bash and explicit worktree orchestration.',
    audit: {
      retainedFiles: ['src/tools/TungstenTool/TungstenTool.ts'],
    },
  },
  {
    id: 'windows-computer-use-ocr',
    title: 'Windows computer-use OCR',
    area: 'platform',
    state: 'build-disabled',
    visibility: 'hidden',
    description:
      'The Windows OCR adapter source is retained but is not connected to the current computer-use backend.',
    audit: {
      retainedFiles: ['src/utils/computerUse/win32/ocr.ts'],
    },
  },
  {
    id: 'terminal-multiplexer-integration',
    title: 'Terminal multiplexer integration',
    area: 'platform',
    state: 'external-dependency-required',
    visibility: 'conditional',
    description:
      'Fullscreen, panel, exit, and worktree helpers use tmux only when it is installed and the relevant path is selected.',
    audit: {
      externalBinaryUses: [
        binaryUse('src/commands/exit/exit.tsx', 'tmux'),
        binaryUse('src/screens/REPL.tsx', 'tmux'),
        binaryUse('src/utils/fullscreen.ts', 'tmux'),
        binaryUse('src/utils/terminalPanel.ts', 'tmux'),
        binaryUse('src/utils/worktree.ts', 'tmux'),
      ],
    },
  },
  {
    id: 'system-keychain',
    title: 'macOS system keychain',
    area: 'platform',
    state: 'external-dependency-required',
    visibility: 'conditional',
    description:
      'Secure storage uses the macOS security utility when the keychain backend is selected.',
    audit: {
      externalBinaryUses: [
        binaryUse('src/utils/auth.ts', 'security'),
        binaryUse('src/utils/secureStorage/keychainPrefetch.ts', 'security'),
        binaryUse(
          'src/utils/secureStorage/macOsKeychainStorage.ts',
          'security',
        ),
      ],
    },
  },
  {
    id: 'voice-capture-binaries',
    title: 'System voice capture',
    area: 'platform',
    state: 'external-dependency-required',
    visibility: 'conditional',
    description:
      'Linux and Unix audio capture requires arecord or rec when voice capture is enabled.',
    audit: {
      externalBinaryUses: [
        binaryUse('packages/audio-capture-napi/src/index.ts', 'rec'),
        binaryUse('packages/audio-capture-napi/src/index.ts', 'arecord'),
        binaryUse('src/services/voice.ts', 'arecord'),
        binaryUse('src/services/voice.ts', 'rec'),
      ],
    },
  },
  {
    id: 'system-platform-helpers',
    title: 'System platform helpers',
    area: 'platform',
    state: 'external-dependency-required',
    visibility: 'conditional',
    description:
      'Optional platform paths use caffeinate on macOS and wslpath under WSL when those environments are detected.',
    audit: {
      externalBinaryUses: [
        binaryUse('src/services/preventSleep.ts', 'caffeinate'),
        binaryUse('src/utils/idePathConversion.ts', 'wslpath'),
      ],
    },
  },
  {
    id: 'proxy-mtls-transport',
    title: 'Proxy and mTLS transport',
    area: 'network',
    state: 'available',
    visibility: 'public',
    description:
      'Undici is loaded dynamically only when proxy or mTLS dispatchers are configured; Bun-based Knip cannot infer those require calls.',
    audit: {
      runtimeDependencyExceptions: ['undici'],
    },
  },
] as const satisfies readonly OptionalCapability[]

export type OptionalCapabilitySummary = {
  total: number
  byState: Record<OptionalCapabilityState, number>
  hidden: number
  unresolvedImports: number
  retainedFiles: number
  externalBinaryUses: number
  runtimeDependencyExceptions: number
}

export function getOptionalCapabilitySummary(): OptionalCapabilitySummary {
  const byState: Record<OptionalCapabilityState, number> = {
    available: 0,
    'build-disabled': 0,
    'not-independently-implemented': 0,
    'external-dependency-required': 0,
  }
  let hidden = 0
  let unresolvedImports = 0
  let retainedFiles = 0
  let externalBinaryUses = 0
  let runtimeDependencyExceptions = 0

  for (const capability of OPTIONAL_CAPABILITIES as readonly OptionalCapability[]) {
    byState[capability.state] += 1
    if (capability.visibility === 'hidden') hidden += 1
    unresolvedImports += capability.audit?.unresolvedImports?.length ?? 0
    retainedFiles += capability.audit?.retainedFiles?.length ?? 0
    externalBinaryUses += capability.audit?.externalBinaryUses?.length ?? 0
    runtimeDependencyExceptions +=
      capability.audit?.runtimeDependencyExceptions?.length ?? 0
  }

  return {
    total: OPTIONAL_CAPABILITIES.length,
    byState,
    hidden,
    unresolvedImports,
    retainedFiles,
    externalBinaryUses,
    runtimeDependencyExceptions,
  }
}
