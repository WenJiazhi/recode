import type { ComputerUseAPI } from '@recode/computer-use-swift'

let cached: ComputerUseAPI | undefined

/**
 * Package's js/index.js reads COMPUTER_USE_SWIFT_NODE_PATH (baked by
 * build-with-plugins.ts on darwin targets, unset otherwise — falls through to
 * the node_modules prebuilds/ path). We cache the loaded native module.
 *
 * The four @MainActor methods (captureExcluding, captureRegion,
 * apps.listInstalled, resolvePrepareCapture) dispatch to DispatchQueue.main
 * and will hang under libuv unless CFRunLoop is pumped — call sites wrap
 * these in drainRunLoop().
 */
export function requireComputerUseSwift(): ComputerUseAPI {
  if (cached) return cached
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@recode/computer-use-swift')
  if (mod.ComputerUseAPI && typeof mod.ComputerUseAPI === 'function') {
    cached = new mod.ComputerUseAPI() as ComputerUseAPI
  } else {
    cached = mod as ComputerUseAPI
  }
  return cached
}

export type { ComputerUseAPI }
