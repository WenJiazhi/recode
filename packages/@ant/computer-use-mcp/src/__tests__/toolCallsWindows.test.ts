import { expect, test } from 'bun:test'

import { _test, handleToolCall } from '../toolCalls.js'
import type {
  ComputerUseHostAdapter,
  ComputerUseOverrides,
  Logger,
} from '../types.js'

function createLogger(): Logger {
  return {
    info() {},
    error() {},
    warn() {},
    debug() {},
    silly() {},
  }
}

function createAdapter(
  executorOverrides: Partial<ComputerUseHostAdapter['executor']> = {},
): ComputerUseHostAdapter {
  return {
    serverName: 'test-cu',
    logger: createLogger(),
    executor: {
      capabilities: {
        screenshotFiltering: 'none',
        platform: 'win32',
        hostBundleId: 'test.host',
      },
      prepareForAction: async () => [],
      previewHideSet: async () => [],
      getDisplaySize: async () => ({
        displayId: 1,
        width: 1920,
        height: 1080,
        scaleFactor: 1,
        originX: 0,
        originY: 0,
      }),
      listDisplays: async () => [],
      findWindowDisplays: async () => [],
      resolvePrepareCapture: async () => ({
        base64: '',
        width: 1,
        height: 1,
        displayWidth: 1,
        displayHeight: 1,
        originX: 0,
        originY: 0,
        hidden: [],
        displayId: 1,
      }),
      screenshot: async () => ({
        base64: '',
        width: 1,
        height: 1,
        displayWidth: 1,
        displayHeight: 1,
        originX: 0,
        originY: 0,
      }),
      zoom: async () => ({ base64: '', width: 1, height: 1 }),
      key: async () => {},
      holdKey: async () => {},
      type: async () => {},
      readClipboard: async () => '',
      writeClipboard: async () => {},
      moveMouse: async () => {},
      click: async () => {},
      mouseDown: async () => {},
      mouseUp: async () => {},
      getCursorPosition: async () => ({ x: 0, y: 0 }),
      drag: async () => {},
      scroll: async () => {},
      getFrontmostApp: async () => null,
      appUnderPoint: async () => null,
      listInstalledApps: async () => [],
      getAppIcon: async () => undefined,
      listRunningApps: async () => [],
      openApp: async () => {},
      ...executorOverrides,
    } as ComputerUseHostAdapter['executor'],
    ensureOsPermissions: async () => ({ granted: true }),
    isDisabled: () => false,
    getAutoUnhideEnabled: () => false,
    getSubGates: () => ({
      pixelValidation: false,
      clipboardPasteMultiline: false,
      mouseAnimation: false,
      hideBeforeAction: false,
      autoTargetDisplay: false,
      clipboardGuard: false,
    }),
    cropRawPatch: () => null,
  }
}

function createOverrides(): ComputerUseOverrides {
  return {
    allowedApps: [],
    grantFlags: {
      clipboardRead: false,
      clipboardWrite: false,
      systemKeyCombos: false,
    },
    coordinateMode: 'pixels',
    userDeniedBundleIds: [],
  }
}

