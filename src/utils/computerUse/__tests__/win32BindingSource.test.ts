import { expect, test } from 'bun:test'

test('bindFile clears an existing hwnd binding through the shared unbind path before switching to file mode', async () => {
  const source = await Bun.file('src/utils/computerUse/platforms/win32.ts').text()

  expect(source).toContain('if (boundHwnd) {')
  expect(source).toContain('    unbindWindow()')
  expect(source).toContain('export function bindFile(')
})
