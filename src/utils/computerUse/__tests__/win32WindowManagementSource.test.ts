import { expect, test } from 'bun:test'

test('win32 close management only releases the binding after confirming the window is gone', async () => {
  const source = await Bun.file('src/utils/computerUse/platforms/win32.ts').text()

  expect(source).toContain('public static extern bool IsWindow(IntPtr hWnd);')
  expect(source).toContain("if ([CuWinMgmt]::IsWindow($h)) { 'ALIVE' } else { 'CLOSED' }")
  expect(source).toContain("if (closeResult === 'CLOSED') {")
  expect(source).toContain('unbindWindow()')
  expect(source).toContain("return closeResult === 'CLOSED'")
})

test('window_management close messaging no longer promises unbind before the window actually closes', async () => {
  const source = await Bun.file('packages/@recode/computer-use-mcp/src/toolCalls.ts').text()

  expect(source).toContain(
    'Close requested (SendMessage WM_CLOSE). If the window actually closed, the window binding was released.',
  )
})

test('win32 window management checks post-action state instead of treating any PowerShell output as success', async () => {
  const source = await Bun.file('src/utils/computerUse/platforms/win32.ts').text()

  expect(source).toContain("if ([CuWinMgmt]::IsIconic($h)) { 'True' } else { 'False' }")
  expect(source).toContain("if ([CuWinMgmt]::IsZoomed($h)) { 'True' } else { 'False' }")
  expect(source).toContain(
    "if (-not [CuWinMgmt]::IsIconic($h) -and -not [CuWinMgmt]::IsZoomed($h)) { 'True' } else { 'False' }",
  )
  expect(source).toContain("if ($fg -or $top) { 'True' } else { 'False' }")
  expect(source).not.toContain("return r !== ''")
  expect(source).toContain("return focusResult === 'True'")
  expect(source).toContain("return moveOffscreenResult === 'True'")
  expect(source).toContain('return this.moveResize(opts.x, opts.y, opts.width, opts.height)')
})
