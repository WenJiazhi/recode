# Worklog

## 2026-04-14

### Portable sync/release truthfulness + `status_indicator(status)` wording + Win32 bound scroll verification

- corrected
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  so a normal sync now warns when `package.json` / `bun.lock` changed but
  `runtime/`, `node_modules/`, and `.portable-deps-stamp.json` were preserved
- corrected the preserved-state output in
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  so it explicitly names:
  - `runtime/`
  - `node_modules/`
  - `.portable-deps-stamp.json`
  - preserved local `.recode` files
- corrected
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1)
  so stale portable dependency bases now fail **before** the repo rebuilds
  `dist`, instead of after a successful build
- corrected
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `status_indicator(status)` now reports:
  - `Indicator is active.`
  - `Indicator is not active.`
  without overclaiming bound-window ownership
- corrected
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so runtime-false `click_element` / `type_into_element` responses now stay
  truthful about:
  - missing elements
  - non-actionable / non-editable elements
  - bound-window input-delivery failure
- corrected
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  so the bound Win32 `scroll()` legacy `WM_VSCROLL` / `WM_HSCROLL` fallback now
  checks `GetScrollInfo(...)` before/after dispatch when that signal is
  available, and fails closed when the scrollbar position does not move
- extended focused regressions in:
  - [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  - [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  - [win32BoundClickSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32BoundClickSource.test.ts)
- verification:
  - `bun test src/utils/computerUse/__tests__/win32BoundClickSource.test.ts src/__tests__/portableScripts.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun test` => `377 pass / 0 fail`
  - `bun run build` => pass
  - `bun run lint` => pass

### Windows runtime-false telemetry classification

- corrected
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so post-validation runtime/state failures now use `state_conflict` instead of
  `bad_args` for:
  - `virtual_mouse`
  - `virtual_keyboard`
  - `mouse_wheel`
  - `status_indicator(show|hide)`
  - `activate_window`
  - `prompt_respond`
  - `window_management`
- this keeps telemetry aligned with the existing `CuErrorKind` contract:
  `bad_args` is now reserved for malformed input, while valid requests that fail
  because of bind/runtime/unsupported-state conditions are classified as state
  conflicts
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  so the runtime-false branches lock the new `state_conflict` classification
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun test` => `377 pass / 0 fail`
  - `bun run build` => pass
  - `bun run lint` => pass

### Portable stale-dependency detection + `holdKey()` cleanup failure propagation

- corrected
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  so the normal stale-dependency warning now also fires when preserved
  `runtime/` or `node_modules/` are missing, instead of only trusting the
  dependency stamp + manifest hashes
- this keeps normal sync output aligned with what
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1)
  already assumes about a healthy portable dependency base
- corrected
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so `holdKey()` still releases already-pressed keys in reverse order, but now
  rethrows the first cleanup failure **after** attempting all releases instead
  of swallowing stuck-key cleanup errors
- extended focused regressions in:
  - [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  - [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
- verification:
  - `bun test src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts src/__tests__/portableScripts.test.ts`
  - `bun test` => `377 pass / 0 fail`
  - `bun run build` => pass
  - `bun run lint` => pass

### `window_management(get_rect)` unbound guidance

- corrected
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `window_management(action="get_rect")` now tells users to use
  `open_application` **or** `bind_window` when nothing is currently bound
- this keeps request-layer guidance aligned with the actual Windows workflow
  instead of implying the open-app path is the only recovery route
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with a focused regression for the new unbound guidance
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `371 pass / 0 fail`

### Win32 bound `mouseDown()` / `mouseUp()` / `drag()` + platform click fail-closed

- corrected
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so bound-window Win32:
  - `mouseDown()`
  - `mouseUp()`
  - `drag()`
  now throw when `sendMouseDown(...)`, `sendMouseMove(...)`, or
  `sendMouseUp(...)` reject the action
- corrected
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  so the platform-layer bound `click()` path now throws when
  `getWm().sendClick(...)` returns `false`
- this closes the remaining void-return silent-success seam in the Win32 input
  path without widening the public executor interfaces
- extended focused source regressions in:
  - [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  - [win32BoundClickSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32BoundClickSource.test.ts)
- verification:
  - `bun test src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts src/utils/computerUse/__tests__/win32BoundClickSource.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `370 pass / 0 fail`

### Win32 `activateWindow()` + bound UIA fallback click fail-closed

- corrected
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so:
  - `activateWindow()` no longer reports success when its focus click is
    rejected
  - the bound-window fallback click paths in `clickElement()` and
    `typeIntoElement()` now also fail closed when `sendClick(...)` rejects the
    focus action
- this closes another real false-success seam in Win32 desktop-control:
  actions no longer claim the window/element was focused when the injected
  click never landed
- extended
  [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  with a focused regression covering all three sendClick fail-closed paths
- verification:
  - `bun test src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `369 pass / 0 fail`

### Win32 `manageWindow(close)` success truthfulness

- corrected
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  so `manageWindow('close')` now returns success only when the window actually
  disappears after `WM_CLOSE`
- this preserves the earlier "only unbind on real close" behavior and closes
  the remaining false-success gap where an ignored close or confirmation dialog
  still came back as `true`
- extended
  [win32WindowManagementSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32WindowManagementSource.test.ts)
  with a source regression for `return closeResult === 'CLOSED'`
- verification:
  - `bun test src/utils/computerUse/__tests__/win32WindowManagementSource.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `369 pass / 0 fail`

### Win32 `respondToPrompt()` fail-closed

- corrected
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so bound-window Win32 `respondToPrompt()` now checks the return value of:
  - `sendChar(...)`
  - `sendKey(...)`
  - `sendText(...)`
- this closes a real false-success path where `yes` / `no` / `enter` /
  `escape` / `select` / `type` could report success even when the low-level
  input injection failed
- extended
  [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  with a focused source regression for fail-closed prompt injection
- verification:
  - `bun test src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `368 pass / 0 fail`

### `status_indicator` live-state parity + `prompt_respond(type)` empty-text guard + `virtualMouse()` fail-closed

- corrected
  [inputIndicator.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/inputIndicator.ts)
  and
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so the Win32 status indicator now tracks the live overlay process instead of
  guessing from bound-window state
- corrected
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so:
  - `status_indicator(show)` / `hide` no longer return success when the runtime
    reports the overlay inactive/unchanged
  - `status_indicator(status)` no longer claims "no window bound" when the real
    issue is simply "indicator not active"
  - `prompt_respond(response_type="type")` now rejects empty text before
    runtime dispatch
- corrected
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so bound-window Win32 `virtualMouse()` now fails closed when
  `sendClick(...)`, `sendMouseMove(...)`, `sendMouseDown(...)`, or
  `sendMouseUp(...)` reject the action
- extended focused regressions in:
  - [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  - [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `367 pass / 0 fail`

### `holdKey()` failure cleanup

- corrected
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so `holdKey()` now tracks which keys were actually pressed and releases them
  in reverse order from `finally`
- this keeps cross-platform runtime behavior aligned with the stricter Win32
  key-dispatch contract and prevents partially pressed modifier sets from being
  left down after a later press/release failure
- extended
  [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  with a focused regression for reverse-order release cleanup
- verification:
  - `bun test src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts src/utils/computerUse/__tests__/win32KeyboardSource.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `342 pass / 0 fail`

### `virtual_keyboard` blank-text guard

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so non-typing `virtual_keyboard` actions now reject blank `text`
  (`press` / `release` / `combo` / `hold`)
- this keeps empty sequences out of the runtime and returns a precise
  `bad_args` error instead of a later generic keyboard-injection failure
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with a focused blank-text regression
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `341 pass / 0 fail`

### Win32 single-letter VK normalization

- corrected
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  and
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  so single-character key paths now normalize to uppercase virtual-key codes
  before dispatch
- this fixes bound-window Win32 `press` / `release` / `hold` actions for
  letters like `a` / `z`, which previously used lowercase ASCII codes instead
  of `VK_A`-style values
- also tightened the lower-level bound `input.key()` path so unsupported or
  failed Win32 key dispatch now throws instead of silently succeeding
- added
  [win32KeyboardSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32KeyboardSource.test.ts)
  to lock the uppercase-VK contract in both call paths
- verification:
  - `bun test src/utils/computerUse/__tests__/win32KeyboardSource.test.ts src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `340 pass / 0 fail`

### `virtual_keyboard` failure feedback parity

- corrected
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `virtual_keyboard` no longer reports every runtime `false` as
  “No window is currently bound”
- failures from unknown keys or backend injection rejection now return a
  truthful generic keyboard-failure hint instead of the misleading missing-bind
  explanation
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with a focused regression for that failure text
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - baseline moved through `338 pass / 0 fail`

### `prompt_respond(select)` default-count parity

- corrected
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `prompt_respond(response_type="select")` no longer hard-requires
  `arrow_count`
- this restores parity with:
  - the tool schema default
  - the executor fallback (`arrowCount ?? 1`)
  - the existing success-text default
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with a regression that locks the omitted-`arrow_count` path
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `339 pass / 0 fail`

### `type_into_element` empty-selector guard

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `type_into_element` now requires at least one of:
  - `name`
  - `role`
  - `automationId`
- this keeps the request layer aligned with `click_element` and prevents empty
  selector queries from falling through to the Win32 accessibility snapshot
  broad-match path
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with a focused regression for empty-selector rejection
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `337 pass / 0 fail`

### Portable release script source-of-truth alignment

- simplified
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1)
  so release packaging now copies these root-owned scripts directly from the
  source repo instead of generating inline here-string variants:
  - `recode.cmd` / `recode.bat`
  - `configure-provider.cmd` / `configure-provider.bat`
  - `install-portable.cmd` / `install-portable.bat`
  - `uninstall-portable.cmd` / `uninstall-portable.bat`
- this removes a second launcher/install truth source from the release builder
  without adding another guard/stamp layer
- updated
  [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  to lock that repo-root source-of-truth behavior
- verification:
  - `bun test src/__tests__/portableScripts.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - baseline remains `336 pass / 0 fail`

### Win32 bound-window `virtualKeyboard()` fail-closed

- corrected
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so bound-window Win32 `virtualKeyboard()` now:
  - returns `false` when `sendText(...)` fails
  - returns `false` when `sendKeys(...)` fails
  - rejects unresolved `press` / `release` keys instead of silently skipping them
  - pre-resolves `hold` combos and aborts the whole action if any token is unknown
  - best-effort releases already-pressed keys if a later `hold` key-down fails
- extended
  [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  with a focused regression that locks the new fail-closed path
- verification:
  - `bun test src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `336 pass / 0 fail`

### Finish-phase runtime and release hardening follow-up

- hardened
  [packages/@ant/computer-use-mcp/src/toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so:
  - `agent='custom'` requires a non-empty command
  - optional `open_terminal` fields now fail closed when present with the wrong
    type (`command`, `working_directory`)
  - `activate_window` optional `click_x` / `click_y` now fail closed when
    provided with malformed values instead of silently degrading to a center click
  - `activate_window` now also rejects partial `click_x` / `click_y` overrides
    instead of silently falling back to the default center click
  - `virtual_keyboard` now rejects non-number `repeat` / `duration` values
    instead of silently defaulting them
  - `status_indicator(show)` now rejects non-string `message` values instead
    of collapsing them into the generic missing-message path
  - `click_element` rejects malformed `name` / `role` / `automationId`
    selector fields instead of silently broadening the query
  - `type_into_element` rejects malformed selector fields for the same reason
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with regressions for:
  - blank custom terminal commands
  - malformed `click_element` selectors
  - malformed `type_into_element` selectors
- corrected the Win32 UI Automation bound-window path:
  - [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
    now uses `clickElementByHwnd` / `findElementByHwnd` /
    `setValueByHwnd` in bound-window mode
  - [uiAutomation.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/uiAutomation.ts)
    now exposes HWND-rooted UIA helpers built on
    `AutomationElement.FromHandle(...)`
  - `type_into_element(name + role)` now maps `role -> controlType` on the
    bound-window UIA fast path instead of silently dropping `role`
- added focused regressions:
  - [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  - [win32UiAutomationSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32UiAutomationSource.test.ts)
- tightened portable release freshness in
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1):
  - `README.md`
  - `README.zh-CN.md`
  - `.recode/local-provider.example.json`
  - `.recode/lsp.example.json`
  are now copied directly from the source repo instead of the portable root
- extended
  [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  to lock that repo-root source-of-truth behavior
- verification:
  - `bun test src/__tests__/portableScripts.test.ts src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts src/utils/computerUse/__tests__/win32UiAutomationSource.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun test`
  - `bun run build`
  - `bun run lint`
  - final baseline: `335 pass / 0 fail`
- re-audited the remaining `TRANSCRIPT_CLASSIFIER` parity drift:
  - packaged and `recode.cmd` intentionally remain the source-of-truth for
    auto-mode feature exposure
  - did **not** hotfix `src/entrypoints/cli.tsx` with another env default,
    because that would create a split-brain runtime/config model

### CCB delta re-audit and OpenAI compatibility follow-up

- re-audited the local CCB repository for changes after the last formal check
  and explicitly classified them into:
  - already covered in `recode`
  - worth borrowing
  - too heavy / packaging-specific / not worth grafting now
- conclusions from that audit:
  - `bb07836` (`CRLF` SSE parsing) is already effectively covered by the
    current `recode` transport parser
  - the newer Chrome packaging/setup commits are not good graft targets for us
    because `recode` already uses the in-tree
    `@ant/claude-for-chrome-mcp` architecture
  - the most valuable usable delta is the OpenAI compatibility layer
- grafted the smallest safe OpenAI slice from the newer CCB direction:
  - [streamAdapter.ts](/E:/appdev/claudecode-rebuild/src/services/api/openai/streamAdapter.ts)
    now defers final `message_delta` / `message_stop` emission until after the
    full stream is consumed so trailing usage-only chunks are preserved
  - `length` truncation now takes precedence over partial tool-call presence,
    avoiding false `tool_use` when a tool-call stream is cut off
  - [index.ts](/E:/appdev/claudecode-rebuild/src/services/api/openai/index.ts)
    now forwards `max_tokens` to OpenAI-compatible providers using the model
    upper limit or the existing override
- added focused regressions:
  - [streamAdapter.test.ts](/E:/appdev/claudecode-rebuild/src/services/api/openai/__tests__/streamAdapter.test.ts)
  - [queryModelOpenAI.test.ts](/E:/appdev/claudecode-rebuild/src/services/api/openai/__tests__/queryModelOpenAI.test.ts)
- verification:
  - `bun test src/services/api/openai/__tests__/streamAdapter.test.ts src/services/api/openai/__tests__/queryModelOpenAI.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`282 pass / 0 fail`)
- also grafted the remaining small `0d8f494` darwin app-enumeration slice:
  - [darwin.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-swift/src/backends/darwin.ts)
    now uses `mdls` to collect real bundle identifiers instead of fabricating
    `com.app.*` values
  - duplicate bundle IDs are deduplicated
  - rows with null bundle IDs are dropped
- added focused regression coverage in
  [darwin.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-swift/src/__tests__/darwin.test.ts)
- continued the OpenAI compatibility graft with the next clean CCB slice:
  - [index.ts](/E:/appdev/claudecode-rebuild/src/services/api/openai/index.ts)
    now filters undiscovered deferred tools before OpenAI schema generation
  - tool-search-disabled requests now omit `ToolSearch`
  - deferred tools only appear once they have been discovered in message
    history
- tightened the matching recovery path in
  [toolExecution.ts](/E:/appdev/claudecode-rebuild/src/services/tools/toolExecution.ts):
  - deferred-tool schema misses now return a clearer OpenAI-compatible retry
    hint
  - the hint gives an explicit `ToolSearch("select:...")` sequence
  - task-family preload guidance is only shown for task tools
- added focused regressions:
  - [queryModelOpenAI.test.ts](/E:/appdev/claudecode-rebuild/src/services/api/openai/__tests__/queryModelOpenAI.test.ts)
  - [toolExecution.test.ts](/E:/appdev/claudecode-rebuild/src/services/tools/__tests__/toolExecution.test.ts)
- verification:
  - `bun test src/services/tools/__tests__/toolExecution.test.ts src/services/api/openai/__tests__/queryModelOpenAI.test.ts src/services/api/openai/__tests__/streamAdapter.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`287 pass / 0 fail`)
- tightened the Windows `open_terminal` request path in
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts):
  - `terminal` is now validated when present
  - only `wt`, `powershell`, and `cmd` are accepted
  - invalid values now return `bad_args` instead of silently falling back to
    the default launcher order
- added focused coverage in
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  for invalid-terminal rejection
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts src/services/tools/__tests__/toolExecution.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`288 pass / 0 fail`)
- repaired the checked-in portable install/uninstall scripts:
  - [install-portable.cmd](/E:/appdev/claudecode-rebuild/install-portable.cmd)
  - [uninstall-portable.cmd](/E:/appdev/claudecode-rebuild/uninstall-portable.cmd)
  - runtime and bundled Git paths now stay rooted under `%PORTABLE_ROOT%\...`
    instead of concatenating into invalid `portableRootruntime\...` paths
- added a lightweight source regression in
  [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  so future portable syncs do not regress the script templates
- verification:
  - `bun test src/__tests__/portableScripts.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`290 pass / 0 fail`)
- tightened the bound-window prompt helper in
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts):
  - `prompt_respond(select)` now validates `arrow_direction`
  - only `up` and `down` are accepted
  - `arrow_count` must be an integer greater than or equal to `0`
  - invalid values now return `bad_args` instead of silently choosing the
    wrong prompt item
- added focused regression coverage in
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  for invalid `arrow_direction` and negative `arrow_count`
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts src/__tests__/portableScripts.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`292 pass / 0 fail`)
- tightened the bound-window virtual keyboard helper in
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts):
  - `repeat` now must stay within the declared `1..100` range
  - `duration` must be a finite number greater than or equal to `0`
  - malformed values now return `bad_args` instead of being forwarded into the
    executor
