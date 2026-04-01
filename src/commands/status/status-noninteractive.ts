import { getSessionId } from '../../bootstrap/state.js'
import type { LocalCommandCall } from '../../types/command.js'
import { getCwd } from '../../utils/cwd.js'
import { getCurrentSessionTitle } from '../../utils/sessionStorage.js'
import {
  buildAPIProviderProperties,
  buildAccountProperties,
  buildInstallationDiagnostics,
  buildInstallationHealthDiagnostics,
  buildMemoryDiagnostics,
  getModelDisplayLabel,
  type Property,
} from '../../utils/status.js'
import { errorMessage } from '../../utils/errors.js'

function propertyValueToText(value: Property['value']): string {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return '[interactive value omitted]'
}

function formatProperty(property: Property): string {
  const value = propertyValueToText(property.value)
  return property.label ? `${property.label}: ${value}` : value
}

function summarizeMcpClients(
  clients: Array<{ name?: string; type?: string }> | undefined,
): string | null {
  const servers = (clients ?? []).filter((client) => client.name !== 'ide')
  if (servers.length === 0) {
    return null
  }

  const counts = {
    connected: 0,
    pending: 0,
    needsAuth: 0,
    failed: 0,
  }

  for (const server of servers) {
    if (server.type === 'connected') counts.connected += 1
    else if (server.type === 'pending') counts.pending += 1
    else if (server.type === 'needs-auth') counts.needsAuth += 1
    else counts.failed += 1
  }

  const parts = []
  if (counts.connected > 0) parts.push(`${counts.connected} connected`)
  if (counts.needsAuth > 0) parts.push(`${counts.needsAuth} need auth`)
  if (counts.pending > 0) parts.push(`${counts.pending} pending`)
  if (counts.failed > 0) parts.push(`${counts.failed} failed`)

  return parts.length > 0 ? `MCP servers: ${parts.join(', ')}` : null
}

async function collectDiagnostics(): Promise<string[]> {
  try {
    return [
      ...(await buildInstallationDiagnostics()),
      ...(await buildInstallationHealthDiagnostics()),
      ...(await buildMemoryDiagnostics()),
    ].map((diagnostic) =>
      typeof diagnostic === 'string' ? diagnostic : '[interactive diagnostic]',
    )
  } catch (error) {
    return [`diagnostics unavailable: ${errorMessage(error)}`]
  }
}

export const call: LocalCommandCall = async (_args, context) => {
  const appState = context.getAppState()
  const sessionId = getSessionId()
  const sessionName = getCurrentSessionTitle(sessionId) ?? '(unnamed)'

  const lines = [
    `Version: ${MACRO.VERSION}`,
    `Session name: ${sessionName}`,
    `Session ID: ${sessionId}`,
    `cwd: ${getCwd()}`,
    `Model: ${getModelDisplayLabel(appState.mainLoopModel)}`,
    ...buildAccountProperties().map(formatProperty),
    ...buildAPIProviderProperties().map(formatProperty),
  ]

  const mcpSummary = summarizeMcpClients(appState.mcp.clients)
  if (mcpSummary) {
    lines.push(mcpSummary)
  }

  const diagnostics = await collectDiagnostics()

  if (diagnostics.length > 0) {
    lines.push('', 'System Diagnostics:')
    for (const diagnostic of diagnostics) {
      lines.push(`- ${diagnostic}`)
    }
  }

  return {
    type: 'text',
    value: lines.join('\n'),
  }
}
