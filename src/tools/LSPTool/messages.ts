export type LspInitStatus =
  | { status: 'not-started' }
  | { status: 'pending' }
  | { status: 'success' }
  | { status: 'failed'; error: Error }

export function buildNoLspServerMessage(
  fileExtension: string,
  localConfigPath: string,
): string {
  const ext = fileExtension || '(no extension)'
  return [
    `No LSP server available for file type: ${ext}.`,
    `Add a matching server to ${localConfigPath} or enable a plugin-provided LSP server, then re-run /doctor to confirm it is detected.`,
  ].join(' ')
}

export function buildLspManagerUnavailableMessage(
  status: LspInitStatus,
  localConfigPath: string,
): string {
  if (status.status === 'failed') {
    return [
      `LSP server manager failed to initialize: ${status.error.message}.`,
      `Run /doctor to inspect LSP health and check ${localConfigPath} or any plugin-provided LSP server configuration.`,
    ].join(' ')
  }

  if (status.status === 'pending') {
    return [
      'LSP server manager is still initializing.',
      `Run /doctor to inspect LSP health and verify ${localConfigPath} or any plugin-provided LSP server configuration.`,
    ].join(' ')
  }

  return [
    'LSP server manager not initialized.',
    `Run /doctor to inspect LSP health and verify ${localConfigPath} or any plugin-provided LSP server configuration.`,
  ].join(' ')
}