- added focused regression coverage in
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  for invalid `repeat` and `duration`
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts src/__tests__/portableScripts.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`294 pass / 0 fail`)
- tightened `request_access` exact display-name handling in
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts):
  - exact display-name collisions no longer silently resolve to the last seen
    installed app
  - ambiguous requests now fail closed and return executable/bundle-ID guidance
- added focused regression coverage in
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  for exact-name ambiguity handling
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts src/__tests__/portableScripts.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`296 pass / 0 fail`)
- tightened the remaining bound-window coordinate drift in
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts):
  - `virtual_mouse` now reuses `extractCoordinate(...)` for both `coordinate`
    and optional `start_coordinate`
  - `mouse_wheel` now reuses `extractCoordinate(...)`
  - `mouse_wheel` rejects non-finite `delta` values instead of only checking
    `typeof === "number"`
- added focused regression coverage in
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  for malformed `virtual_mouse` coordinates and non-finite `mouse_wheel`
  deltas
- verification:
  - `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`298 pass / 0 fail`)
- hardened the portable release path in
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1):
  - release packaging now runs `bun run build` from the source repo before
    staging `dist`
  - packaging now fails early if `dist/cli.js` is still missing after the
    rebuild
- added a focused source regression in
  [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  for the new source-build freshness guard
- aligned the `computer-use` MCP telemetry contract in
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts):
  - `CuErrorKind` now includes the already-emitted `launch_failed` and
    `element_not_found` values
  - this removes a small but real type-contract drift between declared
    telemetry and actual runtime emissions
- added a focused source regression in
  [toolCallsTextSource.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsTextSource.test.ts)
  to keep those emitted error kinds in the declared union
- verification:
  - `bun test src/__tests__/portableScripts.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsTextSource.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`299 pass / 0 fail`)
- tightened
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  so managed directories that disappear from the source repo are now removed
  from the portable tree instead of being silently preserved
- extended
  [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  with a source regression that locks the stale-managed-directory cleanup path
- verification:
  - `bun test src/__tests__/portableScripts.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`300 pass / 0 fail`)
- tightened
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  so `bindFile()` now routes an existing HWND binding through the shared
  `unbindWindow()` cleanup path before switching into COM/file mode
- this closes a real Win32 runtime gap where the old border/virtual-cursor /
  indicator state could remain attached to the previously bound window even
  though the runtime had already switched to file-mode binding
- added a focused source regression in
  [win32BindingSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32BindingSource.test.ts)
  to lock that cleanup path
- verification:
  - `bun test src/utils/computerUse/__tests__/win32BindingSource.test.ts src/__tests__/portableScripts.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsTextSource.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`302 pass / 0 fail`)
- tightened the portable install path in
  [install-portable.cmd](/E:/appdev/claudecode-rebuild/install-portable.cmd)
  and the generated release installer template in
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1):
  - both now fail closed before mutating PATH when `%RUNTIME_DIR%\bun.exe`
    is missing
  - this keeps incomplete archives from registering themselves as usable
    portable installs
- extended
  [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  so the generated release installer stays aligned with both:
  - the current-session PATH update
  - the runtime-completeness guard
- verification:
  - `bun test src/__tests__/portableScripts.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`303 pass / 0 fail`)
- tightened Win32 window-management close handling in
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts):
  - `WM_CLOSE` is still sent to the bound window
  - but the binding is now released only after a short `IsWindow(...)` check
    confirms that the target window actually went away
  - this avoids silently dropping the target when the app shows a
    save-confirmation dialog or otherwise stays open
- aligned the user-visible close description in
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so it no longer promises an unconditional unbind
- added focused source regressions in
  [win32WindowManagementSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32WindowManagementSource.test.ts)
  to lock both the post-close `IsWindow` check and the updated user-facing
  close message
- verification:
  - `bun test src/utils/computerUse/__tests__/win32WindowManagementSource.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`305 pass / 0 fail`)
- tightened
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so generic `scroll(x, y, dx, dy)` now uses the existing Win32 bound-window
  `mouseWheel(x, y, ...)` seam before falling back to the older platform
  `scroll(...)` path
- this keeps the public interface unchanged while steering bound scrolling
  toward the wheel-message path that already works for Excel, browsers, and
  other modern surfaces
