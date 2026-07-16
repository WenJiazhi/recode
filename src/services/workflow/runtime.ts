type ScheduleWaiter = {
  promise: Promise<void>
  cancel: () => void
}

export class WorkflowSchedulerSignal {
  private waiters = new Set<() => void>()

  wait(signal: AbortSignal): ScheduleWaiter {
    if (signal.aborted) {
      return { promise: Promise.resolve(), cancel() {} }
    }
    let settled = false
    let resolvePromise!: () => void
    const cleanup = (): void => {
      if (settled) return
      settled = true
      this.waiters.delete(resolvePromise)
      signal.removeEventListener('abort', resolvePromise)
    }
    const promise = new Promise<void>(resolve => {
      resolvePromise = () => {
        cleanup()
        resolve()
      }
      this.waiters.add(resolvePromise)
      signal.addEventListener('abort', resolvePromise, { once: true })
    })
    return { promise, cancel: resolvePromise }
  }

  notify(): void {
    for (const resolve of [...this.waiters]) resolve()
  }

  clear(): void {
    this.notify()
    this.waiters.clear()
  }
}
