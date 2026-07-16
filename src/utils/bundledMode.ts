declare const RECODE_STANDALONE: boolean | undefined
declare const RECODE_EMBEDDED_RIPGREP: boolean | undefined

/**
 * Detects if the current runtime is Bun.
 * Returns true when:
 * - Running a JS file via the `bun` command
 * - Running a Bun-compiled standalone executable
 */
export function isRunningWithBun(): boolean {
  // https://bun.com/guides/util/detect-bun
  return process.versions.bun !== undefined
}

/**
 * Detects if running as a Bun-compiled standalone executable.
 * Release builds define an explicit marker. Embedded files remain a fallback
 * for older/custom Bun builds that predate the marker.
 */
export function isInBundledMode(): boolean {
  return (
    (typeof RECODE_STANDALONE !== 'undefined' && RECODE_STANDALONE) ||
    (typeof Bun !== 'undefined' &&
      Array.isArray(Bun.embeddedFiles) &&
      Bun.embeddedFiles.length > 0)
  )
}

export function isEmbeddedRipgrepAvailable(): boolean {
  return (
    typeof RECODE_EMBEDDED_RIPGREP !== 'undefined' &&
    RECODE_EMBEDDED_RIPGREP
  )
}