- extended
  [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  to lock the bound-scroll routing order
- verification:
  - `bun test src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts`
  - `bun run build`
  - `bun run lint`
  - `bun test` (`306 pass / 0 fail`)

### Finish-phase architecture review and planning sync

- completed a partitioned, read-only review of the non-OG additions instead of
  continuing blind finish-phase edits
- reviewed the codebase in four practical buckets:
  - Windows desktop-control / computer-use runtime
  - source-first / packaged gate alignment
  - interactive command / UI exposure
  - portable / release / sync
- the review conclusion is important:
  - the project still keeps the OG `src` skeleton
  - the risk is local hotspot growth, not system-wide architectural drift
- recorded the four hotspots that must now be treated as constrained zones:
  - [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  - [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  - feature gate/default helper proliferation
  - portable/release script duplication
- updated the finish-phase loop state so future slices explicitly avoid:
  - new cross-cutting policy in `toolCalls.ts`
  - pushing more Win32 detail into `executorCrossPlatform.ts`
  - adding more one-flag helper files by default
  - turning portable scripts into a second product/runtime model

### Superpowers workflow clarification

- documented the actual `superpowers` workflow that should be used for this
  repository instead of using skills ad hoc
- clarified the role of:
  - `brainstorming`
  - `writing-plans`
  - `systematic-debugging`
  - `subagent-driven-development`
  - `verification-before-completion`
  - `requesting-code-review`
- fixed the process expectation:
  - use `brainstorming` only to set the finish-phase frame
  - use `writing-plans` for the next narrow slice
  - prefer `systematic-debugging` and `test-driven-development` for actual
    runtime fixes
  - use subagents only for partitioned read-only review or disjoint work

### Documentation refresh

- refreshed the main state and plan docs to the current finish-phase baseline:
  - [STATUS.md](/E:/appdev/claudecode-rebuild/docs/STATUS.md)
  - [OG_STITCHING_EXECUTION_PLAN.md](/E:/appdev/claudecode-rebuild/docs/OG_STITCHING_EXECUTION_PLAN.md)
  - [CCB_MERGE_PLAN.md](/E:/appdev/claudecode-rebuild/docs/CCB_MERGE_PLAN.md)
  - [docs/superpowers/README.md](/E:/appdev/claudecode-rebuild/docs/superpowers/README.md)
  - [docs/superpowers/plans/2026-04-14-mainline-finish-next-slices.md](/E:/appdev/claudecode-rebuild/docs/superpowers/plans/2026-04-14-mainline-finish-next-slices.md)

## 2026-04-09

### Windows region screenshot routing hardening

- finished the Win32 `captureRegion()` path in
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  so it now uses the Python bridge's region-specific methods instead of
  degrading to a full-screen or full-window screenshot
- kept the change small and local:
  - added a bridge-call helper for capture routing
  - kept the screenshot result contract unchanged
  - did not introduce any new screenshot/public API surface
- added focused regression coverage:
  - [win32CaptureRegion.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32CaptureRegion.test.ts)
- outcome:
  - Win32 zoom/crop callers now receive the requested region instead of a full
    image payload
  - bound-window region capture also converts screen coordinates into
    window-local crop coordinates before slicing the window image
  - cross-platform zoom now threads the selected `displayId` through to the
    Win32 region screenshot path instead of silently defaulting to display 0

### User-visible mojibake cleanup in stitched desktop/ultraplan UI

- repaired visible corrupted separators and status text in:
  - [Byline.tsx](/E:/appdev/claudecode-rebuild/src/components/design-system/Byline.tsx)
  - [PromptInputFooterSuggestions.tsx](/E:/appdev/claudecode-rebuild/src/components/PromptInput/PromptInputFooterSuggestions.tsx)
  - [PromptInputFooterLeftSide.tsx](/E:/appdev/claudecode-rebuild/src/components/PromptInput/PromptInputFooterLeftSide.tsx)
  - [ultraplan.tsx](/E:/appdev/claudecode-rebuild/src/commands/ultraplan.tsx)
- kept the slice narrow:
  - only user-visible text
  - no comment cleanup
  - no behavior changes beyond restoring readable UI strings

### Windows bridge output parsing hardening

- hardened the win32 Python bridge response parsing in
  [bridgeClient.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/bridgeClient.ts)
  to tolerate non-JSON noise lines and prefixed log text before JSON payloads
- kept the change small and local:
  - added a typed parser helper for bridge stdout parsing
  - updated sync and async bridge response paths to reuse the same parser
  - no new desktop-control surface, no behavior expansion
- added focused regression coverage:
  - [bridgeClient.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/__tests__/bridgeClient.test.ts)

### CCB item 16: shot-stats gate alignment

- aligned the existing source runtime with the current CCB default for:
  - `SHOT_STATS`
- defaulted the source-first launcher env in
  [src/entrypoints/cli.tsx](/E:/appdev/claudecode-rebuild/src/entrypoints/cli.tsx):
  - `FEATURE_SHOT_STATS=1`
- added the packaged-build default in
  [build.ts](/E:/appdev/claudecode-rebuild/build.ts)
- added an env-backed feature helper:
  - [shotStatsFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/utils/shotStatsFeatureEnabled.ts)
- rewired the existing source/runtime surfaces to honor that helper instead of
  compile-time-only `feature(...)` checks:
  - [Stats.tsx](/E:/appdev/claudecode-rebuild/src/components/Stats.tsx)
  - [stats.ts](/E:/appdev/claudecode-rebuild/src/utils/stats.ts)
  - [statsCache.ts](/E:/appdev/claudecode-rebuild/src/utils/statsCache.ts)
- added permanent regression coverage:
  - [shotStatsFeatureEnabled.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/shotStatsFeatureEnabled.test.ts)
- kept the change source-faithful:
  - no new stats subsystem
  - no new commands
  - only gate/default alignment for an already-present stats path

### CCB item 15: extract-memories and Lodestone gate alignment

- aligned the existing source runtime with the current CCB defaults for:
  - `EXTRACT_MEMORIES`
  - `LODESTONE`
- defaulted the source-first launcher envs in
  [src/entrypoints/cli.tsx](/E:/appdev/claudecode-rebuild/src/entrypoints/cli.tsx):
  - `FEATURE_EXTRACT_MEMORIES=1`
  - `FEATURE_LODESTONE=1`
- added the packaged-build defaults in
  [build.ts](/E:/appdev/claudecode-rebuild/build.ts)
- added env-backed feature helpers:
  - [extractMemoriesFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/utils/extractMemoriesFeatureEnabled.ts)
  - [lodestoneFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/utils/lodestoneFeatureEnabled.ts)
- rewired the existing source/runtime surfaces to honor those helpers instead of
  compile-time-only `feature(...)` checks:
  - [print.ts](/E:/appdev/claudecode-rebuild/src/cli/print.ts)
  - [stopHooks.ts](/E:/appdev/claudecode-rebuild/src/query/stopHooks.ts)
  - [backgroundHousekeeping.ts](/E:/appdev/claudecode-rebuild/src/utils/backgroundHousekeeping.ts)
  - [interactiveHelpers.tsx](/E:/appdev/claudecode-rebuild/src/interactiveHelpers.tsx)
  - [main.tsx](/E:/appdev/claudecode-rebuild/src/main.tsx)
  - [types.ts](/E:/appdev/claudecode-rebuild/src/utils/settings/types.ts)
- added permanent regression coverage:
  - [desktopFeatureEnabled.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/desktopFeatureEnabled.test.ts)
- kept the merge source-faithful:
  - memory extraction still requires the existing `isExtractModeActive()` gate
  - Lodestone still uses the existing deep-link runtime and desktop setting surfaces
  - the change is feature exposure parity, not new runtime behavior

Verification:

- `bun test`
- `bun run build`
- `bun run lint`
- `bun .\src\entrypoints\cli.tsx -p "/help"`
- `bun .\dist\cli.js -p "/help"`

### CCB item 14: agent triggers and explore-plan gate alignment

- aligned the existing source runtime with the current CCB defaults for:
  - `AGENT_TRIGGERS`
  - `AGENT_TRIGGERS_REMOTE`
  - `BUILTIN_EXPLORE_PLAN_AGENTS`
- defaulted the source-first launcher envs in
  [src/entrypoints/cli.tsx](/E:/appdev/claudecode-rebuild/src/entrypoints/cli.tsx):
  - `FEATURE_AGENT_TRIGGERS=1`
  - `FEATURE_AGENT_TRIGGERS_REMOTE=1`
  - `FEATURE_BUILTIN_EXPLORE_PLAN_AGENTS=1`
- added the packaged-build defaults in
  [build.ts](/E:/appdev/claudecode-rebuild/build.ts)
- added env-backed feature helpers:
  - [agentTriggersFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/utils/agentTriggersFeatureEnabled.ts)
  - [agentTriggersRemoteFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/utils/agentTriggersRemoteFeatureEnabled.ts)
  - [explorePlanAgentsFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/tools/AgentTool/explorePlanAgentsFeatureEnabled.ts)
- rewired the existing source/runtime surfaces to honor those helpers instead of
  compile-time-only `feature(...)` checks:
  - [tools.ts](/E:/appdev/claudecode-rebuild/src/tools.ts)
  - [ScheduleCronTool/prompt.ts](/E:/appdev/claudecode-rebuild/src/tools/ScheduleCronTool/prompt.ts)
  - [skills/bundled/index.ts](/E:/appdev/claudecode-rebuild/src/skills/bundled/index.ts)
  - [REPL.tsx](/E:/appdev/claudecode-rebuild/src/screens/REPL.tsx)
  - [print.ts](/E:/appdev/claudecode-rebuild/src/cli/print.ts)
  - [constants/tools.ts](/E:/appdev/claudecode-rebuild/src/constants/tools.ts)
  - [builtInAgents.ts](/E:/appdev/claudecode-rebuild/src/tools/AgentTool/builtInAgents.ts)
- added permanent regression coverage:
  - [agentTriggerFeatureEnabled.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/agentTriggerFeatureEnabled.test.ts)
  - [builtInAgents.test.ts](/E:/appdev/claudecode-rebuild/src/tools/AgentTool/__tests__/builtInAgents.test.ts)
- verified source-first `/loop` is now exposed and resolves to its real usage
  text instead of `Unknown skill`
- kept remote scheduling rollout conservative; this aligns exposure and parity
  without forcing unrelated remote-only defaults

Verification:

- `bun test`
- `bun run build`
- `bun run lint`
- `bun .\src\entrypoints\cli.tsx -p "/loop"`
- `bun .\src\entrypoints\cli.tsx -p "/help"`

### Progress-table realignment and warning cleanup

- refreshed the public progress tables so the repository now reflects the
  current post-merge state instead of the earlier rebuild phase:
  - [README.md](/E:/appdev/claudecode-rebuild/README.md)
  - [README.zh-CN.md](/E:/appdev/claudecode-rebuild/README.zh-CN.md)
  - [docs/STATUS.md](/E:/appdev/claudecode-rebuild/docs/STATUS.md)
  - [docs/SOURCE_PARITY_CHECKLIST.md](/E:/appdev/claudecode-rebuild/docs/SOURCE_PARITY_CHECKLIST.md)
  - [docs/CCB_MERGE_PLAN.md](/E:/appdev/claudecode-rebuild/docs/CCB_MERGE_PLAN.md)
  - [docs/PRIORITY_REBUILD_BACKLOG.md](/E:/appdev/claudecode-rebuild/docs/PRIORITY_REBUILD_BACKLOG.md)
- updated the snapshot tables to reflect the current mainline:
  - `213 pass / 0 fail`
  - `bun run build` green
  - `bun run lint` green
  - lint is now clean with `0 blocking errors`
  - CCB merge items `1-13` completed
- rewrote the main backlog to the post-CCB phase:
  - warning burn-down
  - Windows desktop-control hardening
  - interactive-safe review/commit/branch/worktree verification
  - lower-traffic brand cleanup
- continued low-risk lint-noise cleanup across active UI/hook surfaces until the
  warning floor reached a clean lint pass, without changing runtime behavior

### Post-table cleanup

- cleared the lint regression introduced during the table-refresh pass and kept
  the regex-heavy terminal/computer-use files on the safe `new RegExp(...)`
  path with explicit suppressions where Biome conflicts with
  `noControlCharactersInRegex`
- removed another wave of stale `biome-ignore` comments plus a few low-risk
  string/template diagnostics without changing runtime behavior
- added focused Windows desktop-control regression coverage for the repo-side
  `computer-use-mcp` bridge:
  - `open_terminal` now has explicit success/failure contract coverage
  - `bind_window` now has explicit `status` and `bind` contract coverage
  - this locks the repo-side terminal/window chain after the recent CCB
    Windows alignment work

Verification:

- `bun run lint`
- `bun test`
- `bun run build`

## 2026-04-07

### CCB merge phase: items 4-8

- confirmed that interview mode in the current CCB mainline is only a thin
  skill-entry layer and added the matching `.claude/skills/interview/SKILL.md`
  without rewriting the already-present plan-interview runtime
- aligned the existing `/ultraplan` source runtime with the CCB gate/default
  shape:
  - added the missing ultraplan dialogs
  - enabled the source-first external path
  - added a permanent non-interactive fallback regression
- aligned the existing voice runtime with the CCB gate/default shape:
  - source launcher now defaults `FEATURE_VOICE_MODE=1`
  - existing voice command / UI / settings surfaces honor the source-first env
  - added a permanent `/voice` non-interactive fallback regression
- aligned bridge with the current CCB source shape:
  - confirmed runtime parity
  - added explicit source-first `FEATURE_BRIDGE_MODE` opt-in support
  - added a permanent `/remote-control` non-interactive fallback regression
- aligned computer-use / chrome-use with the current CCB source shape:
  - source launcher now defaults `FEATURE_CHICAGO_MCP=1`
  - existing `CHICAGO_MCP` source surfaces now honor source-first env gating
  - grafted the CCB cross-platform computer-use executor subtree:
    - `src/utils/computerUse/executorCrossPlatform.ts`
    - `src/utils/computerUse/platforms/*`
    - `src/utils/computerUse/win32/*`
  - replaced the local `@ant/computer-use-mcp` stub with the current CCB
    package implementation so the MCP server path is real again
  - replaced the local `@ant/claude-for-chrome-mcp` stub with the current CCB
    package implementation so browser-tool discovery and chrome MCP server
    creation are real again
  - aligned packaged builds by passing feature flags in `build.ts` and
    defaulting `CHICAGO_MCP`, `VOICE_MODE`, and `ULTRAPLAN`

Verification:

- `bun test` -> `189 pass / 0 fail`
- `bun run build`
- `bun run lint`
- `bun ./src/entrypoints/cli.tsx --computer-use-mcp`
- `bun ./dist/cli.js --computer-use-mcp`
- `bun ./dist/cli.js -p "/chrome"`
- `bun ./dist/cli.js -p "/voice"`
- `bun ./dist/cli.js -p "/ultraplan"`

### CCB merge phase: items 1-3

- merged the CCB OpenAI adapter subtree into `recode` as a controlled graft instead of a bulk code import:
  - `src/services/api/openai/*`
  - explicit `openai` provider routing
  - early OpenAI branching in `src/services/api/claude.ts`
- added permanent regression coverage for the OpenAI adapter:
  - message conversion
  - tool conversion
  - model mapping
  - stream adaptation / `tool_use` stop-reason handling
- merged the CCB `GrowthBook` local gate fallback chain for source-present, coding-critical P0/P1 features only
- added permanent regression coverage for:
  - cached GrowthBook fallback
  - blocking GrowthBook fallback
  - `CLAUDE_CODE_DISABLE_LOCAL_GATES` bypass
- merged the CCB project-local skill `[local]` label slice:
  - command suggestions now tag project/local prompt commands as `[local]`
  - the Skills dialog now distinguishes `[local]`, `[global]`, and `[managed]`
- added permanent regression coverage for project/local suggestion tagging
- verified that interview runtime already exists in `recode` and added only the
  thin CCB-style entry layer at `.claude/skills/interview/SKILL.md`

Verification:

- `bun test` -> `184 pass / 0 fail`
- `bun run build`
- `bun run lint` (green with existing non-blocking warnings)

## 2026-04-01

### Repository cleanup

- moved old rebuild archives and read-only reconstruction folders out of the repository root
- promoted the active Bun + TypeScript project to the repository root
- removed leftover workspace clutter from the publishable root layout

### Packaging and runtime fixes

- repaired Bun build output so `dist/cli.js` starts cleanly
- stabilized headless `/help`, `/status`, and `/doctor`
- isolated `recode` plugin-cache usage from legacy Claude cache behavior

### Branding

- renamed the executable and visible product name to `recode`
- standardized the published version to `0.0.1`
- changed the primary accent theme from orange to sky blue
- updated high-visibility help, onboarding, status, and prompt text

### Model and API work

- added custom `/v1/models` discovery for non-default API hosts
- cached custom-host model capability metadata
- added `/model-map` to map `Opus`, `Sonnet`, and `Haiku` to user-selected models and thinking levels
- added `/model-map context <tokens|258k>` so context caps can be persisted through project config instead of ad hoc system environment changes
- added project-local portable provider loading from `.recode/local-provider.json`
- made the project-local provider config the single active provider-routing path when present
- added project-local persistence for `/model-map` and `/effort` when portable config is present
- prepared portable key-file flow through `.recode/api-key.txt`
- added explicit `providerType: "cpa"` support in local provider config
- detected CPA hosts from `cpapi.app` domains and preserved provider-native `model(high)` / `model(medium)` suffix uploads
- stopped injecting Anthropic-native thinking and effort fields on CPA routes so the provider can derive reasoning from the model suffix itself
- locked provider routing to the project-local config path by asserting host-managed provider env semantics when `.recode/local-provider.json` is active
- skipped the Anthropic-specific bootstrap endpoint on CPA/custom-base routes and relied on `/v1/models` discovery instead
- verified a real CPA-backed `-p "hello"` request succeeds again with `gpt-5.4(high)` style alias mapping
- updated `/model-map` so the interactive wizard can choose between writing to `.recode/local-provider.json` and the legacy global settings path
- replaced remaining high-visibility `claude --resume` / `claude --continue` strings with `recode`
- removed the dead `Gates` settings-tab runtime reference that caused `Gates is not defined` when opening `/config`
- restored `recode` launchers to the bundled `dist/cli.js` entrypoint after the temporary source-entrypoint workaround
- switched the default local `recode` launcher back to the source entrypoint for long-session stability, while keeping `dist/cli.js` as the build verification fallback

### Documentation

- wrote a root README for open-source publication
- added parity, status, audit, and worklog docs under `docs/`

## 2026-04-02

### Stricter archived-source parity pass

- re-extracted the archived original `src` as a read-only reference at `E:\appdev\.refs\claude-code-main-src\claude-code-main`
- re-compared current mainline against that archive at the directory surface level for:
  - `src`
  - `src/commands`
  - `src/tools`
  - `src/services`
  - `src/components`
- confirmed the current tree is a superset rather than a subset at the directory surface
- updated [SOURCE_PARITY_CHECKLIST.md](/E:/appdev/claudecode-rebuild/docs/SOURCE_PARITY_CHECKLIST.md) with a structural-delta section so extra `recode` directories are not mistaken for missing upstream parity work
- promoted `session / resume / permissions parity` into the ordered backlog because those shared original-source coordination surfaces still have less verification depth than git/LSP/headless routing
- confirmed `/share` and `/summary` are archived-source stubs, so they remain out of the main repair feed instead of being treated as missing original functionality

### Session / resume / permissions routing coverage

- added direct regression coverage for headless fallback routing through `processSlashCommand()`
- covered:
  - `/resume`
  - `/continue`
  - `/session`
  - `/remote`
  - `/permissions`
  - `/allowed-tools`
- kept command behavior unchanged; this patch only locks the existing source-shaped non-interactive fallback messages so these coordination commands do not drift back toward `Unknown skill` or ambiguous routing

Verification:

- `bun test src/utils/processUserInput/__tests__/processSlashCommand.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Commit prompt shell expansion coverage

- added a real integration test for `executeShellCommandsInPrompt()` using the same shell-placeholder style that `/commit` relies on
- the test creates a temporary git repository, modifies a tracked file, and verifies that:
  - `git status --short`
  - `git branch --show-current`
  - `git log --oneline -1`
  are all expanded into the prompt text
- also locked that the expansion path does not inject `Shell cwd was reset ...` noise when the project root state is aligned with the repository under test
- this keeps the repair source-shaped: it validates the existing `/commit` prompt shell chain without changing command behavior

Verification:

- `bun test src/utils/__tests__/promptShellExecution.test.ts`
- `bun test`
- `bun run build`

### Commit-push-pr optional gh probe coverage

- extended the same integration coverage to the optional `gh pr view --json number 2>/dev/null || true` probe used by `/commit-push-pr`
- the test runs under the same source-shaped permission context that the command builds for itself (`Bash(gh pr view:*)`)
- this locks the intended behavior:
  - the optional gh probe may return empty output
  - it must not turn into a prompt-generation failure
  - it must not inject shell-reset noise when the repository state is aligned

Verification:

- `bun test src/utils/__tests__/promptShellExecution.test.ts`
- `bun test`
- `bun run build`

### Review and commit-push-pr command prompt coverage

- added command-level regression coverage for:
  - `/review`
  - `/commit-push-pr`
- `/review` is now locked to stay a local review prompt that threads the provided PR number into the generated prompt text
- `/commit-push-pr` is now covered at the command surface, not just the shared shell helper:
  - it builds prompt context from a real temporary git repository
  - it appends user-supplied extra instructions
  - it preserves the existing source-shaped git/gh probe sections
  - it stays free of shell-reset noise when repository state is aligned

Verification:

- `bun test src/commands/__tests__/reviewCommitPrompt.test.ts`
- `bun test`
- `bun run build`

### Commit command prompt coverage

- extended the same command-level regression file to cover `/commit` itself, not just the shared shell helper
- `/commit` is now locked at the command surface against a real temporary git repository:
  - it expands repo-local `git status`, `git branch`, and `git log` context
  - it surfaces the changed file in the generated prompt
  - it stays free of `Shell command failed` and `Shell cwd was reset ...` noise when repository state is aligned
- kept the command behavior unchanged; this only hardens the existing source-shaped prompt-generation path

Verification:

- `bun test src/commands/__tests__/reviewCommitPrompt.test.ts`
- `bun test`
- `bun run build`

### Plugin LSP error rendering coverage

- kept the existing plugin error rendering and guidance logic unchanged
- added regression coverage for the LSP-specific `/plugin` error surfaces in [PluginErrors.test.ts](/E:/appdev/claudecode-rebuild/src/commands/plugin/PluginErrors.test.ts)
- covered:
  - `lsp-server-start-failed`
  - `lsp-server-crashed`
  - `lsp-request-timeout`
  - `lsp-request-failed`
  - `lsp-config-invalid` guidance
- this hardens the original plugin/LSP error chain without inventing any new product behavior

Verification:

- `bun test src/commands/plugin/PluginErrors.test.ts`
- `bun test`
- `bun run build`

### Project-local LSP discovery

- confirmed that the current runtime had `0` discovered LSP servers because no installed plugin actually declared `lspServers` or `.lsp.json`
- added project-local LSP discovery through `.recode/lsp.json` in `src/services/lsp/localConfig.ts`
- merged project-local LSP servers ahead of plugin servers without changing the existing manager lifecycle
- added `src/services/lsp/__tests__/localConfig.test.ts`
- added `.recode/lsp.example.json`
- verification:
  - `bun test src/services/lsp/__tests__/localConfig.test.ts`
  - `bun run build`

### LSP and worktree verification hardening

- verified a real LSP request/response path against a working local server after adding `.recode/lsp.json` support
- added `src/utils/__tests__/worktree.test.ts`
- covered real git worktree create, cleanup, dirty-file detection, and post-commit change detection in automated tests
- changed the user-visible `/branch` resume hint from `claude -r` to `recode -r`
- verification:
- `bun test src/utils/__tests__/worktree.test.ts`
- `bun test`
- `bun run build`

### LSP daily-use diagnostics

- added live LSP summary data to `src/utils/doctorDiagnostic.ts`
- `/doctor` now prints:
  - local `.recode/lsp.json` presence
  - configured server counts (local vs plugin)
  - manager initialization status
  - instantiated server counts and error counts
- `/status` now includes a compact LSP health line through `buildInstallationHealthDiagnostics()`
- kept the existing LSP manager lifecycle unchanged; this was a visibility patch, not a behavioral rewrite

Verification:

- `bun ./src/entrypoints/cli.tsx -p "/doctor"`
- `bun ./src/entrypoints/cli.tsx -p "/status"`
- `bun test`
- `bun run build`

### LSP recommendation plumbing

- kept the existing manager and plugin architecture unchanged
- reused the existing `src/utils/plugins/lspRecommendation.ts` path inside `LSPTool` when no server matches a file
- direct no-server failures can now append matching plugin suggestions if the right LSP binary is already installed on the machine
- kept the project-local `.recode/lsp.json` guidance and `.recode/lsp.example.json` quickstart intact; plugin recommendations are additive, not a replacement
- manager-unavailable messages now also point to the checked-in `.recode/lsp.example.json` quickstart
- `/doctor` now shows the checked-in example server command line and whether the launcher binary exists locally

Verification:

- `bun test src/tools/LSPTool/__tests__/messages.test.ts`
- `bun ./src/entrypoints/cli.tsx -p "/doctor"`
- `bun ./src/entrypoints/cli.tsx -p "/status"`
- `bun test`
- `bun run lint`
- `bun run build`

### Context table cleanup

- verified headless `/context` output against the current workspace
- found duplicate skill rows in the rendered skills table
- fixed the duplication in `src/utils/analyzeContext.ts` by deduplicating display rows on `(source, name)` without changing actual skill loading or execution
- added `src/utils/__tests__/analyzeContext.test.ts`

Verification:

- `bun ./src/entrypoints/cli.tsx -p "/context"`
- `bun test src/utils/__tests__/analyzeContext.test.ts src/utils/__tests__/context.test.ts`
- `bun test`
- `bun run build`

### Branch command routing parity

- added an explicit non-interactive sibling for `/branch`
- command ordering now guarantees the headless fallback is selected before the interactive JSX command
- this keeps `/branch` aligned with `/review` and `/commit-push-pr`: interactive-only in behavior, but precise in non-interactive failure mode

Verification:

- `bun ./src/entrypoints/cli.tsx -p "/branch"`
- `bun test`
- `bun run build`

### Commit command routing parity

- replaced the ambiguous headless `(no content)` outcome for `/commit` with an explicit interactive-only fallback
- kept the actual interactive commit prompt path untouched
- command ordering now guarantees the non-interactive sibling is selected first in headless mode

Verification:

- `bun ./src/entrypoints/cli.tsx -p "/commit"`
- `bun test`
- `bun run build`

### Command ordering regression coverage

- added `src/__tests__/commandOrdering.test.ts`
- covered the highest-risk headless routing cases:
  - `/branch`
  - `/commit`
  - `/review`
  - `/commit-push-pr`
- the test asserts that non-interactive sessions resolve these names to local fallback commands before the interactive prompt/JSX variants

Verification:

- `bun test src/__tests__/commandOrdering.test.ts`
- `bun test`
- `bun run build`

### Headless prompt output hardening

- found that `/commit` could finish with an empty final text body in headless mode, which rendered as a visually blank CLI result
- kept the QueryEngine/SDK result contract unchanged
- hardened [print.ts](/E:/appdev/claudecode-rebuild/src/cli/print.ts) so human CLI output now prints the existing `(no content)` sentinel instead of a blank line when a prompt command finishes without textual output

Verification:

- `bun ./src/entrypoints/cli.tsx -p "/commit"`
- `bun test`
- `bun run build`

### LSP failure-message hardening

- added pure helper functions under [messages.ts](/E:/appdev/claudecode-rebuild/src/tools/LSPTool/messages.ts) for LSP availability errors
- when the LSP manager is unavailable, the tool now points users to `/doctor` and the local `.recode/lsp.json` path instead of returning a vague startup error
- when no matching server exists for a file type, the tool now points users to `.recode/lsp.json` or plugin-provided servers instead of only echoing the file extension
- added unit coverage in [messages.test.ts](/E:/appdev/claudecode-rebuild/src/tools/LSPTool/__tests__/messages.test.ts)

Verification:

- `bun test src/tools/LSPTool/__tests__/messages.test.ts`
- `bun test`
- `bun run build`

### Provider bootstrap alignment

- moved project-local provider loading forward into `src/entrypoints/cli.tsx` so `.recode/local-provider.json` is applied before the main startup flow

### CI and headless command stabilization

- cleared the blocking `bun run lint` error set so CI no longer fails every time a commit is pushed
- fixed remaining lint blockers without changing runtime behavior:
  - removed dead `biome-ignore` suppressions that had become errors
  - replaced NaN self-comparisons with `Number.isNaN(...)`
  - rewrote async Promise executors into source-faithful async wrappers

### Command registry stability before config enablement

- found that loading the command registry before configs were enabled could
  crash while computing `/model` description text with `Config accessed before allowed.`
- kept the existing `/model` command shape, but made its description fall back
  to a generic string when model rendering is unavailable that early in startup
- added regression coverage so `getCommands()` still resolves in a
  non-interactive session even when `process.env.NODE_ENV !== 'test'`

Verification:

- ad hoc `getCommands()` registry inspection now resolves instead of throwing
- `bun test src/__tests__/commandOrdering.test.ts`
- `bun test`
- `bun run build`

### Headless command routing cleanup

- added an explicit non-interactive sibling for `/compact` so headless mode
  now returns a precise interactive-only message instead of the ambiguous
  `(no content)` sentinel
- added an explicit non-interactive sibling for `/init` because the current
  source-level workflow depends on AskUserQuestion and can otherwise hang in
  headless mode
- extended command-ordering regression coverage to include `/compact` and
  the main git workflow commands
- added a regression guard that external builds do not surface internal-only
  commands such as `/reset-limits` and `/version`
- added direct tests for `deriveFirstPrompt()` so conversation branching keeps
  its existing title-shaping behavior (whitespace collapse, first-text-block
  extraction, and 100-char truncation)
- extended LSP daily-use diagnostics so invalid `.recode/lsp.json` files are
  surfaced as validation failures instead of looking identical to “0 servers”
  with no local clue

Verification:

- `bun ./src/entrypoints/cli.tsx -p "/compact"`
- `bun ./src/entrypoints/cli.tsx -p "/init"`
- `bun ./src/entrypoints/cli.tsx -p "/help"`
- `bun test src/__tests__/commandOrdering.test.ts`
- `bun test src/commands/branch/branch.test.ts`
- `bun test src/services/lsp/__tests__/localConfig.test.ts`
- `bun test`
- `bun run build`
- added explicit non-interactive fallback messaging for `/review`
- fixed `/commit-push-pr` command ordering so the non-interactive fallback is actually selected in headless mode

Verification:

- `bun run lint`
- `bun test`
- `bun run build`
- `bun ./src/entrypoints/cli.tsx -p "/review"`
- `bun ./src/entrypoints/cli.tsx -p "/commit-push-pr"`
- limited Anthropic-only background prefetches in `src/main.tsx` to first-party Anthropic base URLs
- limited headless GrowthBook initialization in `src/cli/print.ts` to first-party Anthropic base URLs
- kept the narrower `initializeGrowthBook()` ant-only branch in `main.tsx` unchanged because it is already scoped to the ant build path

### Portable runtime fixes

- portable runtime work is no longer kept under the repository root
- current canonical local portable runtime copy lives at `E:\appdev\recode-portable`
- fixed portable search-tool failures by teaching `src/utils/ripgrep.ts` to fall back to the SDK vendored ripgrep binary when the local vendor path does not contain a real `rg.exe`
- verified the portable runtime resolves ripgrep from `node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/x64-win32/rg.exe`
- verified `E:\appdev\recode-portable\recode.bat -p "/doctor"` now reports `ripgrep: ok (builtin)`

### Repository hygiene

- preserved local-only provider secrets under ignored `.recode` files
- noted that the old `E:\\recode-portable` directory still exists only because another process is holding it open; the canonical local portable copy now lives at `E:\\appdev\\recode-portable`

### LSP daily-use diagnostics

- kept the existing LSP architecture and only tightened the diagnostics path
- `getLspDiagnosticSummary()` now reports configured project-local servers from `.recode/lsp.json` together with their resolved command lines and whether the local launcher exists
- `/doctor` now prints configured local LSP servers in the same style as the checked-in example server list
- `/status` now emits an explicit `LSP local launcher missing` health item when a configured project-local server command is not available on the current machine
- added regression coverage in [src/utils/__tests__/doctorDiagnostic.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/doctorDiagnostic.test.ts)

Verification:

- `bun test src/utils/__tests__/doctorDiagnostic.test.ts src/services/lsp/__tests__/localConfig.test.ts src/tools/LSPTool/__tests__/messages.test.ts src/__tests__/commandOrdering.test.ts`
- `bun run build`
- `bun run lint`
- ad hoc `/doctor` run from a temporary directory with a deliberately missing LSP launcher now reports `LSP local server: ... (launcher missing)`

### Branch/worktree coverage

- kept the existing worktree implementation shape and only expanded regression coverage
- added tests for `.worktreeinclude` propagation so gitignored local files that are explicitly included now have automated coverage
- added tests for the collapsed ignored-directory expansion path, so patterns like `config/**/*.key` still copy nested files from fully ignored directories into the worktree

Verification:

- `bun test src/utils/__tests__/worktree.test.ts`
- `bun run build`

### Ripgrep path stability

- fixed a real programming-path regression in [src/utils/ripgrep.ts](/E:/appdev/claudecode-rebuild/src/utils/ripgrep.ts): vendored ripgrep resolution was using `process.cwd()` for the SDK fallback path, which broke builtin search diagnostics when `recode` was launched from a directory outside the repository root
- kept the existing ripgrep architecture and only changed path resolution to be package-root-relative
- added regression coverage in [src/utils/__tests__/ripgrep.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/ripgrep.test.ts) so a subprocess launched from a temp directory still resolves the vendored `rg.exe`

Verification:

- ad hoc `bun ./src/entrypoints/cli.tsx -p "/doctor"` from a temporary external cwd now reports `ripgrep: ok (builtin)`
- `bun test src/utils/__tests__/ripgrep.test.ts`
- `bun test`
- `bun run build`

### LSP state diagnostics

- tightened the LSP diagnostic wording in [src/utils/doctorDiagnostic.ts](/E:/appdev/claudecode-rebuild/src/utils/doctorDiagnostic.ts) so stopped instances are no longer counted as `active`
- `/doctor` now reports instantiated LSP servers as `running / stopped / starting-stopping / error`
- `/status` now summarizes instantiated servers using `running` count instead of the old misleading `active` count

Verification:

- ad hoc `/doctor` run from a temporary directory with a missing local LSP launcher now reports `1 instantiated (0 running, 1 stopped, 0 starting/stopping, 0 error)`
- `bun test`
- `bun run build`

### Direct LSP failure guidance

- extended [src/tools/LSPTool/messages.ts](/E:/appdev/claudecode-rebuild/src/tools/LSPTool/messages.ts) so direct LSP failures do not stop at config-path/example hints
- when `.recode/lsp.json` already defines a local server but its launcher is missing, `buildNoLspServerMessage()` and `buildLspManagerUnavailableMessage()` now surface that exact missing launcher command first
- added regression coverage in [src/tools/LSPTool/__tests__/messages.test.ts](/E:/appdev/claudecode-rebuild/src/tools/LSPTool/__tests__/messages.test.ts)

Verification:

- `bun test src/tools/LSPTool/__tests__/messages.test.ts`
- `bun test`
- `bun run build`

### Branch transcript-fork coverage

- extended [branch.test.ts](/E:/appdev/claudecode-rebuild/src/commands/branch/branch.test.ts) beyond title derivation and into the real `/branch` transcript path
- the new integration test now verifies that a forked session:
  - copies main-thread transcript messages into the new session file
  - preserves `forkedFrom` traceability
  - carries forward `content-replacement` records into the fork
  - resumes into the new fork with a `recode -r` hint back to the original session
  - writes the expected branch title suffix through the normal `saveCustomTitle` path
- kept the command behavior unchanged; this only hardens the existing source-shaped branch/session-storage chain

Verification:

- `bun test src/commands/branch/branch.test.ts`
- `bun run build`

### Project-local LSP aggregation coverage

- extended [localConfig.test.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/__tests__/localConfig.test.ts) so project-local servers are explicitly locked to:
  - `scope: dynamic`
  - `source: project-local`
- added [config.test.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/__tests__/config.test.ts) to cover the next source-shaped join point:
  - `getAllLspServers()` includes project-local `.recode/lsp.json` servers in the total server map
  - no plugin changes or architecture changes were introduced; this only hardens the existing merge path

Verification:

- `bun test src/services/lsp/__tests__/localConfig.test.ts src/services/lsp/__tests__/config.test.ts`
- `bun run build`

### LSP recommendation filtering coverage

- added [lspRecommendation.test.ts](/E:/appdev/claudecode-rebuild/src/utils/plugins/__tests__/lspRecommendation.test.ts) to lock the existing recommendation path in [lspRecommendation.ts](/E:/appdev/claudecode-rebuild/src/utils/plugins/lspRecommendation.ts)
- covered the original-source behavior for:
  - official marketplace recommendations sorting ahead of community ones
  - filtering out already-installed plugins
  - filtering out recommendations when the required local binary is missing
  - honoring the `lspRecommendationNeverPlugins` block list
  - disabling recommendations when `lspRecommendationDisabled` is set or the ignore threshold is reached
  - skipping marketplace entries that only expose external `.lsp.json` paths
- kept runtime behavior unchanged; this only hardens the existing recommendation/discoverability chain

Verification:

- `bun test src/utils/plugins/__tests__/lspRecommendation.test.ts`
- `bun test`
- `bun run build`

### Branch title collision coverage

- extended [branch.test.ts](/E:/appdev/claudecode-rebuild/src/commands/branch/branch.test.ts) with the original numbered-title collision behavior that already exists in [branch.ts](/E:/appdev/claudecode-rebuild/src/commands/branch/branch.ts)
- the new integration case creates existing sibling sessions with:
  - `please review this patch (Branch)`
  - `please review this patch (Branch 3)`
- then verifies a new `/branch` fork correctly fills the gap with:
  - `please review this patch (Branch 2)`
- runtime behavior is unchanged; this only hardens the existing session-title collision path

Verification:

- `bun test src/commands/branch/branch.test.ts`
- `bun test`
- `bun run build`

### LSP diagnostic-summary coverage

- extended [doctorDiagnostic.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/doctorDiagnostic.test.ts) to harden the existing summary path in [doctorDiagnostic.ts](/E:/appdev/claudecode-rebuild/src/utils/doctorDiagnostic.ts)
- covered the source-shaped cases for:
  - `.recode/lsp.example.json` present with no active local config, including the generated quickstart hint
  - invalid `.recode/lsp.json`, including surfacing the validation error text
- runtime behavior is unchanged; this only locks the existing `/doctor` and `/status` diagnostic summary behavior

Verification:

- `bun test src/utils/__tests__/doctorDiagnostic.test.ts`
- `bun test`
- `bun run build`

### Daily-use headless command coverage

- added [dailyUseCommands.test.ts](/E:/appdev/claudecode-rebuild/src/commands/__tests__/dailyUseCommands.test.ts) to lock the current source-shaped headless outputs for:
  - `/files`
  - `/diff`
  - `/tasks`
- covered:
  - `/files` empty-context and relative-path rendering
  - `/diff` non-git, clean-tree, and per-file summary output
  - `/tasks` empty state and running-first task ordering
- kept all command behavior unchanged; this only adds regression coverage for the already-wired daily-use command paths

Verification:

- `bun test src/commands/__tests__/dailyUseCommands.test.ts`
- `bun test`
- `bun run build`

### LSP manager routing coverage

- added [LSPServerManager.test.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/__tests__/LSPServerManager.test.ts) to harden the source-shaped manager path in [LSPServerManager.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/LSPServerManager.ts)
- covered:
  - extension-based routing from project-local `.recode/lsp.json` servers
  - invalid server-config isolation so one broken config does not remove valid servers
  - lazy start semantics where a stopped matching server is started once and then reused
- runtime behavior is unchanged; this only adds regression coverage to the existing LSP manager path

Verification:

- `bun test src/services/lsp/__tests__/LSPServerManager.test.ts`
- `bun test`
- `bun run build`

### LSP first daily-use path coverage

- added [LSPDailyUse.test.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/__tests__/LSPDailyUse.test.ts) to verify a real source-shaped local server path instead of only isolated config/manager pieces
- the test spins up a temporary stdio LSP server process and verifies the existing manager/runtime path end-to-end:
  - project-local server config is discovered
  - the server is initialized
  - `didOpen` is sent for a real file
  - a definition request returns through the manager path
- this does not add a new feature; it locks the already-supported local `.recode/lsp.json` daily-use path with stronger evidence

Verification:

- `bun test src/services/lsp/__tests__/LSPDailyUse.test.ts`
- `bun test`
- `bun run build`

### Worktree keep/reuse coverage

- extended [worktree.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/worktree.test.ts) with the existing source-shaped keep/reuse behavior:
  - `keepWorktree()` clears session/config state while preserving the linked worktree on disk
  - `createWorktreeForSession()` reuses the same named worktree when it already exists instead of recreating it
- these tests do not introduce new workflow behavior; they only lock the current named-worktree semantics behind the git-backed implementation

Verification:

- `bun test src/utils/__tests__/worktree.test.ts`
- `bun test`
- `bun run build`

### CCB Item 5: ultraplan alignment

- merged the current CCB ultraplan enablement slice without rewriting the
  existing source runtime
- added the missing source-shaped UI components:
  - [UltraplanChoiceDialog.tsx](/E:/appdev/claudecode-rebuild/src/components/ultraplan/UltraplanChoiceDialog.tsx)
  - [UltraplanLaunchDialog.tsx](/E:/appdev/claudecode-rebuild/src/components/ultraplan/UltraplanLaunchDialog.tsx)
- updated [REPL.tsx](/E:/appdev/claudecode-rebuild/src/screens/REPL.tsx) to
  import and mount the ultraplan dialogs explicitly, matching the current CCB
  layout
- aligned source-runtime external gating by defaulting
  `FEATURE_ULTRAPLAN=1` in [cli.tsx](/E:/appdev/claudecode-rebuild/src/entrypoints/cli.tsx)
  and honoring that env in:
  - [commands.ts](/E:/appdev/claudecode-rebuild/src/commands.ts)
  - [REPL.tsx](/E:/appdev/claudecode-rebuild/src/screens/REPL.tsx)
  - [ultraplan.tsx](/E:/appdev/claudecode-rebuild/src/commands/ultraplan.tsx)
- added a permanent regression for the non-interactive `/ultraplan` fallback in
  [processSlashCommand.test.ts](/E:/appdev/claudecode-rebuild/src/utils/processUserInput/__tests__/processSlashCommand.test.ts)
- fixed command cache invalidation so env-driven command-surface changes clear
  both `COMMANDS()` and `builtInCommandNames()`

Verification:

- `bun test`
- `bun run build`
- `bun ./src/entrypoints/cli.tsx -p "/ultraplan"`

### CCB Item 6: voice alignment

- verified that the current `recode` source already contains the voice runtime:
  - `src/commands/voice/*`
  - `src/voice/*`
  - REPL/input/footer/config voice surfaces
- compared that against the current CCB enablement change and confirmed the
  delta is primarily gate/default wiring, not a missing subsystem
- defaulted `FEATURE_VOICE_MODE=1` in the source launcher so source-runtime
  sessions mirror the current CCB build-feature default
- aligned the existing voice gate checks across command registration, REPL
  hook wiring, AppState voice provider wiring, prompt-footer/input surfaces,
  ConfigTool, and settings-schema registration
- added a permanent regression so `/voice` now resolves to the standard
  interactive-only headless fallback instead of `Unknown skill`

Verification:

- `bun test src/utils/processUserInput/__tests__/processSlashCommand.test.ts`
- `bun ./src/entrypoints/cli.tsx -p "/voice"`
- `bun ./dist/cli.js -p "/voice"`
- `bun test`
- `bun run build`
- `bun run lint`

### CCB Item 7: bridge alignment

- diffed the existing bridge runtime against the current CCB tree and confirmed
  the bridge implementation itself was already aligned; unlike voice, the real
  gap was source-first feature opt-in support rather than missing runtime files
- kept bridge **off by default** for external runs because CCB does not include
  `BRIDGE_MODE` in its default external build feature list
- added explicit `FEATURE_BRIDGE_MODE` source-first support across the existing
  bridge surfaces so local testing can mirror a feature-enabled build without
  inventing new bridge behavior:
  - `src/entrypoints/cli.tsx`
  - `src/main.tsx`
  - `src/commands.ts`
  - `src/commands/bridge/index.ts`
  - `src/bridge/bridgeEnabled.ts`
  - REPL/footer/settings/config bridge surfaces
- added a permanent regression so `/remote-control` now resolves to the
  standard interactive-only fallback when `FEATURE_BRIDGE_MODE=1`, matching the
  source-faithful headless behavior used for other interactive-only commands

Verification:

- `bun test src/utils/processUserInput/__tests__/processSlashCommand.test.ts`
- `FEATURE_BRIDGE_MODE=1 bun ./src/entrypoints/cli.tsx -p "/remote-control"`
- `FEATURE_BRIDGE_MODE=1 bun ./dist/cli.js -p "/remote-control"`
- `bun test`
- `bun run build`
- `bun run lint`

### CCB Item 9: brief / KAIROS_BRIEF alignment

- compared the current brief surfaces against CCB and confirmed the useful
  delta was gate/default alignment, not a missing brief subsystem
- defaulted `FEATURE_KAIROS_BRIEF=1` in the source launcher so source-first
  sessions mirror the packaged feature default
- taught `build.ts` to include `KAIROS_BRIEF` in the packaged default feature
  set
- added [briefFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/tools/BriefTool/briefFeatureEnabled.ts)
  and used it to align the existing brief runtime across:
  - [BriefTool.ts](/E:/appdev/claudecode-rebuild/src/tools/BriefTool/BriefTool.ts)
  - [brief.ts](/E:/appdev/claudecode-rebuild/src/commands/brief.ts)
  - [commands.ts](/E:/appdev/claudecode-rebuild/src/commands.ts)
  - [main.tsx](/E:/appdev/claudecode-rebuild/src/main.tsx)
  - [prompts.ts](/E:/appdev/claudecode-rebuild/src/constants/prompts.ts)
  - key brief UI / transcript / settings / keybinding / recovery surfaces
- added a permanent regression so `/brief` now resolves to the standard
  interactive-only fallback instead of `Unknown skill`
- verified source-first help now exposes `--brief`

Verification:

- `bun test`
- `bun run build`
- `bun run lint`
- `bun ./src/entrypoints/cli.tsx -p "/brief"`
- `bun ./dist/cli.js -p "/brief"`
- `bun ./src/entrypoints/cli.tsx --help`

### CCB Item 10: away-summary / AWAY_SUMMARY alignment

- compared the current away-summary surfaces against CCB and confirmed the
  useful delta was gate/default alignment plus updated idle handling for
  terminals that only report `unknown` focus state
- defaulted `FEATURE_AWAY_SUMMARY=1` in the source launcher so source-first
  sessions mirror the packaged feature default
- taught `build.ts` to include `AWAY_SUMMARY` in the packaged default feature
  set
- added
  [awaySummaryFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/hooks/awaySummaryFeatureEnabled.ts)
  and used it to align the existing away-summary runtime across:
  - [useAwaySummary.ts](/E:/appdev/claudecode-rebuild/src/hooks/useAwaySummary.ts)
  - [REPL.tsx](/E:/appdev/claudecode-rebuild/src/screens/REPL.tsx)
- aligned the existing away-summary hook with the current CCB behavior for
  terminals that do not expose focus tracking:
  - `unknown` focus state now schedules idle timers
  - `isLoading` transitions act as the presence signal so CMD/PowerShell style
    terminals can still produce away summaries after generation finishes
- added a permanent regression for the source-first gate helper in
  [awaySummaryFeatureEnabled.test.ts](/E:/appdev/claudecode-rebuild/src/hooks/__tests__/awaySummaryFeatureEnabled.test.ts)

Verification:

- `bun test`
- `bun run build`
- `bun run lint`

### CCB Item 11: token-budget / TOKEN_BUDGET alignment

- compared the current token-budget surfaces against CCB and confirmed the
  useful delta was gate/default alignment, not a missing budgeting subsystem
- defaulted `FEATURE_TOKEN_BUDGET=1` in the source launcher so source-first
  sessions mirror the packaged feature default
- taught `build.ts` to include `TOKEN_BUDGET` in the packaged default feature
  set
- added
  [tokenBudgetFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/utils/tokenBudgetFeatureEnabled.ts)
  and used it to align the existing token-budget runtime across:
  - [prompts.ts](/E:/appdev/claudecode-rebuild/src/constants/prompts.ts)
  - [query.ts](/E:/appdev/claudecode-rebuild/src/query.ts)
  - [REPL.tsx](/E:/appdev/claudecode-rebuild/src/screens/REPL.tsx)
  - [attachments.ts](/E:/appdev/claudecode-rebuild/src/utils/attachments.ts)
  - [Spinner.tsx](/E:/appdev/claudecode-rebuild/src/components/Spinner.tsx)
  - [PromptInput.tsx](/E:/appdev/claudecode-rebuild/src/components/PromptInput/PromptInput.tsx)
- added a permanent regression for the source-first gate helper in
  [tokenBudgetFeatureEnabled.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/tokenBudgetFeatureEnabled.test.ts)

Verification:

- `bun test`
- `bun run build`
- `bun run lint`

### CCB Item 12: prompt-cache-break / PROMPT_CACHE_BREAK_DETECTION alignment

- compared the current prompt-cache-break surfaces against CCB and confirmed
  the useful delta was gate/default alignment, not a missing runtime
- defaulted `FEATURE_PROMPT_CACHE_BREAK_DETECTION=1` in the source launcher so
  source-first sessions mirror the packaged feature default
- taught `build.ts` to include `PROMPT_CACHE_BREAK_DETECTION` in the packaged
  default feature set
- added
  [promptCacheBreakFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/utils/promptCacheBreakFeatureEnabled.ts)
  and used it to align the existing prompt-cache-break runtime across:
  - [compact.ts](/E:/appdev/claudecode-rebuild/src/commands/compact/compact.ts)
  - [microCompact.ts](/E:/appdev/claudecode-rebuild/src/services/compact/microCompact.ts)
  - [compact.ts](/E:/appdev/claudecode-rebuild/src/services/compact/compact.ts)
  - [autoCompact.ts](/E:/appdev/claudecode-rebuild/src/services/compact/autoCompact.ts)
  - [claude.ts](/E:/appdev/claudecode-rebuild/src/services/api/claude.ts)
  - [runAgent.ts](/E:/appdev/claudecode-rebuild/src/tools/AgentTool/runAgent.ts)
- added a permanent regression for the source-first gate helper in
  [promptCacheBreakFeatureEnabled.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/promptCacheBreakFeatureEnabled.test.ts)

Verification:

- `bun test`
- `bun run build`
- `bun run lint`

### CCB Item 13: verification-agent / VERIFICATION_AGENT alignment

- compared the current verification-agent surfaces against CCB and confirmed
  the useful delta was gate/default alignment, not a missing agent runtime
- defaulted `FEATURE_VERIFICATION_AGENT=1` in the source launcher so
  source-first sessions mirror the packaged feature default
- taught `build.ts` to include `VERIFICATION_AGENT` in the packaged default
  feature set
- added
  [verificationAgentFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/tools/AgentTool/verificationAgentFeatureEnabled.ts)
  and used it to align the existing verification-agent runtime across:
  - [prompts.ts](/E:/appdev/claudecode-rebuild/src/constants/prompts.ts)
  - [TodoWriteTool.ts](/E:/appdev/claudecode-rebuild/src/tools/TodoWriteTool/TodoWriteTool.ts)
  - [TaskUpdateTool.ts](/E:/appdev/claudecode-rebuild/src/tools/TaskUpdateTool/TaskUpdateTool.ts)
  - [builtInAgents.ts](/E:/appdev/claudecode-rebuild/src/tools/AgentTool/builtInAgents.ts)
- added a permanent regression for the source-first gate helper in
  [verificationAgentFeatureEnabled.test.ts](/E:/appdev/claudecode-rebuild/src/tools/AgentTool/__tests__/verificationAgentFeatureEnabled.test.ts)

Verification:

- `bun test`
- `bun run build`
- `bun run lint`

### Session restore continuity coverage

- added [sessionRestore.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/sessionRestore.test.ts) to lock the existing continuity path in [sessionRestore.ts](/E:/appdev/claudecode-rebuild/src/utils/sessionRestore.ts)
- covered:
  - `restoreWorktreeForResume()` re-enters a persisted worktree and updates cwd/session state
  - `exitRestoredWorktree()` returns to the original cwd and clears the restored worktree session
  - stale missing worktree paths are ignored safely instead of leaving the session in a broken resumed state
  - a fresh already-active worktree session takes precedence over stale transcript state
  - exiting a restored worktree remains safe even if the original cwd has already disappeared
- this does not add new behavior; it hardens the current resume/worktree continuity chain

Verification:

- `bun test src/utils/__tests__/sessionRestore.test.ts`
- `bun test`
- `bun run build`

### Permission stripping/restore continuity coverage

- added [permissionSetup.test.ts](/E:/appdev/claudecode-rebuild/src/utils/permissions/__tests__/permissionSetup.test.ts) to lock the existing auto/classifier permission flow in [permissionSetup.ts](/E:/appdev/claudecode-rebuild/src/utils/permissions/permissionSetup.ts)
- covered:
  - `stripDangerousPermissionsForAutoMode()` removes canonical wildcard rules such as `Bash(*)`, `PowerShell(*)`, and `Agent(*)` from editable sources while preserving safe rules
  - `restoreDangerousPermissions()` restores those stripped rules and clears the stash cleanly
  - legacy `Task(...)` CLI allow rules are still recognized as dangerous classifier-bypass rules
- fixed the underlying in-memory removal path in [PermissionUpdate.ts](/E:/appdev/claudecode-rebuild/src/utils/permissions/PermissionUpdate.ts) so rule removal now compares canonicalized rule strings, which keeps tool-wide wildcard spellings like `Agent(*)` and `Bash(*)` source-faithful when they round-trip through the parser
- this is not a new feature; it hardens the existing permissions continuity path so canonical and legacy rule spellings behave the same way under auto/classifier stripping

Verification:

- `bun test src/utils/permissions/__tests__/permissionSetup.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Agent worktree lifecycle coverage

- extended [worktree.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/worktree.test.ts) with the existing isolated-agent worktree path in [worktree.ts](/E:/appdev/claudecode-rebuild/src/utils/worktree.ts)
- covered:
  - `createAgentWorktree()` creates an isolated git worktree rooted at the canonical repo
  - agent worktree creation does **not** mutate the caller's current worktree/session state
  - `removeAgentWorktree()` removes the linked worktree directory and deletes the temporary worktree branch
- this is source-faithful hardening for the existing agent worktree lifecycle; it does not introduce any new workflow behavior

Verification:

- `bun test src/utils/__tests__/worktree.test.ts`
- `bun test`
- `bun run build`

### Windows unresolved-app feedback hardening

- tightened the existing Windows desktop-control request shaping inside [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts) so unresolved `request_access` / `request_teach_access` requests no longer fall through to the approval dialog path
- added actionable installed-app guidance for unresolved Windows app requests:
  - when close installed matches exist, the response now suggests them directly
  - when no close matches exist, the response falls back to exact installed-name / executable-name guidance without hard-coding Windows-only wording into shared handlers
- kept the change inside `@ant/computer-use-mcp` request normalization and response shaping; no new commands, no new config, no new runtime layer
- added focused regression coverage in [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts), including:
  - the grant-flag edge case so unresolved `request_access` requests still short-circuit before the approval dialog even when flags like `clipboardRead` are requested
  - explicit-false grant flags so blank app lists do not open an empty approval dialog
  - a non-Windows platform check so the shared unresolved guidance stays generic outside the Windows path
  - mixed resolved/unresolved requests so only resolved apps reach the approval dialog and unresolved names are surfaced as `not_installed`
  - mixed unresolved + `userDenied` requests with no remaining resolved apps so the dialog is skipped entirely and both guidance paths remain visible

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Windows Python bridge lifecycle hardening

- tightened
  [bridgeClient.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/bridgeClient.ts)
  so a dead Python bridge no longer remains cached as if it were healthy
- added bridge invalidation helpers that:
  - clear the active bridge handle
  - reject all pending requests with a stable error
  - ignore stale exit notifications from older bridge processes
- wired `ensureBridge()` to invalidate on:
  - process exit
  - unexpected stdout closure
  - stdout read failure
- kept the public bridge API unchanged and added focused regression coverage in
  [bridgeClient.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/__tests__/bridgeClient.test.ts)
- this is a runtime reliability fix only; it does not add commands, settings,
  or a new transport layer

Verification:

- `bun test src/utils/computerUse/win32/__tests__/bridgeClient.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Windows existing-window matching hardening

- extended
  [windowEnum.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/windowEnum.ts)
  so each enumerated window now includes `processName`
- tightened
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  `findExistingWindow()` so it:
  - prefers exact process-name matches
  - falls back to strong title-prefix/title-suffix matches
  - no longer binds based on arbitrary title substring hits
- added focused regression coverage in
  [win32WindowMatching.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32WindowMatching.test.ts)
- this keeps the existing reuse behavior but removes the most dangerous
  silent mis-bind cases for generic hints such as `Terminal` or `Code`

Verification:

- `bun test src/utils/computerUse/__tests__/win32WindowMatching.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Bundled skills menu exposure

- updated
  [SkillsMenu.tsx](/E:/appdev/claudecode-rebuild/src/components/skills/SkillsMenu.tsx)
  so the interactive `/skills` browser includes bundled skills in addition to
  user/plugin/MCP skills
- added a small pure helper and regression in
  [SkillsMenu.test.ts](/E:/appdev/claudecode-rebuild/src/components/skills/__tests__/SkillsMenu.test.ts)
- this restores a real interactive exposure gap without adding any new command
  surface or settings

Verification:

- `bun test src/components/skills/__tests__/SkillsMenu.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Source-first ultraplan prompt/exposure alignment

- added
  [ultraplanFeatureEnabled.ts](/E:/appdev/claudecode-rebuild/src/utils/ultraplanFeatureEnabled.ts)
  so source-first `ULTRAPLAN` affordances can reuse the same gate/default logic
  already used elsewhere
- switched the prompt-input trigger/highlight and notification path in
  [PromptInput.tsx](/E:/appdev/claudecode-rebuild/src/components/PromptInput/PromptInput.tsx)
  away from raw `feature('ULTRAPLAN')` checks
- switched the exit-plan dialog visibility check in
  [ExitPlanModePermissionRequest.tsx](/E:/appdev/claudecode-rebuild/src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx)
  to the same helper
- replaced the local REPL-only helper with the shared helper in
  [REPL.tsx](/E:/appdev/claudecode-rebuild/src/screens/REPL.tsx)
- added focused regression coverage in
  [ultraplanFeatureEnabled.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/ultraplanFeatureEnabled.test.ts)
- this is a source-first parity fix only; no new command, no new gate, no new
  runtime behavior beyond restoring the existing inline affordances

Verification:

- `bun test src/utils/__tests__/ultraplanFeatureEnabled.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Bound-window pointer-state hardening

- added a tiny bound-pointer state inside
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so the executor remembers the latest bound-window pointer position
- updated bound-window `mouseDown()` / `mouseUp()` to resolve client coords
  from:
  - the recorded bound-window pointer position, or
  - a fallback conversion from real mouse screen coords via `windowRect` and
    cached non-client offset
- reset that pointer state when a window is rebound or unbound so old coords do
  not leak into a new session
- added focused regression coverage in
  [boundPointerPosition.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/boundPointerPosition.test.ts)
- this keeps the fix inside the existing executor layer; it does not rework the
  virtual-cursor implementation or add a new input abstraction

Verification:

- `bun test src/utils/computerUse/__tests__/boundPointerPosition.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Win32 edit-child cache hardening

- removed permanent `null` caching from
  [windowMessage.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/windowMessage.ts)
  `findEditChild()`
- successful child HWND discoveries are still cached, but a temporary early
  miss no longer poisons later text/mouse routing for the rest of the bound
  session
- kept the change entirely inside the existing `SendMessage` routing layer; no
  new APIs, no new settings, no runtime expansion

Verification:

- `bun test`
- `bun run build`
- `bun run lint`

### Windows app-launch race hardening

- moved the Windows pre-launch visible-window snapshot into
  [windowsAppLaunch.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/windowsAppLaunch.ts)
  so it is captured before any `Start-Process` attempt instead of after it
- wired
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  to reuse the helper rather than carrying a second inline PowerShell launch
  script
- added focused regression coverage in
  [windowsAppLaunch.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/windowsAppLaunch.test.ts)
  to keep the snapshot ordering and failure markers stable
- this is a runtime correctness fix, not a new feature: fast-launching apps no
  longer risk being mistaken for already-existing windows before bind

Verification:

- `bun test src/utils/computerUse/__tests__/windowsAppLaunch.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Bound-window generic tool routing hardening

- removed the silent bound-window auto-routing shortcut from
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  for generic tools such as:
  - `left_click`
  - `type`
  - `scroll`
  - `left_click_drag`
  - `left_mouse_down`
  - `left_mouse_up`
- kept explicit `virtual_mouse` / `virtual_keyboard` tools intact for callers
  that intentionally opt into them
- this restores the OG-style standard handler path for generic tools, so
  coordinate scaling, gate checks, and bound-window non-client offset handling
  stay in one place
- added focused regression coverage in
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  for:
  - bound-window `left_click` using the standard click path
  - bound-window `type` using the standard keyboard path
  - bound-window `left_mouse_down` / `left_mouse_up` working without requiring
    synthetic coordinates

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`

### Portable sync / release hardening

- fixed
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  so
  [sync-portable.bat](/E:/appdev/claudecode-rebuild/sync-portable.bat)
  is preserved as a managed file during normal source syncs
- hardened `-RefreshDependencies` in
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  to reject junctioned/reparse-point dependency templates instead of silently
  mirroring them into the portable tree
- hardened
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1)
  so release packaging now fails fast when the portable root's
  `package.json` or `bun.lock` no longer matches the mainline source
- documented the materialized-template requirement in
  [PORTABLE_SYNC_BOUNDARY.md](/E:/appdev/claudecode-rebuild/docs/PORTABLE_SYNC_BOUNDARY.md)

Verification:

- temp-root sync smoke preserving `sync-portable.bat` and removing unmanaged files
- temp-root release smoke rejecting a stale portable dependency base
- `bun run build`
- `bun run lint`
- `bun test`

### Shared formatting helper repair

- fixed
  [file.ts](/E:/appdev/claudecode-rebuild/src/utils/file.ts)
  so padded line-number output once again emits the intended `→` separator
  instead of a stitched/broken template literal
- rewrote
  [truncate.ts](/E:/appdev/claudecode-rebuild/src/utils/truncate.ts)
  to restore a clean shared ellipsis contract (`…`) across:
  - middle truncation
  - start truncation
  - single-line truncation
- added focused regression coverage in
  [truncate.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/truncate.test.ts)
  for compact line-number output, padded-arrow prefix stripping, and ellipsis
  formatting

Verification:

- `bun test src/utils/__tests__/truncate.test.ts`
- `bun run build`
- `bun run lint`
- `bun test`

### High-frequency metadata/status glyph repair

- fixed
  [review.ts](/E:/appdev/claudecode-rebuild/src/commands/review.ts)
  so the `/ultrareview` command description is readable again
- added a focused metadata regression in
  [reviewCommitPrompt.test.ts](/E:/appdev/claudecode-rebuild/src/commands/__tests__/reviewCommitPrompt.test.ts)
- fixed
  [StatusIcon.tsx](/E:/appdev/claudecode-rebuild/src/components/design-system/StatusIcon.tsx)
  so the loading icon uses the intended ellipsis glyph again
- added a focused source regression in
  [StatusIconSource.test.ts](/E:/appdev/claudecode-rebuild/src/components/design-system/__tests__/StatusIconSource.test.ts)

Verification:

- `bun test src/commands/__tests__/reviewCommitPrompt.test.ts`
- `bun test src/components/design-system/__tests__/StatusIconSource.test.ts`
- `bun run build`
- `bun run lint`
- `bun test`

### Portable dependency-stamp hardening

- extended
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  so `-RefreshDependencies` now writes a `.portable-deps-stamp.json` recording
  the repo `package.json` and `bun.lock` hashes that the portable
  runtime/node_modules base was refreshed against
- extended
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1)
  so release packaging now rejects:
  - missing dependency stamps
  - unreadable/incomplete dependency stamps
  - stale dependency stamps that no longer match the current repo manifests
- fixed the last repo-level lint warning in
  [PromptInputFooterSuggestionsSource.test.ts](/E:/appdev/claudecode-rebuild/src/components/PromptInput/__tests__/PromptInputFooterSuggestionsSource.test.ts)
  by splitting the template-source assertion into two literal fragments

Verification:

- temp-root smoke rejecting a missing `.portable-deps-stamp.json`
- temp-root smoke rejecting a stale `.portable-deps-stamp.json`
- temp-root smoke accepting a matching dependency stamp and producing a release tree
- `bun run build`
- `bun run lint`
- `bun test`

### Portable refresh failure + Windows tool text hardening

- updated
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  so `-RefreshDependencies` now removes any pre-existing
  `.portable-deps-stamp.json` before copying dependency payloads; a partial
  refresh failure can no longer leave an old trusted stamp behind
- added a temp-root smoke proving that a failed dependency refresh removes the
  stale stamp and therefore cannot be mistaken for a healthy dependency base
- repaired a focused batch of high-frequency user-visible stitched text in
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts):
  - tier/read-click guidance punctuation
  - screenshot / monitor / teach-mode retry hints
  - denied-app Settings breadcrumb
  - unresolved allowlist guidance
  - bounds/dimension/drag/status text
- added
  [toolCallsTextSource.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsTextSource.test.ts)
  to lock those repaired high-traffic strings
- extended that same source-level repair to the remaining teach-mode retry and
  clipboard-denial messages in the same file
- extended
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  so `-RefreshDependencies` now rejects a stale `PortableTemplateRoot`
  manifest base before copying dependencies, closing the "old template, new
  repo" mismatch hole

Verification:

- temp-root smoke rejecting stale carry-over stamps after a failed refresh
- temp-root smoke rejecting a stale `PortableTemplateRoot` before dependency refresh begins
- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsTextSource.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun run build`
- `bun run lint`
- `bun test`

### Windows multi-monitor origin correction

- extended
  [platforms/types.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/types.ts)
  so `DisplayInfo` can carry `originX` / `originY`
- updated
  [platforms/win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  to capture Windows monitor origins from `Screen.Bounds`
- updated
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so display geometry and unbound screenshot metadata preserve non-zero origins
  instead of hardcoding `(0,0)`
- added focused regressions:
  - [displayGeometry.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/displayGeometry.test.ts)
  - [win32DisplayOrigins.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32DisplayOrigins.test.ts)

Verification:

- `bun test src/utils/computerUse/__tests__/displayGeometry.test.ts src/utils/computerUse/__tests__/win32DisplayOrigins.test.ts src/utils/computerUse/__tests__/win32CaptureRegion.test.ts`
- `bun run build`
- `bun run lint`
- `bun test`

### Win32 child-HWND mouse remap hardening

- re-entered the active `$long-task-loop` and parallelized read-only review of
  the Win32 bound-input path
- confirmed a real correctness bug: after `findEditChild()` / `resolveInputHwnd()`,
  bound-window mouse messages were still using parent-client coordinates when
  targeting child input HWNDs
- repaired the bug in
  [windowMessage.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/windowMessage.ts)
  by:
  - adding a small client-point setup helper
  - extending the existing `WinMsg` Add-Type block with `POINT` and
    `MapWindowPoints`
  - remapping parent-client coordinates into child-client space for:
    - `sendClick`
    - `sendMouseDown`
    - `sendMouseUp`
    - `sendMouseMove`
    - `sendMouseWheel`
- simplified the bound click path in
  [platforms/win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  so child resolution stays inside the Win32 message layer instead of being
  duplicated in the platform wrapper
- added focused regression coverage:
  - [windowMessage.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/__tests__/windowMessage.test.ts)
  - [win32BoundClickSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32BoundClickSource.test.ts)
- locked the repaired high-frequency glyph/source-faithful surfaces with
  focused tests:
  - [BylineSource.test.ts](/E:/appdev/claudecode-rebuild/src/components/design-system/__tests__/BylineSource.test.ts)
  - [StatusIconSource.test.ts](/E:/appdev/claudecode-rebuild/src/components/design-system/__tests__/StatusIconSource.test.ts)
  - [PromptInputFooterSource.test.ts](/E:/appdev/claudecode-rebuild/src/components/PromptInput/__tests__/PromptInputFooterSource.test.ts)
  - [PromptInputFooterSuggestionsSource.test.ts](/E:/appdev/claudecode-rebuild/src/components/PromptInput/__tests__/PromptInputFooterSuggestionsSource.test.ts)
  - [SkillsMenuSource.test.ts](/E:/appdev/claudecode-rebuild/src/components/skills/__tests__/SkillsMenuSource.test.ts)
  - [truncate.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/truncate.test.ts)

Verification:

- `bun test src/utils/computerUse/win32/__tests__/windowMessage.test.ts src/utils/computerUse/__tests__/win32BoundClickSource.test.ts`
- `bun run build`
- `bun run lint`
- `bun test` (`272 pass / 0 fail`)

### Win32 UIA fallback coordinate alignment + whole-window screenshot fallback

- repaired
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so UIA-element fallback clicks no longer treat screen-space bounds as if
  they were already bound-window client coordinates
- added a small pure helper to convert screen-space element centers into
  bound-window client coordinates using both:
  - window origin
  - non-client offset
- used that helper in both bound-element click/focus fallback paths before
  `sendClick`
- extended
  [boundPointerPosition.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/boundPointerPosition.test.ts)
  and
  [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  to lock the corrected coordinate handling
- repaired
  [bridge.py](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/bridge.py)
  so `PrintWindow` fallback capture uses `GetWindowDC(hwnd)` instead of
  `GetDC(hwnd)`, aligning the fallback source with whole-window geometry
- added
  [win32BridgeSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32BridgeSource.test.ts)
  to lock that screenshot fallback path

Verification:

- `bun test src/utils/computerUse/__tests__/boundPointerPosition.test.ts src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts src/utils/computerUse/win32/__tests__/windowMessage.test.ts src/utils/computerUse/__tests__/win32BoundClickSource.test.ts src/utils/computerUse/__tests__/win32BridgeSource.test.ts`
- `bun run build`
- `bun run lint`
- `bun test` (`276 pass / 0 fail`)

### Win32 bound-wheel fallback correctness + move/resize contract hardening

- repaired
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so bound `mouseWheel(...)` only short-circuits when the Python bridge
  explicitly returns `true`; a bridge `false` now correctly falls through to
  the legacy fallback path instead of being treated as success
- extended
  [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  to lock the explicit-true short-circuit behavior
- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `window_management(move_resize)` now:
  - requires integer `x` and `y`
  - requires `width` and `height` to be provided together when resizing
  - rejects non-integer or non-positive `width/height`
  - no longer uses truthiness to decide whether resize text should be shown
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  to lock:
  - paired width/height enforcement
  - non-integer resize rejection
  - zero-dimension resize rejection

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`311 pass / 0 fail`)

### Win32 bound-wheel client-coordinate remap

- repaired
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so bound-window `mouseWheel(...)` no longer forwards screenshot/window
  coordinates as if they were already client-area coordinates
- aligned the wheel path with the existing bound click path by subtracting the
  cached non-client offset before dispatching to:
  - Python bridge `send_mouse_wheel`
  - PowerShell `sendMouseWheel(...)` fallback
- extended
  [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  to lock the client-coordinate remap before dispatch

Verification:

- `bun test src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`312 pass / 0 fail`)

### Source-first bridge permission parity + portable template-root materialization guard

- repaired
  [useCanUseTool.tsx](/E:/appdev/claudecode-rebuild/src/hooks/useCanUseTool.tsx)
  so source-first bridge permission forwarding now uses the same env-aware
  `isBridgeFeatureEnabled()` predicate already used by the rest of the bridge
  stack, instead of a raw compile-time `feature("BRIDGE_MODE")` check
- added
  [useCanUseToolSource.test.ts](/E:/appdev/claudecode-rebuild/src/hooks/__tests__/useCanUseToolSource.test.ts)
  to lock that source-first `FEATURE_BRIDGE_MODE=1` permission-forwarding seam
- tightened
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  so `Assert-NoReparsePoints` now rejects a reparse point on the root template
  path itself before scanning descendants
- extended
  [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  to lock rejection of junctioned/symlinked `runtime` or `node_modules` roots
  during `-RefreshDependencies`

Verification:

- `bun test src/__tests__/portableScripts.test.ts src/hooks/__tests__/useCanUseToolSource.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`314 pass / 0 fail`)

### `mouse_wheel` request validation hardening + Win32 single-key input-child remap

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `mouse_wheel` now:
  - requires `delta` to be a non-zero integer
  - rejects invalid `direction` values instead of silently treating them as vertical
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  to lock:
  - zero delta rejection
  - non-integer delta rejection
  - invalid direction rejection
- repaired
  [windowMessage.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/windowMessage.ts)
  so `sendChar()` and `sendKey()` now route through `resolveInputHwnd(...)`
  like the rest of the Win32 bound-input helpers
- extended
  [windowMessage.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/win32/__tests__/windowMessage.test.ts)
  with a source-level regression that locks the single-key remap seam

Verification:

- `bun test src/utils/computerUse/win32/__tests__/windowMessage.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`317 pass / 0 fail`)

### `bind_window` strict PID parsing

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `bind_window(pid=...)` now:
  - accepts only positive integer numeric PIDs
  - accepts only all-digit string PIDs
  - rejects malformed PID strings instead of truncating them with `parseInt(...)`
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  to lock rejection of malformed string PIDs like `"4242abc"`

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts src/utils/computerUse/win32/__tests__/windowMessage.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`318 pass / 0 fail`)

### portable/release destructive-target path preflight

- tightened
  [sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
  with a small canonical-path preflight that rejects unsafe destructive
  `PortableRoot` values before any prune or mirror step
- tightened
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1)
  with the same style of guard for `OutputRoot` before recursive release-stage
  cleanup
- extended
  [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)
  to lock both PowerShell scripts' destructive-directory guard presence

Verification:

- `bun test src/__tests__/portableScripts.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`319 pass / 0 fail`)

### `bind_window` strict HWND parsing

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `bind_window(hwnd=...)` now:
  - accepts only positive integer numeric HWND values
  - accepts only all-digit string HWND values
  - rejects malformed HWND strings and non-integer numeric HWND values instead of silently coercing them
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  to lock malformed string and float HWND rejection

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts src/__tests__/portableScripts.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`320 pass / 0 fail`)

### `mouse_wheel` horizontal success labeling

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so successful horizontal `mouse_wheel` calls now describe `left/right`
  instead of the misleading `up/down` wording that only fits vertical scroll
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with a focused regression for horizontal scroll success text

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`321 pass / 0 fail`)

### macOS TCC recheck success shape

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `request_access` / `request_teach_access` no longer return
  `isError: true` after the post-dialog macOS TCC recheck reports permissions
  are now granted
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with regressions that lock both request paths to a non-error result when the
  second `ensureOsPermissions()` call flips to granted

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`345 pass / 0 fail`)

### Win32 window-management post-action success

- tightened
  [win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts)
  so `minimize` / `maximize` / `restore` now verify the resulting window state,
  and `focus` / `move_offscreen` / `move_resize` now return explicit boolean
  success instead of treating any PowerShell output as success
- extended
  [win32WindowManagementSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/win32WindowManagementSource.test.ts)
  to lock the post-action state checks and truthy return paths in source

Verification:

- `bun test src/utils/computerUse/__tests__/win32WindowManagementSource.test.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`345 pass / 0 fail`)

### `key` / `hold_key` blank-sequence fail-closed

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `key` and `hold_key` now reject blank or whitespace-only `text` before
  reaching the executor
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with focused regressions that prove neither tool dispatches into runtime on
  an empty key sequence

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`347 pass / 0 fail`)

### `click_element` / `type_into_element` whitespace-only selectors

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so selector fields are trimmed before validation and whitespace-only values no
  longer count as a provided `name` / `role` / `automationId`
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with regressions that prove whitespace-only selector queries fail closed

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`349 pass / 0 fail`)

### `request_access` / `request_teach_access` blank reason guard

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so both permission request tools reject whitespace-only `reason` values before
  showing approval UI
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with regressions that prove blank reasons fail closed

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`351 pass / 0 fail`)

### `type` / `type_into_element` empty-text fail-closed

- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `type` and `type_into_element` reject empty-string text instead of
  reporting a misleading success after a no-op
- extended
  [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  with regressions that prove empty text is rejected before runtime dispatch

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`353 pass / 0 fail`)

### `status_indicator` runtime-failure truthfulness

- extended the `statusIndicator` executor result contract with an optional
  `ok` flag so runtime failures can be distinguished from a healthy inactive
  indicator
- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `status_indicator(status)` reports a `state_conflict` when state checks
  fail instead of claiming the indicator is inactive
- tightened the same path for `status_indicator(hide)` so runtime failures no
  longer masquerade as a successful hide
- updated
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  to return `{ active: false, ok: false }` from the indicator exception path
- extended regressions in:
  - [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  - [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
- `bun test src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`379 pass / 0 fail`)

### Finish-phase desktop-control and portable release hardening

- tightened
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
  so bound-window `drag()` without an explicit start coordinate still sends
  `mouseDown` from the current bound pointer before moving and releasing
- tightened
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
  so `prompt_respond(response_type="select")` rejects `arrow_count` values
  above the declared schema maximum of `50`
- tightened
  [build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1)
  so portable workspace package reparse points are dereferenced from the source
  repo package tree instead of from stale portable package sources
- extended regressions in:
  - [executorCrossPlatformSource.test.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts)
  - [toolCallsWindows.test.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts)
  - [portableScripts.test.ts](/E:/appdev/claudecode-rebuild/src/__tests__/portableScripts.test.ts)

Verification:

- `bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts src/utils/computerUse/__tests__/executorCrossPlatformSource.test.ts src/__tests__/portableScripts.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun test` (`383 pass / 0 fail`)
