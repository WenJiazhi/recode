import { expect, test } from 'bun:test'

test('Win32 single-letter key paths use uppercase virtual-key codes', async () => {
  const executorSource = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()
  const platformSource = await Bun.file(
    'src/utils/computerUse/platforms/win32.ts',
  ).text()

  expect(executorSource).toContain(
    "rawKey.length === 1 ? rawKey.toUpperCase().charCodeAt(0) : 0",
  )
  expect(platformSource).toContain(
    "name.length === 1 ? name.toUpperCase().charCodeAt(0) : 0",
  )
  expect(platformSource).toContain(
    'is not supported for HWND $' + '{boundHwnd}',
  )
  expect(platformSource).toContain(
    'throw new Error(',
  )
  expect(platformSource).toContain(
    '$' + '{action} failed on HWND $' + '{boundHwnd}',
  )
})
