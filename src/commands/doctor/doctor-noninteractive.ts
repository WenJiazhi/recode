import type { LocalCommandCall } from '../../types/command.js'
import { getDoctorDiagnostic } from '../../utils/doctorDiagnostic.js'
import {
  buildInstallationDiagnostics,
  buildInstallationHealthDiagnostics,
  buildMemoryDiagnostics,
} from '../../utils/status.js'
import { errorMessage } from '../../utils/errors.js'

async function collectExtraDiagnostics(): Promise<string[]> {
  try {
    return [
      ...(await buildInstallationDiagnostics()),
      ...(await buildInstallationHealthDiagnostics()),
      ...(await buildMemoryDiagnostics()),
    ].map((item) => (typeof item === 'string' ? item : '[interactive diagnostic]'))
  } catch (error) {
    return [`diagnostics unavailable: ${errorMessage(error)}`]
  }
}

export const call: LocalCommandCall = async () => {
  try {
    const diagnostic = await getDoctorDiagnostic()
    const extraDiagnostics = await collectExtraDiagnostics()

    const lines = [
      'Doctor summary:',
      `Version: ${diagnostic.version}`,
      `Installation type: ${diagnostic.installationType}`,
      `Installation path: ${diagnostic.installationPath}`,
      `Invoked binary: ${diagnostic.invokedBinary}`,
      `Configured install method: ${diagnostic.configInstallMethod}`,
      `Auto-updates: ${diagnostic.autoUpdates}`,
    ]

    if (diagnostic.packageManager) {
      lines.push(`Package manager: ${diagnostic.packageManager}`)
    }

    if (diagnostic.hasUpdatePermissions !== null) {
      lines.push(
        `Update permissions: ${diagnostic.hasUpdatePermissions ? 'ok' : 'missing'}`,
      )
    }

    lines.push(
      `ripgrep: ${diagnostic.ripgrepStatus.working ? 'ok' : 'not working'} (${diagnostic.ripgrepStatus.mode})`,
    )

    if (diagnostic.ripgrepStatus.systemPath) {
      lines.push(`ripgrep path: ${diagnostic.ripgrepStatus.systemPath}`)
    }

    lines.push(
      `LSP config path: ${diagnostic.lspStatus.localConfigPath}`,
      `LSP local config: ${diagnostic.lspStatus.localConfigPresent ? 'present' : 'missing'}`,
      `LSP example config: ${diagnostic.lspStatus.localExamplePresent ? diagnostic.lspStatus.localExamplePath : 'missing'}`,
      `LSP configured servers: ${diagnostic.lspStatus.configuredServers} (${diagnostic.lspStatus.localConfiguredServers} local, ${diagnostic.lspStatus.pluginConfiguredServers} plugin)`,
      `LSP manager status: ${diagnostic.lspStatus.initializationStatus}`,
      `LSP instantiated servers: ${diagnostic.lspStatus.managerServers} (${diagnostic.lspStatus.runningServers} running, ${diagnostic.lspStatus.stoppedServers} stopped, ${diagnostic.lspStatus.startingServers} starting/stopping, ${diagnostic.lspStatus.errorServers} error)`,
    )
    if (
      diagnostic.lspStatus.localConfigPresent &&
      !diagnostic.lspStatus.localConfigValid
    ) {
      lines.push('LSP local config validation: failed')
    }
    if (diagnostic.lspStatus.localConfigError) {
      lines.push(`LSP local config error: ${diagnostic.lspStatus.localConfigError}`)
    }

    if (diagnostic.lspStatus.initializationError) {
      lines.push(`LSP initialization error: ${diagnostic.lspStatus.initializationError}`)
    }
    if (diagnostic.lspStatus.exampleServers.length > 0) {
      for (const server of diagnostic.lspStatus.exampleServers) {
        lines.push(
          `LSP example server: ${server.name} -> ${server.commandLine} (${server.launcherInstalled ? 'launcher ok' : 'launcher missing'})`,
        )
      }
    }
    if (diagnostic.lspStatus.configuredLocalServers.length > 0) {
      for (const server of diagnostic.lspStatus.configuredLocalServers) {
        lines.push(
          `LSP local server: ${server.name} -> ${server.commandLine} (${server.launcherInstalled ? 'launcher ok' : 'launcher missing'})`,
        )
      }
    }
    if (diagnostic.lspStatus.quickstartHint) {
      lines.push(`LSP quickstart: ${diagnostic.lspStatus.quickstartHint}`)
    }

    lines.push(
      `Worktree mode: ${diagnostic.worktreeStatus.modeEnabled ? 'enabled' : 'disabled'}`,
      `Worktree session: ${diagnostic.worktreeStatus.active ? 'active' : 'inactive'}`,
    )

    if (diagnostic.worktreeStatus.active) {
      lines.push(
        `Worktree path: ${diagnostic.worktreeStatus.worktreePath}`,
        `Worktree branch: ${diagnostic.worktreeStatus.worktreeBranch ?? 'unknown'}`,
      )
      if (diagnostic.worktreeStatus.originalBranch) {
        lines.push(`Original branch: ${diagnostic.worktreeStatus.originalBranch}`)
      }
      if (diagnostic.worktreeStatus.hookBased) {
        lines.push('Worktree backend: hook-based')
      }
    }

    const capabilities = diagnostic.optionalCapabilities
    lines.push(
      '',
      'Governed optional capabilities:',
      `Tracked: ${capabilities.total} (${capabilities.hidden} hidden)`,
      `States: ${capabilities.byState.available} available, ${capabilities.byState['build-disabled']} build-disabled, ${capabilities.byState['not-independently-implemented']} not independently implemented, ${capabilities.byState['external-dependency-required']} external dependency required`,
      `Static contract: ${capabilities.unresolvedImports} gated unresolved imports, ${capabilities.retainedFiles} retained files, ${capabilities.externalBinaryUses} external binary uses, ${capabilities.runtimeDependencyExceptions} runtime dependency exception`,
    )

    if (diagnostic.multipleInstallations.length > 0) {
      lines.push('', 'Other installations:')
      for (const install of diagnostic.multipleInstallations) {
        lines.push(`- ${install.type}: ${install.path}`)
      }
    }

    if (diagnostic.warnings.length > 0) {
      lines.push('', 'Warnings:')
      for (const warning of diagnostic.warnings) {
        lines.push(`- ${warning.issue}`)
        lines.push(`  Fix: ${warning.fix}`)
      }
    }

    if (extraDiagnostics.length > 0) {
      lines.push('', 'Additional diagnostics:')
      for (const item of extraDiagnostics) {
        lines.push(`- ${item}`)
      }
    }

    if (diagnostic.recommendation) {
      lines.push('', `Recommendation: ${diagnostic.recommendation}`)
    }

    lines.push('', 'Run `recode doctor` for the full interactive diagnostic view.')

    return {
      type: 'text',
      value: lines.join('\n'),
    }
  } catch (error) {
    return {
      type: 'text',
      value: [
        'Doctor summary:',
        `diagnostics unavailable: ${errorMessage(error)}`,
        '',
        'Run `recode doctor` for the full interactive diagnostic view.',
      ].join('\n'),
    }
  }
}
