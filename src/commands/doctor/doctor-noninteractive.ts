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
      `LSP instantiated servers: ${diagnostic.lspStatus.managerServers} (${diagnostic.lspStatus.activeServers} active, ${diagnostic.lspStatus.errorServers} error)`,
    )

    if (diagnostic.lspStatus.initializationError) {
      lines.push(`LSP initialization error: ${diagnostic.lspStatus.initializationError}`)
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
