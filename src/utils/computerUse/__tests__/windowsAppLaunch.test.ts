import { describe, expect, it } from 'bun:test'

import { buildWindowsAppLaunchScript } from '../windowsAppLaunch.js'

describe('buildWindowsAppLaunchScript', () => {
  it('captures visible windows before any launch attempt', () => {
    const script = buildWindowsAppLaunchScript('Notepad')

    const snapshotIndex = script.indexOf(
      '$beforeHwnds = [CuLaunch]::GetAllVisibleHwnds()',
    )
    const startProcessIndex = script.indexOf('Start-Process')

    expect(snapshotIndex).toBeGreaterThanOrEqual(0)
    expect(startProcessIndex).toBeGreaterThanOrEqual(0)
    expect(snapshotIndex).toBeLessThan(startProcessIndex)
  })

  it('keeps stable failure markers for launch and hwnd lookup', () => {
    const script = buildWindowsAppLaunchScript('Notepad')

    expect(script).toContain('Write-Host "LAUNCH_FAILED"')
    expect(script).toContain('Write-Host "HWND_NOT_FOUND|$($proc.Id)"')
  })
})
