// Terminal focus state signal — non-React access to DECSET 1004 focus events.
// 'unknown' is the default for terminals that don't support focus reporting.
// Most consumers treat 'unknown' like 'focused'; a few lifecycle features
// (for example away-summary idle fallback) may handle it specially.
// Subscribers are notified synchronously when focus changes, used by
// TerminalFocusProvider to avoid polling.
export type TerminalFocusState = 'focused' | 'blurred' | 'unknown'

let focusState: TerminalFocusState = 'unknown'
const resolvers: Set<() => void> = new Set()
const subscribers: Set<() => void> = new Set()

export function setTerminalFocused(v: boolean): void {
  focusState = v ? 'focused' : 'blurred'
  // Notify useSyncExternalStore subscribers
  for (const cb of subscribers) {
    cb()
  }
  if (!v) {
    for (const resolve of resolvers) {
      resolve()
    }
    resolvers.clear()
  }
}

export function getTerminalFocused(): boolean {
  return focusState !== 'blurred'
}

export function getTerminalFocusState(): TerminalFocusState {
  return focusState
}

// For useSyncExternalStore
export function subscribeTerminalFocus(cb: () => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

export function resetTerminalFocusState(): void {
  focusState = 'unknown'
  for (const cb of subscribers) {
    cb()
  }
}
