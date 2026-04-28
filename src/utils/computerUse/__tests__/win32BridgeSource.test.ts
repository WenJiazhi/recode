import { expect, test } from 'bun:test'

test('win32 bridge PrintWindow fallback captures from the whole window DC', async () => {
  const source = await Bun.file('src/utils/computerUse/win32/bridge.py').text()

  expect(source).toContain('hdc_window = user32.GetWindowDC(hwnd)')
  expect(source).not.toContain('hdc_window = user32.GetDC(hwnd)')
})

test('win32 bridge wheel dispatch remaps to the real input child before sending', async () => {
  const source = await Bun.file('src/utils/computerUse/win32/bridge.py').text()

  expect(source).toContain('user32.MapWindowPoints.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.POINTER(POINT), ctypes.c_uint]')
  expect(source).toContain('target_hwnd = int(find_edit_child(hwnd_str) or hwnd_str)')
  expect(source).toContain('if target_hwnd != source_hwnd:')
  expect(source).toContain('user32.MapWindowPoints(source_hwnd, target_hwnd, ctypes.byref(pt), 1)')
  expect(source).toContain('user32.ClientToScreen(target_hwnd, ctypes.byref(pt))')
  expect(source).toContain('SendMessageW(target_hwnd, msg, wparam, lparam)')
})
