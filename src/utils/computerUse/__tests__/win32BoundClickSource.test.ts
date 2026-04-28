import { expect, test } from 'bun:test'

test('bound win32 click routes through parent hwnd sendClick path', async () => {
  const source = await Bun.file('src/utils/computerUse/platforms/win32.ts').text()

  expect(source).toContain(
    'const ok = getWm().sendClick(',
  )
  expect(source).toContain('if (!ok) {')
  expect(source).toContain(`click failed: SendMessage to HWND \${boundHwnd} returned false.`)
  expect(source).not.toContain('const editHwnd = getWm().findEditChild(boundHwnd)')
})

test('win32 scroll fails closed when the PowerShell SendMessage/SendInput path fails', async () => {
  const source = await Bun.file('src/utils/computerUse/platforms/win32.ts').text()

  expect(source).toContain('public struct SCROLLINFO {')
  expect(source).toContain('public static extern bool GetScrollInfo(IntPtr h, int nBar, ref SCROLLINFO info);')
  expect(source).toContain('$canVerify = [WScroll]::GetScrollInfo($hwnd, $bar, [ref]$before)')
  expect(source).toContain('if ([WScroll]::GetScrollInfo($hwnd, $bar, [ref]$after) -and $before.nPos -eq $after.nPos) {')
  expect(source).toContain('Write-Output "NO_SCROLL"')
  expect(source).toContain('Write-Output "SCROLLED"')
  expect(source).toContain("if (scrollResult === null || scrollResult === 'NO_SCROLL') {")
  expect(source).toContain(`throw new Error(\`scroll failed on HWND \${boundHwnd}\`)`)
  expect(source).toContain(`throw new Error(\`global scroll failed (\${direction})\`)`)
})
