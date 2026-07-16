import { expect, test } from 'bun:test'

test('executorCrossPlatform bound element focus fallback no longer bypasses windowMessage remap', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain('resolveScreenPointToBoundClientPosition({')
  expect(source).toContain("sendClick(hwnd, clientPoint.x, clientPoint.y, 'left')")
  expect(source).not.toContain('sendClick(editHwnd ?? hwnd, cx - nc.dx, cy - nc.dy,')
})

test('executorCrossPlatform routes bound Win32 scrolls through mouseWheel before legacy scroll fallback', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain("if (isBound() && process.platform === 'win32') {")
  expect(source).toContain('const handled = await (this as any).mouseWheel(x, y, dy, false)')
  expect(source).toContain("if (!handled) await platform.input.scroll(dy, 'vertical')")
  expect(source).toContain('const handled = await (this as any).mouseWheel(x, y, dx, true)')
  expect(source).toContain("if (!handled) await platform.input.scroll(dx, 'horizontal')")
})

test('executorCrossPlatform only short-circuits bound mouseWheel when the bridge explicitly succeeds', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain("const result = bridge.callSync<boolean>('send_mouse_wheel', {")
  expect(source).toContain('if (result === true) return true')
  expect(source).not.toContain('if (result !== null) return true')
})

test('executorCrossPlatform converts bound mouseWheel coordinates into client coordinates before dispatch', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain('const nc = getCachedNcOffset()')
  expect(source).toContain('const wheelX = Math.round(x) - nc.dx')
  expect(source).toContain('const wheelY = Math.round(y) - nc.dy')
  expect(source).toContain('x: wheelX')
  expect(source).toContain('y: wheelY')
  expect(source).toContain('return sendMouseWheel(hwnd, wheelX, wheelY, delta, horizontal ?? false)')
})

test('executorCrossPlatform bound UIA element actions use the bound hwnd instead of re-finding by title', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain("const { clickElementByHwnd: uiaClick } =")
  expect(source).toContain('if (uiaClick(hwnd, node.automationId)) return true')
  expect(source).toContain("const { setValueByHwnd: setValue, findElementByHwnd: findElement } =")
  expect(source).toContain('if (setValue(hwnd, query.automationId, text)) return true')
  expect(source).toContain('const el = findElement(hwnd, {')
  expect(source).not.toContain("if (uiaClick(win.title, node.automationId)) return true")
})

test('executorCrossPlatform maps type_into_element role to UIA controlType on the bound hwnd fast path', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain('const el = findElement(hwnd, {')
  expect(source).toContain('name: query.name,')
  expect(source).toContain('controlType: query.role,')
  expect(source).toContain('automationId: query.automationId,')
  expect(source).not.toContain('const el = findElement(hwnd, query)')
})

test('executorCrossPlatform virtualKeyboard fails closed when bound Win32 keyboard injection cannot resolve or send keys', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain("if (!wm.sendText(hwnd, opts.text)) return false")
  expect(source).toContain("if (!wm.sendKeys(hwnd, parts)) return false")
  expect(source).toContain('const vk = resolveVk(opts.text)')
  expect(source).toContain('if (vk === null) return false')
  expect(source).toContain("if (!wm.sendKey(hwnd, vk, 'down')) return false")
  expect(source).toContain("if (!wm.sendKey(hwnd, vk, 'up')) return false")
  expect(source).toContain('const keys = parts.map(k => {')
  expect(source).toContain('if (keys.some(k => k === null)) return false')
  expect(source).toContain('for (const pressedVk of pressed.reverse()) {')
})

test('executorCrossPlatform holdKey releases already-pressed keys in reverse order when a later press or release fails', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain('const pressed: string[] = []')
  expect(source).toContain('let primaryError: unknown = null')
  expect(source).toContain('let releaseError: unknown = null')
  expect(source).toContain('pressed.push(k)')
  expect(source).toContain('for (const k of [...pressed].reverse()) {')
  expect(source).toContain("await platform.input.key(k, 'release')")
  expect(source).toContain('releaseError ??= error')
  expect(source).toContain('if (primaryError) {')
  expect(source).toContain('throw primaryError')
  expect(source).toContain('if (releaseError) {')
  expect(source).toContain('throw releaseError')
})