test('handleToolCall open_terminal returns the multi-launcher failure message on Windows', async () => {
  const adapter = createAdapter({
    openTerminal: async () => null,
  })

  const result = await handleToolCall(
    adapter,
    'open_terminal',
    { agent: 'codex' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain(
    'Failed to open terminal. Tried Windows Terminal, PowerShell, and cmd.exe.',
  )
  expect(result.telemetry?.error_kind).toBe('launch_failed')
})

test('handleToolCall open_terminal reports the launched terminal and bound window on success', async () => {
  const adapter = createAdapter({
    openTerminal: async () => ({
      hwnd: '921342',
      title: 'Windows PowerShell',
      launched: true,
    }),
  })

  const result = await handleToolCall(
    adapter,
    'open_terminal',
    { agent: 'codex', terminal: 'powershell', working_directory: 'D:\\Desktop' },
    createOverrides(),
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('Windows PowerShell')
  expect(result.content[0]?.text).toContain('Status: bound to this terminal')
})

test('handleToolCall open_terminal rejects invalid terminal names instead of silently falling back', async () => {
  let called = false
  const adapter = createAdapter({
    openTerminal: async () => {
      called = true
      return null
    },
  })

  const result = await handleToolCall(
    adapter,
    'open_terminal',
    { agent: 'codex', terminal: 'pwsh' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'Invalid terminal "pwsh". Valid: wt, powershell, cmd.',
  )
  expect(called).toBe(false)
})

test("handleToolCall open_terminal requires a non-empty custom command", async () => {
  let called = false
  const adapter = createAdapter({
    openTerminal: async () => {
      called = true
      return null
    },
  })

  const result = await handleToolCall(
    adapter,
    "open_terminal",
    { agent: "custom", command: "   " },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe("bad_args")
  expect(result.content[0]?.text).toContain(
    "agent='custom' requires a non-empty command.",
  )
  expect(called).toBe(false)
})

test("handleToolCall open_terminal rejects non-string optional fields instead of silently ignoring them", async () => {
  let called = false
  const adapter = createAdapter({
    openTerminal: async () => {
      called = true
      return null
    },
  })

  const commandResult = await handleToolCall(
    adapter,
    "open_terminal",
    { agent: "codex", command: 123 },
    createOverrides(),
  )

  expect(commandResult.isError).toBe(true)
  expect(commandResult.telemetry?.error_kind).toBe("bad_args")
  expect(commandResult.content[0]?.text).toContain(
    "command must be a string when provided.",
  )

  const workdirResult = await handleToolCall(
    adapter,
    "open_terminal",
    { agent: "codex", working_directory: 42 },
    createOverrides(),
  )

  expect(workdirResult.isError).toBe(true)
  expect(workdirResult.telemetry?.error_kind).toBe("bad_args")
  expect(workdirResult.content[0]?.text).toContain(
    "working_directory must be a string when provided.",
  )
  expect(called).toBe(false)
})

test("handleToolCall open_terminal rejects blank working_directory values", async () => {
  let called = false
  const adapter = createAdapter({
    openTerminal: async () => {
      called = true
      return null
    },
  })

  const result = await handleToolCall(
    adapter,
    "open_terminal",
    { agent: "codex", working_directory: "   " },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe("bad_args")
  expect(result.content[0]?.text).toContain(
    "working_directory must be a non-empty string when provided.",
  )
  expect(called).toBe(false)
})

test('handleToolCall bind_window status reports an unbound session cleanly', async () => {
  const adapter = createAdapter({
    getBindingStatus: async () => ({ bound: false }),
  })

  const result = await handleToolCall(
    adapter,
    'bind_window',
    { action: 'status' },
    createOverrides(),
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain(
    "No window is currently bound. Use bind_window(action='list')",
  )
})

test('handleToolCall activate_window rejects malformed click coordinates instead of silently ignoring them', async () => {
  let called = false
  const adapter = createAdapter({
    activateWindow: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'activate_window',
    { click_x: '10', click_y: 20 },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'click_x and click_y must be finite numbers when provided.',
  )
  expect(called).toBe(false)
})

test('handleToolCall activate_window requires click_x and click_y together when overriding the focus click position', async () => {
  let called = false
  const adapter = createAdapter({
    activateWindow: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'activate_window',
    { click_x: 10 },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'click_x and click_y must be provided together when overriding the focus click position.',
  )
  expect(called).toBe(false)
})

test('handleToolCall activate_window returns a truthful generic failure when runtime returns false', async () => {
  const adapter = createAdapter({
    activateWindow: async () => false,
  })

  const result = await handleToolCall(
    adapter,
    'activate_window',
    {},
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Window activation failed. Ensure a compatible window is bound and can be focused.',
  )
})

test('handleToolCall bind_window binds and reports the matched window', async () => {
  const adapter = createAdapter({
    bindToWindow: async () => ({
      hwnd: '5374990',
      pid: 4242,
      title: 'Windows PowerShell',
    }),
  })

  const result = await handleToolCall(
    adapter,
    'bind_window',
    { action: 'bind', title: 'Windows PowerShell' },
    createOverrides(),
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('Bound to window: hwnd=5374990 pid=4242')
  expect(result.content[0]?.text).toContain('"Windows PowerShell"')
})

test('handleToolCall bind_window accepts numeric hwnd arguments', async () => {
  const adapter = createAdapter({
    bindToWindow: async ({ hwnd }) => ({
      hwnd: hwnd ?? '0',
      pid: 4242,
      title: 'Windows PowerShell',
    }),
  })

  const result = await handleToolCall(
    adapter,
    'bind_window',
    { action: 'bind', hwnd: 5374990 },
    createOverrides(),
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('hwnd=5374990')
})

test('handleToolCall bind_window rejects malformed hwnd arguments', async () => {
  let called = false
  const adapter = createAdapter({
    bindToWindow: async () => {
      called = true
      return {
        hwnd: '5374990',
        pid: 4242,
        title: 'Windows PowerShell',
      }
    },
  })

  const stringResult = await handleToolCall(
    adapter,
    'bind_window',
    { action: 'bind', hwnd: '5374990abc' },
    createOverrides(),
  )

  expect(stringResult.isError).toBe(true)
  expect(stringResult.telemetry?.error_kind).toBe('bad_args')
  expect(stringResult.content[0]?.text).toContain(
    'hwnd must be a positive integer or a string of digits.',
  )

  const floatResult = await handleToolCall(
    adapter,
    'bind_window',
    { action: 'bind', hwnd: 5374990.5 },
    createOverrides(),
  )

  expect(floatResult.isError).toBe(true)
  expect(floatResult.telemetry?.error_kind).toBe('bad_args')
  expect(floatResult.content[0]?.text).toContain(
    'hwnd must be a positive integer or a string of digits.',
  )
  expect(called).toBe(false)
})

test('handleToolCall bind_window accepts string pid arguments', async () => {
  const adapter = createAdapter({
    bindToWindow: async ({ pid }) => ({
      hwnd: '5374990',
      pid: pid ?? 0,
      title: 'Windows PowerShell',
    }),
  })

  const result = await handleToolCall(
    adapter,
    'bind_window',
    { action: 'bind', pid: '4242' },
    createOverrides(),
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('pid=4242')
})

test('handleToolCall bind_window rejects malformed string pid arguments', async () => {
  let called = false
  const adapter = createAdapter({
    bindToWindow: async () => {
      called = true
      return {
        hwnd: '5374990',
        pid: 4242,
        title: 'Windows PowerShell',
      }
    },
  })

  const result = await handleToolCall(
    adapter,
    'bind_window',
    { action: 'bind', pid: '4242abc' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'pid must be a positive integer or a string of digits.',
  )
  expect(called).toBe(false)
})

test("handleToolCall click_element rejects malformed selector fields", async () => {
  let called = false
  const adapter = createAdapter({
    clickElement: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    "click_element",
    { name: "Save", role: 123 },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe("bad_args")
  expect(result.content[0]?.text).toContain('"role" must be a string.')
  expect(called).toBe(false)
})

test("handleToolCall type_into_element rejects malformed selector fields", async () => {
  let called = false
  const adapter = createAdapter({
    typeIntoElement: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    "type_into_element",
    { text: "hello", name: "Search", automationId: 42 },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe("bad_args")
  expect(result.content[0]?.text).toContain('"automationId" must be a string.')
  expect(called).toBe(false)
})

test("handleToolCall type_into_element requires at least one selector field", async () => {
  let called = false
  const adapter = createAdapter({
    typeIntoElement: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    "type_into_element",
    { text: "hello" },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe("bad_args")
  expect(result.content[0]?.text).toContain(
    "At least one of name, role, or automationId is required.",
  )
  expect(called).toBe(false)
})

test("handleToolCall click_element rejects whitespace-only selector fields", async () => {
  let called = false
  const adapter = createAdapter({
    clickElement: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    "click_element",
    { name: "   ", role: "\t", automationId: "" },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe("bad_args")
  expect(result.content[0]?.text).toContain(
    "At least one of name, role, or automationId is required.",
  )
  expect(called).toBe(false)
})

test("handleToolCall type_into_element rejects whitespace-only selector fields", async () => {
  let called = false
  const adapter = createAdapter({
    typeIntoElement: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    "type_into_element",
    { text: "hello", name: "   ", role: "\t", automationId: "" },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe("bad_args")
  expect(result.content[0]?.text).toContain(
    "At least one of name, role, or automationId is required.",
  )
  expect(called).toBe(false)
})

test('handleToolCall type rejects empty text before runtime dispatch', async () => {
  let called = false
  const adapter = createAdapter({
    type: async () => {
      called = true
    },
  })

  const result = await handleToolCall(
    adapter,
    'type',
    { text: '' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain('text must not be empty')
  expect(called).toBe(false)
})

test('handleToolCall type_into_element rejects empty text before runtime dispatch', async () => {
  let called = false
  const adapter = createAdapter({
    typeIntoElement: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'type_into_element',
    { text: '', name: 'Search' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain('text must not be empty')
  expect(called).toBe(false)
})

test('handleToolCall click_element returns truthful runtime failure guidance', async () => {
  const adapter = createAdapter({
    clickElement: async () => false,
  })

  const result = await handleToolCall(
    adapter,
    'click_element',
    { name: 'Save', role: 'button' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('element_not_found')
  expect(result.content[0]?.text).toContain('Element action failed for:')
  expect(result.content[0]?.text).toContain('name="Save"')
  expect(result.content[0]?.text).toContain('role=button')
  expect(result.content[0]?.text).toContain(
    'The element may not exist, may not be actionable, or bound-window input delivery may have failed.',
  )
  expect(result.content[0]?.text).toContain('Take a screenshot to inspect the current UI state.')
})

test('handleToolCall type_into_element returns truthful runtime failure guidance', async () => {
  const adapter = createAdapter({
    typeIntoElement: async () => false,
  })

  const result = await handleToolCall(
    adapter,
    'type_into_element',
    { text: 'hello', name: 'Search', role: 'textbox' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('element_not_found')
  expect(result.content[0]?.text).toContain('Element text entry failed for:')
  expect(result.content[0]?.text).toContain('name="Search"')
  expect(result.content[0]?.text).toContain('role=textbox')
  expect(result.content[0]?.text).toContain(
    'The element may not exist, may not support text input, or bound-window input delivery may have failed.',
  )
})

test('handleToolCall prompt_respond rejects invalid arrow_direction values', async () => {
  let called = false
  const adapter = createAdapter({
    respondToPrompt: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'prompt_respond',
    {
      response_type: 'select',
      arrow_count: 1,
      arrow_direction: 'left',
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'Invalid arrow_direction "left". Valid: up, down.',
  )
  expect(called).toBe(false)
})

test('handleToolCall prompt_respond select defaults arrow_count to the executor fallback when omitted', async () => {
  let captured: Record<string, unknown> | null = null
  const adapter = createAdapter({
    respondToPrompt: async opts => {
      captured = opts as Record<string, unknown>
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'prompt_respond',
    {
      response_type: 'select',
    },
    createOverrides(),
  )

  expect(result.isError).toBeFalsy()
  expect(result.content[0]?.text).toContain('Navigated down 1 time(s) + Enter.')
  expect(captured).toEqual({
    responseType: 'select',
    arrowDirection: undefined,
    arrowCount: undefined,
    text: undefined,
  })
})

test('handleToolCall prompt_respond rejects negative arrow_count values', async () => {
  let called = false
  const adapter = createAdapter({
    respondToPrompt: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'prompt_respond',
    {
      response_type: 'select',
      arrow_count: -1,
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'arrow_count must be an integer between 0 and 50.',
  )
  expect(called).toBe(false)
})

test('handleToolCall prompt_respond rejects arrow_count values above the declared schema maximum', async () => {
  let called = false
  const adapter = createAdapter({
    respondToPrompt: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'prompt_respond',
    {
      response_type: 'select',
      arrow_count: 51,
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'arrow_count must be an integer between 0 and 50.',
  )
  expect(called).toBe(false)
})

test('handleToolCall virtual_keyboard rejects repeat values outside the declared range', async () => {
  let called = false
  const adapter = createAdapter({
    virtualKeyboard: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'virtual_keyboard',
    {
      action: 'press',
      text: 'a',
      repeat: 0,
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'repeat must be an integer between 1 and 100.',
  )
  expect(called).toBe(false)
})

test('handleToolCall virtual_keyboard rejects negative duration values', async () => {
  let called = false
  const adapter = createAdapter({
    virtualKeyboard: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'virtual_keyboard',
    {
      action: 'hold',
      text: 'ctrl',
      duration: -1,
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'duration must be a finite number greater than or equal to 0.',
  )
  expect(called).toBe(false)
})

test('handleToolCall virtual_keyboard rejects non-string-coerced repeat and duration values instead of silently defaulting them', async () => {
  let called = false
  const adapter = createAdapter({
    virtualKeyboard: async () => {
      called = true
      return true
    },
  })

  const repeatResult = await handleToolCall(
    adapter,
    'virtual_keyboard',
    {
      action: 'press',
      text: 'a',
      repeat: '3',
    },
    createOverrides(),
  )

  expect(repeatResult.isError).toBe(true)
  expect(repeatResult.telemetry?.error_kind).toBe('bad_args')
  expect(repeatResult.content[0]?.text).toContain(
    'repeat must be an integer between 1 and 100.',
  )

  const durationResult = await handleToolCall(
    adapter,
    'virtual_keyboard',
    {
      action: 'hold',
      text: 'shift',
      duration: '2',
    },
    createOverrides(),
  )

  expect(durationResult.isError).toBe(true)
  expect(durationResult.telemetry?.error_kind).toBe('bad_args')
  expect(durationResult.content[0]?.text).toContain(
    'duration must be a finite number greater than or equal to 0.',
  )
  expect(called).toBe(false)
})

test('handleToolCall virtual_keyboard rejects blank text for non-type actions before runtime dispatch', async () => {
  let called = false
  const adapter = createAdapter({
    virtualKeyboard: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'virtual_keyboard',
    {
      action: 'press',
      text: '   ',
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'press requires a non-empty text value.',
  )
  expect(called).toBe(false)
})

test('handleToolCall key rejects blank key sequences before runtime dispatch', async () => {
  let called = false
  const adapter = createAdapter({
    key: async () => {
      called = true
    },
  })

  const result = await handleToolCall(
    adapter,
    'key',
    {
      text: '   ',
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'text must be a non-empty key sequence',
  )
  expect(called).toBe(false)
})

test('handleToolCall hold_key rejects blank key sequences before runtime dispatch', async () => {
  let called = false
  const adapter = createAdapter({
    holdKey: async () => {
      called = true
    },
  })

  const result = await handleToolCall(
    adapter,
    'hold_key',
    {
      text: '   ',
      duration: 1,
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'text must be a non-empty key sequence',
  )
  expect(called).toBe(false)
})

test('handleToolCall virtual_keyboard reports a generic keyboard failure instead of always blaming missing binding', async () => {
  const adapter = createAdapter({
    virtualKeyboard: async () => false,
  })

  const result = await handleToolCall(
    adapter,
    'virtual_keyboard',
    {
      action: 'combo',
      text: 'ctrl+bogus',
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Keyboard input failed. Ensure a compatible window is bound and the requested keys are supported.',
  )
})

test('handleToolCall virtual_mouse rejects malformed coordinates instead of forwarding them', async () => {
  let called = false
  const adapter = createAdapter({
    virtualMouse: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'virtual_mouse',
    {
      action: 'click',
      coordinate: [10, 20, 30],
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'coordinate must be an array of length 2',
  )
  expect(called).toBe(false)
})

test('handleToolCall virtual_mouse returns a truthful generic failure when runtime returns false', async () => {
  const adapter = createAdapter({
    virtualMouse: async () => false,
  })

  const result = await handleToolCall(
    adapter,
    'virtual_mouse',
    {
      action: 'move',
      coordinate: [10, 20],
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Virtual mouse action failed. Ensure a compatible window is bound and the requested pointer action is supported.',
  )
})

test('handleToolCall mouse_wheel rejects non-finite delta values', async () => {
  let called = false
  const adapter = createAdapter({
    mouseWheel: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'mouse_wheel',
    {
      coordinate: [10, 20],
      delta: Infinity,
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'delta must be a non-zero integer (positive=up, negative=down).',
  )
  expect(called).toBe(false)
})

test('handleToolCall mouse_wheel rejects zero and non-integer delta values', async () => {
  let called = false
  const adapter = createAdapter({
    mouseWheel: async () => {
      called = true
      return true
    },
  })

  const zeroResult = await handleToolCall(
    adapter,
    'mouse_wheel',
    {
      coordinate: [10, 20],
      delta: 0,
    },
    createOverrides(),
  )

  expect(zeroResult.isError).toBe(true)
  expect(zeroResult.telemetry?.error_kind).toBe('bad_args')
  expect(zeroResult.content[0]?.text).toContain(
    'delta must be a non-zero integer (positive=up, negative=down).',
  )

  const floatResult = await handleToolCall(
    adapter,
    'mouse_wheel',
    {
      coordinate: [10, 20],
      delta: 1.5,
    },
    createOverrides(),
  )

  expect(floatResult.isError).toBe(true)
  expect(floatResult.telemetry?.error_kind).toBe('bad_args')
  expect(floatResult.content[0]?.text).toContain(
    'delta must be a non-zero integer (positive=up, negative=down).',
  )
  expect(called).toBe(false)
})

test('handleToolCall mouse_wheel rejects invalid direction values', async () => {
  let called = false
  const adapter = createAdapter({
    mouseWheel: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'mouse_wheel',
    {
      coordinate: [10, 20],
      delta: 1,
      direction: 'diagonal',
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'direction must be "vertical" or "horizontal" when provided.',
  )
  expect(called).toBe(false)
})

test('handleToolCall mouse_wheel rejects non-string direction values instead of silently defaulting to vertical', async () => {
  let called = false
  const adapter = createAdapter({
    mouseWheel: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'mouse_wheel',
    {
      coordinate: [10, 20],
      delta: 120,
      direction: 1,
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'direction must be "vertical" or "horizontal" when provided.',
  )
  expect(called).toBe(false)
})

test('handleToolCall mouse_wheel reports left/right labels for horizontal scroll', async () => {
  const adapter = createAdapter({
    mouseWheel: async () => true,
  })

  const result = await handleToolCall(
    adapter,
    'mouse_wheel',
    {
      coordinate: [10, 20],
      delta: -2,
      direction: 'horizontal',
    },
    createOverrides(),
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.text).toContain('Mouse wheel: horizontal scroll left 2 click(s)')
})

test('handleToolCall mouse_wheel returns a truthful generic failure when runtime returns false', async () => {
  const adapter = createAdapter({
    mouseWheel: async () => false,
  })

  const result = await handleToolCall(
    adapter,
    'mouse_wheel',
    {
      coordinate: [10, 20],
      delta: 1,
    },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Mouse wheel action failed. Ensure a compatible window is bound and the target window accepts scrolling.',
  )
})

test('handleToolCall cursor_position treats the screenshot right edge as off-display', async () => {
  const adapter = createAdapter({
    getCursorPosition: async () => ({ x: 1920, y: 500 }),
  })
  const overrides = createOverrides()
  overrides.lastScreenshot = {
    base64: '',
    width: 960,
    height: 540,
    displayWidth: 1920,
    displayHeight: 1080,
    originX: 0,
    originY: 0,
  }

  const result = await handleToolCall(
    adapter,
    'cursor_position',
    {},
    overrides,
  )

  const payload = JSON.parse(result.content[0]?.text ?? '{}')
  expect(payload.coordinateSpace).toBe('logical_points')
  expect(payload.x).toBe(1920)
  expect(payload.note).toContain('different monitor')
})

test('handleToolCall status_indicator(show) rejects non-string message values instead of treating them as missing', async () => {
  let called = false
  const adapter = createAdapter({
    statusIndicator: async () => {
      called = true
      return { active: true }
    },
  })

  const result = await handleToolCall(
    adapter,
    'status_indicator',
    { action: 'show', message: 123 },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    '"show" requires "message" to be a string.',
  )
  expect(called).toBe(false)
})

test('handleToolCall status_indicator(show) rejects blank message values before runtime dispatch', async () => {
  let called = false
  const adapter = createAdapter({
    statusIndicator: async () => {
      called = true
      return { active: true }
    },
  })

  const result = await handleToolCall(
    adapter,
    'status_indicator',
    { action: 'show', message: '   ' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    "'show' requires a message parameter.",
  )
  expect(called).toBe(false)
})

test('handleToolCall status_indicator(show) returns a truthful error when runtime cannot activate the indicator', async () => {
  const adapter = createAdapter({
    statusIndicator: async () => ({ active: false }),
  })

  const result = await handleToolCall(
    adapter,
    'status_indicator',
    { action: 'show', message: 'Working...' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Status indicator could not be shown on the bound window.',
  )
})

test('handleToolCall status_indicator(hide) returns a truthful error when runtime keeps the indicator active', async () => {
  const adapter = createAdapter({
    statusIndicator: async () => ({ active: true }),
  })

  const result = await handleToolCall(
    adapter,
    'status_indicator',
    { action: 'hide' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Status indicator could not be hidden from the bound window.',
  )
})

test('handleToolCall status_indicator(status) no longer claims the indicator is inactive because no window is bound', async () => {
  const adapter = createAdapter({
    statusIndicator: async () => ({ active: false }),
  })

  const result = await handleToolCall(
    adapter,
    'status_indicator',
    { action: 'status' },
    createOverrides(),
  )

  expect(result.isError).toBeFalsy()
  expect(result.content[0]?.text).toContain('Indicator is not active.')
  expect(result.content[0]?.text).not.toContain('no window bound')
})

test('handleToolCall status_indicator(status) reports active state without overclaiming window ownership', async () => {
  const adapter = createAdapter({
    statusIndicator: async () => ({ active: true }),
  })

  const result = await handleToolCall(
    adapter,
    'status_indicator',
    { action: 'status' },
    createOverrides(),
  )

  expect(result.isError).toBeFalsy()
  expect(result.content[0]?.text).toContain('Indicator is active.')
  expect(result.content[0]?.text).not.toContain('bound window')
})

test('handleToolCall status_indicator(status) reports runtime status-check failure instead of inactive state', async () => {
  const adapter = createAdapter({
    statusIndicator: async () => ({ active: false, ok: false }),
  })

  const result = await handleToolCall(
    adapter,
    'status_indicator',
    { action: 'status' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Status indicator state could not be checked.',
  )
})

test('handleToolCall status_indicator(hide) reports runtime hide failure instead of success', async () => {
  const adapter = createAdapter({
    statusIndicator: async () => ({ active: false, ok: false }),
  })

  const result = await handleToolCall(
    adapter,
    'status_indicator',
    { action: 'hide' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Status indicator could not be hidden from the bound window.',
  )
})

test('handleToolCall prompt_respond returns a truthful generic failure when runtime returns false', async () => {
  const adapter = createAdapter({
    respondToPrompt: async () => false,
  })

  const result = await handleToolCall(
    adapter,
    'prompt_respond',
    { response_type: 'enter' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Prompt response failed. Ensure a compatible window is bound and an actionable prompt is visible.',
  )
})

test('handleToolCall prompt_respond(type) rejects empty text before runtime dispatch', async () => {
  let called = false
  const adapter = createAdapter({
    respondToPrompt: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'prompt_respond',
    { response_type: 'type', text: '' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain('text must not be empty.')
  expect(called).toBe(false)
})

test('resolveRequestedApps fuzzy-matches common Windows terminal names used by request_access', () => {
  const resolved = _test.resolveRequestedApps(
    ['powershell.exe', 'Windows Terminal', 'cmd.exe'],
    [
      {
        bundleId: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
        displayName: 'PowerShell',
        path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
      },
      {
        bundleId: 'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
        displayName: 'Windows Terminal',
        path: 'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
      },
      {
        bundleId: 'C:\\Windows\\System32\\cmd.exe',
        displayName: 'Command Prompt',
        path: 'C:\\Windows\\System32\\cmd.exe',
      },
    ],
    new Set<string>(),
  )

  expect(resolved).toHaveLength(3)
  expect(resolved[0]?.resolved?.displayName).toBe('PowerShell')
  expect(resolved[1]?.resolved?.displayName).toBe('Windows Terminal')
  expect(resolved[2]?.resolved?.displayName).toBe('Command Prompt')
})

test('resolveRequestedApps does not silently pick one app when an exact display-name match is ambiguous', () => {
  const resolved = _test.resolveRequestedApps(
    ['Terminal'],
    [
      {
        bundleId: 'com.microsoft.wt',
        displayName: 'Terminal',
        path: 'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
      },
      {
        bundleId: 'com.example.terminal',
        displayName: 'Terminal',
        path: 'C:\\Tools\\terminal.exe',
      },
    ],
    new Set<string>(),
  )

  expect(resolved).toHaveLength(1)
  expect(resolved[0]?.resolved).toBeUndefined()
})

test('normalizeRequestedAppNames trims, deduplicates, and drops empty entries', () => {
  const normalized = _test.normalizeRequestedAppNames([
    '  PowerShell  ',
    '',
    'powershell',
    'Windows Terminal',
    ' windows terminal ',
    '   ',
    'cmd.exe',
  ])

  expect(normalized).toEqual([
    'PowerShell',
    'Windows Terminal',
    'cmd.exe',
  ])
})

test('handleToolCall request_access rejects empty normalized apps when no grant flags are requested', async () => {
  const overrides = {
    ...createOverrides(),
    onPermissionRequest: async () => ({
      granted: [],
      denied: [],
      flags: createOverrides().grantFlags,
    }),
  }

  const result = await handleToolCall(
    createAdapter(),
    'request_access',
    { reason: 'open terminal', apps: ['   ', ''] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('"apps" must include at least one non-empty application name')
})

test('handleToolCall request_access rejects blank reasons before opening the approval dialog', async () => {
  const overrides = {
    ...createOverrides(),
    onPermissionRequest: async () => {
      throw new Error('request_access should not open the approval dialog for a blank reason')
    },
  }

  const result = await handleToolCall(
    createAdapter(),
    'request_access',
    { reason: '   ', apps: ['PowerShell'] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain('reason must be a non-empty string')
})

test('handleToolCall request_teach_access rejects empty normalized apps', async () => {
  const overrides = {
    ...createOverrides(),
    onTeachPermissionRequest: async () => ({
      granted: [],
      denied: [],
      flags: createOverrides().grantFlags,
    }),
  }

  const result = await handleToolCall(
    createAdapter(),
    'request_teach_access',
    { reason: 'guide me', apps: ['   ', ''] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('"apps" must include at least one non-empty application name')
})

test('handleToolCall request_teach_access rejects blank reasons before opening the approval dialog', async () => {
  const overrides = {
    ...createOverrides(),
    onTeachPermissionRequest: async () => {
      throw new Error('request_teach_access should not open the approval dialog for a blank reason')
    },
  }

  const result = await handleToolCall(
    createAdapter(),
    'request_teach_access',
    { reason: '   ', apps: ['PowerShell'] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain('reason must be a non-empty string')
})

test('request_access reports TCC recheck success as a non-error result', async () => {
  let ensureCount = 0
  const adapter = createAdapter({
    capabilities: {
      screenshotFiltering: 'none',
      platform: 'darwin',
      hostBundleId: 'test.host',
    },
  })
  adapter.ensureOsPermissions = async () => {
    ensureCount += 1
    if (ensureCount === 1) {
      return {
        granted: false,
        accessibility: false,
        screenRecording: false,
      }
    }
    return { granted: true }
  }

  const result = await handleToolCall(
    adapter,
    'request_access',
    { reason: 'grant permissions', apps: ['Terminal'] },
    {
      ...createOverrides(),
      onPermissionRequest: async (request) => {
        expect(request.apps).toEqual([])
        expect(request.tccState).toEqual({
          accessibility: false,
          screenRecording: false,
        })
        return {
          granted: [],
          denied: [],
          flags: createOverrides().grantFlags,
        }
      },
    },
  )

  expect(ensureCount).toBe(2)
  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('Call request_access again immediately')
})

test('request_teach_access reports TCC recheck success as a non-error result', async () => {
  let ensureCount = 0
  const adapter = createAdapter({
    capabilities: {
      screenshotFiltering: 'none',
      platform: 'darwin',
      hostBundleId: 'test.host',
    },
  })
  adapter.ensureOsPermissions = async () => {
    ensureCount += 1
    if (ensureCount === 1) {
      return {
        granted: false,
        accessibility: false,
        screenRecording: false,
      }
    }
    return { granted: true }
  }

  const result = await handleToolCall(
    adapter,
    'request_teach_access',
    { reason: 'grant permissions', apps: ['Terminal'] },
    {
      ...createOverrides(),
      onTeachPermissionRequest: async (request) => {
        expect(request.apps).toEqual([])
        expect(request.tccState).toEqual({
          accessibility: false,
          screenRecording: false,
        })
        return {
          granted: [],
          denied: [],
          flags: createOverrides().grantFlags,
        }
      },
    },
  )

  expect(ensureCount).toBe(2)
  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('Call request_teach_access again immediately')
})

test('request_access returns actionable suggestions for unresolved Windows apps when close matches exist', async () => {
  const overrides = {
    ...createOverrides(),
    onPermissionRequest: async () => {
      throw new Error('request_access should not open the approval dialog for unresolved apps')
    },
  }

  const result = await handleToolCall(
    createAdapter({
      listInstalledApps: async () => [
        {
          bundleId: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
          displayName: 'PowerShell',
          path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
        },
        {
          bundleId: 'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
          displayName: 'Windows Terminal',
          path: 'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
        },
      ],
    }),
    'request_access',
    { reason: 'open shell', apps: ['Power Shell', 'Window Terminal'] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('None of the requested applications could be resolved')
  expect(result.content[0]?.text).toContain('PowerShell')
  expect(result.content[0]?.text).toContain('Windows Terminal')
})

test('request_access reports ambiguous exact display-name matches instead of silently choosing one app', async () => {
  const overrides = {
    ...createOverrides(),
    onPermissionRequest: async () => {
      throw new Error('request_access should not open the approval dialog for ambiguous app names')
    },
  }

  const result = await handleToolCall(
    createAdapter({
      listInstalledApps: async () => [
        {
          bundleId: 'com.microsoft.wt',
          displayName: 'Terminal',
          path: 'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
        },
        {
          bundleId: 'com.example.terminal',
          displayName: 'Terminal',
          path: 'C:\\Tools\\terminal.exe',
        },
      ],
    }),
    'request_access',
    { reason: 'open terminal', apps: ['Terminal'] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    '"Terminal" matches multiple installed applications.',
  )
  expect(result.content[0]?.text).toContain('"wt.exe" (com.microsoft.wt)')
  expect(result.content[0]?.text).toContain('"terminal.exe" (com.example.terminal)')
})

test('request_access with grant flags still returns unresolved guidance instead of opening the dialog', async () => {
  const overrides = {
    ...createOverrides(),
    onPermissionRequest: async () => {
      throw new Error('request_access should not open the approval dialog for unresolved apps')
    },
  }

  const result = await handleToolCall(
    createAdapter({
      listInstalledApps: async () => [],
    }),
    'request_access',
    { reason: 'read clipboard', apps: ['Totally Made Up App'], clipboardRead: true },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('None of the requested applications could be resolved')
  expect(result.content[0]?.text).toContain('exact installed app name or executable name')
})

test('request_access ignores explicit false grant flags when validating empty app lists', async () => {
  const overrides = {
    ...createOverrides(),
    onPermissionRequest: async () => {
      throw new Error('request_access should not open the approval dialog for empty apps')
    },
  }

  const result = await handleToolCall(
    createAdapter(),
    'request_access',
    { reason: 'open shell', apps: ['   '], clipboardRead: false },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('"apps" must include at least one non-empty application name')
})

test('request_teach_access returns generic unresolved guidance when no suggestions exist', async () => {
  const overrides = {
    ...createOverrides(),
    onTeachPermissionRequest: async () => {
      throw new Error('request_teach_access should not open the approval dialog for unresolved apps')
    },
  }

  const result = await handleToolCall(
    createAdapter({
      listInstalledApps: async () => [],
    }),
    'request_teach_access',
    { reason: 'guide me', apps: ['Totally Made Up App'] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('None of the requested applications could be resolved')
  expect(result.content[0]?.text).toContain('exact installed app name or executable name')
})

test('request_teach_access unresolved guidance stays generic across platforms', async () => {
  const overrides = {
    ...createOverrides(),
    onTeachPermissionRequest: async () => {
      throw new Error('request_teach_access should not open the approval dialog for unresolved apps')
    },
  }

  const result = await handleToolCall(
    createAdapter({
      capabilities: {
        screenshotFiltering: 'none',
        platform: 'darwin',
        hostBundleId: 'test.host',
      },
      listInstalledApps: async () => [],
    }),
    'request_teach_access',
    { reason: 'guide me', apps: ['Totally Made Up App'] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).not.toContain('Windows')
  expect(result.content[0]?.text).not.toContain('powershell.exe')
  expect(result.content[0]?.text).not.toContain('cmd.exe')
})

test('request_access only sends resolved apps to the approval dialog and returns unresolved apps as not_installed', async () => {
  const overrides = {
    ...createOverrides(),
    onPermissionRequest: async (request) => {
      expect(request.apps).toHaveLength(1)
      expect(request.apps[0]?.requestedName).toBe('PowerShell')
      expect(request.apps[0]?.resolved?.displayName).toBe('PowerShell')
      return {
        granted: [
          {
            bundleId: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
            displayName: 'PowerShell',
            grantedAt: 123,
            tier: 'click',
          },
        ],
        denied: [],
        flags: createOverrides().grantFlags,
      }
    },
  }

  const result = await handleToolCall(
    createAdapter({
      listInstalledApps: async () => [
        {
          bundleId: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
          displayName: 'PowerShell',
          path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
        },
      ],
    }),
    'request_access',
    { reason: 'open shell', apps: ['PowerShell', 'Totally Made Up App'] },
    overrides,
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  const payload = JSON.parse(result.content[0]?.text ?? '{}')
  expect(payload.granted).toHaveLength(1)
  expect(payload.granted[0]?.displayName).toBe('PowerShell')
  expect(payload.denied).toContainEqual({
    bundleId: 'Totally Made Up App',
    reason: 'not_installed',
  })
  expect(payload.unresolved?.guidance).toContain('None of the requested applications could be resolved')
})

test('request_access with only userDenied and unresolved apps does not open the approval dialog', async () => {
  const overrides = {
    ...createOverrides(),
    userDeniedBundleIds: ['C:\\Program Files\\PowerShell\\7\\pwsh.exe'],
    onPermissionRequest: async () => {
      throw new Error('request_access should not open the approval dialog when no resolved apps remain')
    },
  }

  const result = await handleToolCall(
    createAdapter({
      listInstalledApps: async () => [
        {
          bundleId: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
          displayName: 'PowerShell',
          path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
        },
      ],
    }),
    'request_access',
    { reason: 'open shell', apps: ['PowerShell', 'Totally Made Up App'] },
    overrides,
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  const payload = JSON.parse(result.content[0]?.text ?? '{}')
  expect(payload.userDenied?.apps).toEqual([
    {
      requestedName: 'PowerShell',
      displayName: 'PowerShell',
    },
  ])
  expect(payload.denied).toContainEqual({
    bundleId: 'Totally Made Up App',
    reason: 'not_installed',
  })
  expect(payload.unresolved?.guidance).toContain('None of the requested applications could be resolved')
})

test('bound-window left_click stays on the standard click path instead of virtual_mouse', async () => {
  let clickArgs:
    | {
        x: number
        y: number
        button: 'left' | 'right' | 'middle'
        count: 1 | 2 | 3
      }
    | undefined
  let virtualMouseCalled = false

  const result = await handleToolCall(
    createAdapter({
      hasBoundWindow: async () => true,
      virtualMouse: async () => {
        virtualMouseCalled = true
        return true
      },
      virtualKeyboard: async () => true,
      click: async (x, y, button, count) => {
        clickArgs = { x, y, button, count }
      },
    }),
    'left_click',
    { coordinate: [10, 20] },
    createOverrides(),
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toBe('Clicked.')
  expect(clickArgs).toEqual({ x: 10, y: 20, button: 'left', count: 1 })
  expect(virtualMouseCalled).toBe(false)
})

test('bound-window type stays on the standard keyboard path instead of virtual_keyboard', async () => {
  const typed: string[] = []
  let virtualKeyboardCalled = false

  const result = await handleToolCall(
    createAdapter({
      hasBoundWindow: async () => true,
      virtualMouse: async () => true,
      virtualKeyboard: async () => {
        virtualKeyboardCalled = true
        return true
      },
      type: async (text) => {
        typed.push(text)
      },
    }),
    'type',
    { text: 'abc' },
    createOverrides(),
  )

  expect(result.isError).toBeUndefined()
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toBe('Typed 3 grapheme(s).')
  expect(typed).toEqual(['a', 'b', 'c'])
  expect(virtualKeyboardCalled).toBe(false)
})

test('bound-window left_mouse_down uses the standard mouseDown path without requiring coordinates', async () => {
  let mouseDownCalls = 0
  let mouseUpCalls = 0
  let virtualMouseCalled = false

  const adapter = createAdapter({
    hasBoundWindow: async () => true,
    virtualMouse: async () => {
      virtualMouseCalled = true
      return true
    },
    virtualKeyboard: async () => true,
    mouseDown: async () => {
      mouseDownCalls += 1
    },
    mouseUp: async () => {
      mouseUpCalls += 1
    },
  })

  const down = await handleToolCall(
    adapter,
    'left_mouse_down',
    {},
    createOverrides(),
  )

  expect(down.isError).toBeUndefined()
  expect(down.content[0]?.type).toBe('text')
  expect(down.content[0]?.text).toBe('Mouse button pressed.')
  expect(mouseDownCalls).toBe(1)
  expect(virtualMouseCalled).toBe(false)

  const up = await handleToolCall(
    adapter,
    'left_mouse_up',
    {},
    createOverrides(),
  )

  expect(up.isError).toBeUndefined()
  expect(up.content[0]?.type).toBe('text')
  expect(up.content[0]?.text).toBe('Mouse button released.')
  expect(mouseUpCalls).toBe(1)
  expect(virtualMouseCalled).toBe(false)
})

test('handleToolCall window_management move_resize rejects non-finite coordinates', async () => {
  let called = false
  const adapter = createAdapter({
    manageWindow: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'window_management',
    { action: 'move_resize', x: Number.NaN, y: 10 },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain('move_resize requires integer x and y parameters.')
  expect(called).toBe(false)
})

test('handleToolCall window_management move_resize rejects non-finite optional dimensions', async () => {
  let called = false
  const adapter = createAdapter({
    manageWindow: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'window_management',
    { action: 'move_resize', x: 10, y: 20, width: Number.POSITIVE_INFINITY, height: 200 },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'move_resize width and height must be positive integers when provided.',
  )
  expect(called).toBe(false)
})

test('handleToolCall window_management move_resize requires width and height together', async () => {
  let called = false
  const adapter = createAdapter({
    manageWindow: async () => {
      called = true
      return true
    },
  })

  const result = await handleToolCall(
    adapter,
    'window_management',
    { action: 'move_resize', x: 10, y: 20, width: 300 },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.text).toContain(
    'move_resize width and height must be provided together when resizing.',
  )
  expect(called).toBe(false)
})

test('handleToolCall window_management move_resize rejects non-integer and zero dimensions', async () => {
  let called = false
  const adapter = createAdapter({
    manageWindow: async () => {
      called = true
      return true
    },
  })

  const floatResult = await handleToolCall(
    adapter,
    'window_management',
    { action: 'move_resize', x: 10, y: 20, width: 320.5, height: 200 },
    createOverrides(),
  )

  expect(floatResult.isError).toBe(true)
  expect(floatResult.telemetry?.error_kind).toBe('bad_args')
  expect(floatResult.content[0]?.text).toContain(
    'move_resize width and height must be positive integers when provided.',
  )

  const zeroResult = await handleToolCall(
    adapter,
    'window_management',
    { action: 'move_resize', x: 10, y: 20, width: 320, height: 0 },
    createOverrides(),
  )

  expect(zeroResult.isError).toBe(true)
  expect(zeroResult.telemetry?.error_kind).toBe('bad_args')
  expect(zeroResult.content[0]?.text).toContain(
    'move_resize width and height must be positive integers when provided.',
  )
  expect(called).toBe(false)
})

test('handleToolCall window_management returns a truthful generic failure when move_resize runtime returns false', async () => {
  const adapter = createAdapter({
    manageWindow: async () => false,
  })

  const result = await handleToolCall(
    adapter,
    'window_management',
    { action: 'move_resize', x: 10, y: 20 },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Window management action failed. Ensure a window is bound and the requested state change is supported.',
  )
})

test('handleToolCall window_management returns a truthful generic failure when a bound action returns false', async () => {
  const adapter = createAdapter({
    manageWindow: async () => false,
  })

  const result = await handleToolCall(
    adapter,
    'window_management',
    { action: 'focus' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'Window management action failed. Ensure a window is bound and the requested state change is supported.',
  )
})

test('handleToolCall window_management get_rect points to open_application or bind_window when nothing is bound', async () => {
  const adapter = createAdapter({
    manageWindow: async () => true,
    getWindowRect: async () => null,
  })

  const result = await handleToolCall(
    adapter,
    'window_management',
    { action: 'get_rect' },
    createOverrides(),
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('state_conflict')
  expect(result.content[0]?.text).toContain(
    'No window is currently bound. Use open_application or bind_window first.',
  )
})
