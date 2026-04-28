import { describe, expect, it } from 'bun:test'

import { _test } from '../windowMessage.js'

describe('buildClientPointSetupScript', () => {
  it('remaps parent client coordinates into child client space when target differs', () => {
    const script = _test.buildClientPointSetupScript('100', '200', 120, 80)

    expect(script).toContain(
      '[WinMsg]::MapWindowPoints($sourceHwnd, $targetHwnd, [ref]$pt, 1) | Out-Null',
    )
    expect(script).toContain('$sourceHwnd = [IntPtr]::new([long]100)')
    expect(script).toContain('$targetHwnd = [IntPtr]::new([long]200)')
    expect(script).toContain('$pt.X = 120')
    expect(script).toContain('$pt.Y = 80')
  })

  it('skips remap when parent and target hwnd are the same', () => {
    const script = _test.buildClientPointSetupScript('100', '100', 120, 80)

    expect(script).not.toContain('MapWindowPoints')
  })
})

describe('single-key dispatch', () => {
  it('sendChar and sendKey route through resolveInputHwnd like the other input helpers', async () => {
    const source = await Bun.file(
      'src/utils/computerUse/win32/windowMessage.ts',
    ).text()

    expect(source).toContain('export function sendChar(hwnd: string, char: string): boolean {')
    expect(source).toContain('hwnd = resolveInputHwnd(validateHwnd(hwnd))')
    expect(source).toContain("action: 'down' | 'up',")
  })
})
