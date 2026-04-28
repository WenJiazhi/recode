import type { LspPluginRecommendation } from '../../utils/plugins/lspRecommendation.js'

export type LspInitStatus =
  | { status: 'not-started' }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'failed'; error: Error }

export type LspDiagnosticHint = {
  localConfigError?: string
  quickstartHint?: string
  configuredLocalServers?: Array<{
    name: string
    commandLine: string
    launcherInstalled: boolean
  }>
}

function getExampleConfigPath(localConfigPath: string): string {
  return localConfigPath.endsWith('lsp.json')
    ? `${localConfigPath.slice(0, -'lsp.json'.length)}lsp.example.json`
    : `${localConfigPath}.example`
}

function getMissingLocalLauncherHint(
  diagnostics?: LspDiagnosticHint,
): string | undefined {
  const missingLauncher = diagnostics?.configuredLocalServers?.find(
    server => !server.launcherInstalled,
  )
  if (!missingLauncher) {
    return undefined
  }
  return `Current local server launcher missing: ${missingLauncher.name} -> ${missingLauncher.commandLine}.`
}

export function buildNoLspServerMessage(
  fileExtension: string,
  localConfigPath: string,
  recommendations: LspPluginRecommendation[] = [],
  diagnostics?: LspDiagnosticHint,
): string {
  const ext = fileExtension || '(no extension)'
  const exampleConfigPath = getExampleConfigPath(localConfigPath)
  const pluginRecommendation =
    recommendations.length > 0
      ? buildPluginRecommendationMessage(recommendations)
      : undefined
  const missingLauncherHint = getMissingLocalLauncherHint(diagnostics)
  const configHint = diagnostics?.localConfigError
    ? `Current local config error: ${diagnostics.localConfigError}.`
    : missingLauncherHint
      ? missingLauncherHint
    : diagnostics?.quickstartHint
      ? `Quickstart: ${diagnostics.quickstartHint}`
      : `If you want a checked-in starting point, copy ${exampleConfigPath} to ${localConfigPath} and adjust the server command for your machine.`
  return [
    `No LSP server available for file type: ${ext}.`,
    `Add a matching server to ${localConfigPath} or enable a plugin-provided LSP server, then re-run /doctor to confirm it is detected.`,
    configHint,
    pluginRecommendation,
  ].join(' ')
}

function buildPluginRecommendationMessage(
  recommendations: LspPluginRecommendation[],
): string {
  const [primary, secondary] = recommendations
  if (!primary) {
    return ''
  }

  const primaryText = `Detected a matching installed LSP binary (${primary.command}); you can enable it by installing plugin ${primary.pluginId}.`
  if (!secondary) {
    return primaryText
  }

  return `${primaryText} Another matching plugin is ${secondary.pluginId}.`
}

export function buildLspManagerUnavailableMessage(
  status: LspInitStatus,
  localConfigPath: string,
  diagnostics?: LspDiagnosticHint,
): string {
  const exampleConfigPath = getExampleConfigPath(localConfigPath)
  const missingLauncherHint = getMissingLocalLauncherHint(diagnostics)
  const diagnosticHint = diagnostics?.localConfigError
    ? `Current local config error: ${diagnostics.localConfigError}.`
    : missingLauncherHint
      ? missingLauncherHint
    : diagnostics?.quickstartHint
      ? diagnostics.quickstartHint
      : `A checked-in starting point is available at ${exampleConfigPath}.`
  if (status.status === 'failed') {
    return [
      `LSP server manager failed to initialize: ${status.error.message}.`,
      `Run /doctor to inspect LSP health and check ${localConfigPath} or any plugin-provided LSP server configuration.`,
      diagnosticHint,
    ].join(' ')
  }

  if (status.status === 'pending') {
    return [
      'LSP server manager is still initializing.',
      `Run /doctor to inspect LSP health and verify ${localConfigPath} or any plugin-provided LSP server configuration.`,
      diagnosticHint,
    ].join(' ')
  }

  return [
    'LSP server manager not initialized.',
    `Run /doctor to inspect LSP health and verify ${localConfigPath} or any plugin-provided LSP server configuration.`,
    diagnosticHint,
  ].join(' ')
}
