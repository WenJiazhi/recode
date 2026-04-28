import { expect, test } from 'bun:test'

test('win32 uiAutomation exposes hwnd-based root lookup for bound window actions', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/win32/uiAutomation.ts',
  ).text()

  expect(source).toContain('const PS_FIND_WINDOW_BY_HWND = `')
  expect(source).toContain('[System.Windows.Automation.AutomationElement]::FromHandle($handle)')
  expect(source).toContain('export function findElementByHwnd(')
  expect(source).toContain('export function clickElementByHwnd(')
  expect(source).toContain('export function setValueByHwnd(')
})
