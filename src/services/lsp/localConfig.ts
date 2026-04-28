import { readFile } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod/v4'
import type { ScopedLspServerConfig } from './types.js'
import { getCwd } from '../../utils/cwd.js'
import { logForDebugging } from '../../utils/debug.js'
import { isENOENT, toError } from '../../utils/errors.js'
import { logError } from '../../utils/log.js'
import { jsonParse } from '../../utils/slowOperations.js'
import { LspServerConfigSchema } from '../../utils/plugins/schemas.js'

export const LOCAL_LSP_CONFIG_RELATIVE_PATH = '.recode/lsp.json'
export const LOCAL_LSP_EXAMPLE_CONFIG_RELATIVE_PATH = '.recode/lsp.example.json'

export type LocalLspConfigInspection = {
  configPath: string
  present: boolean
  valid: boolean
  error?: string
  servers: Record<string, ScopedLspServerConfig>
}

function addLocalScopeToLspServers(
  servers: Record<string, z.infer<ReturnType<typeof LspServerConfigSchema>>>,
): Record<string, ScopedLspServerConfig> {
  const scopedServers: Record<string, ScopedLspServerConfig> = {}

  for (const [name, config] of Object.entries(servers)) {
    scopedServers[`local:${name}`] = {
      ...config,
      scope: 'dynamic',
      source: 'project-local',
    }
  }

  return scopedServers
}

export async function inspectLocalLspConfig(): Promise<LocalLspConfigInspection> {
  const configPath = join(getCwd(), LOCAL_LSP_CONFIG_RELATIVE_PATH)

  try {
    const content = await readFile(configPath, 'utf-8')
    const parsed = jsonParse(content)
    const result = z
      .record(z.string(), LspServerConfigSchema())
      .safeParse(parsed)

    if (!result.success) {
      const errorMessage = `Local LSP config validation failed for ${configPath}: ${result.error.message}`
      const error = new Error(errorMessage)
      logError(error)
      logForDebugging(error.message, { level: 'warn' })
      return {
        configPath,
        present: true,
        valid: false,
        error: errorMessage,
        servers: {},
      }
    }

    const scopedServers = addLocalScopeToLspServers(result.data)
    logForDebugging(
      `[LSP LOCAL CONFIG] Loaded ${Object.keys(scopedServers).length} server(s) from ${configPath}`,
    )
    return {
      configPath,
      present: true,
      valid: true,
      servers: scopedServers,
    }
  } catch (error) {
    if (!isENOENT(error)) {
      const err = toError(error)
      const errorMessage = `Failed to read local LSP config ${configPath}: ${err.message}`
      logError(
        new Error(errorMessage),
      )
      logForDebugging(
        `[LSP LOCAL CONFIG] Failed to read ${configPath}: ${err.message}`,
        { level: 'warn' },
      )
      return {
        configPath,
        present: true,
        valid: false,
        error: errorMessage,
        servers: {},
      }
    }
    return {
      configPath,
      present: false,
      valid: false,
      servers: {},
    }
  }
}

export async function loadLocalLspServers(): Promise<
  Record<string, ScopedLspServerConfig>
> {
  const inspection = await inspectLocalLspConfig()
  return inspection.servers
}