test('executorCrossPlatform statusIndicator reports the live indicator process state instead of bound-window state', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain("if (!ind.isIndicatorActive() && !ind.showIndicator(hwnd)) {")
  expect(source).toContain('return { active: ind.isIndicatorActive(), message }')
  expect(source).toContain('return { active: ind.isIndicatorActive() }')
  expect(source).toContain('return { active: false, ok: false }')
  expect(source).not.toContain('return { active: isBound() }')
})

test('executorCrossPlatform virtualMouse fails closed when Win32 sendMessage helpers reject the action', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain("if (!wm.sendClick(hwnd, x, y, 'left')) return false")
  expect(source).toContain("if (!wm.sendClick(hwnd, x, y, 'right')) return false")
  expect(source).toContain('if (!wm.sendMouseMove(hwnd, x, y)) return false')
  expect(source).toContain('if (!wm.sendMouseDown(hwnd, sx, sy)) return false')
  expect(source).toContain('if (!wm.sendMouseMove(hwnd, x, y)) return false')
  expect(source).toContain('if (!wm.sendMouseUp(hwnd, x, y)) return false')
  expect(source).toContain('if (!wm.sendMouseDown(hwnd, x, y)) return false')
  expect(source).toContain('if (!wm.sendMouseUp(hwnd, x, y)) return false')
})

test('executorCrossPlatform respondToPrompt fails closed when Win32 key/text injection rejects the action', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain("if (!wm.sendChar(hwnd, 'y')) return false")
  expect(source).toContain("if (!wm.sendChar(hwnd, 'n')) return false")
  expect(source).toContain("if (!wm.sendKey(hwnd, VK_RETURN, 'down')) return false")
  expect(source).toContain("if (!wm.sendKey(hwnd, VK_RETURN, 'up')) return false")
  expect(source).toContain("if (!wm.sendKey(hwnd, VK_ESCAPE, 'down')) return false")
  expect(source).toContain("if (!wm.sendKey(hwnd, VK_ESCAPE, 'up')) return false")
  expect(source).toContain("if (!wm.sendText(hwnd, opts.text)) return false")
})

test('executorCrossPlatform activateWindow and bound UIA fallbacks fail closed when sendClick rejects the focus click', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain("if (!platform.windowManagement.manageWindow('focus')) return false")
  expect(source).toContain("if (!sendClick(hwnd, clickX, clickY, 'left')) return false")
  expect(source).toContain("if (!sendClick(hwnd, cx, cy, 'left')) return false")
  expect(source).toContain("return sendClick(hwnd, clientPoint.x, clientPoint.y, 'left')")
  expect(source).toContain("if (!sendClick(hwnd, clientPoint.x, clientPoint.y, 'left')) return false")
})

test('executorCrossPlatform bound mouseDown/mouseUp/drag throw when Win32 sendMessage helpers reject the action', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain("if (!sendMouseDown(hwnd, pos.x, pos.y)) {")
  expect(source).toContain("throw new Error('Bound mouseDown failed.')")
  expect(source).toContain("if (!sendMouseUp(hwnd, pos.x, pos.y)) {")
  expect(source).toContain("throw new Error('Bound mouseUp failed.')")
  expect(source).toContain("if (!sendMouseDown(hwnd, startClient.x, startClient.y)) {")
  expect(source).toContain("throw new Error('Bound drag start failed.')")
  expect(source).toContain("if (!sendMouseMove(hwnd, tx, ty)) {")
  expect(source).toContain("throw new Error('Bound drag move failed.')")
  expect(source).toContain("if (!sendMouseUp(hwnd, tx, ty)) {")
  expect(source).toContain("throw new Error('Bound drag end failed.')")
})

test('executorCrossPlatform bound drag without a start coordinate still sends mouseDown from the current bound pointer', async () => {
  const source = await Bun.file(
    'src/utils/computerUse/executorCrossPlatform.ts',
  ).text()

  expect(source).toContain('const startClient = from')
  expect(source).toContain(': resolveBoundPointerClientPosition({')
  expect(source).toContain("if (!startClient) {")
  expect(source).toContain("throw new Error('Bound drag start point unavailable.')")
  expect(source).toContain('recordBoundPointerWindowPos(from.x, from.y)')
  expect(source).toContain('if (!sendMouseDown(hwnd, startClient.x, startClient.y)) {')
  expect(source).toContain("if (!sendMouseDown(hwnd, startClient.x, startClient.y)) {")
})
