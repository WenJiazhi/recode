# Status

Current version: `0.0.1`

## Current Mainline Snapshot

| Item | State |
| --- | --- |
| `bun test` | `383 pass / 0 fail` |
| `bun run build` | `completed` |
| `bun run lint` | `completed` |
| lint warning floor | `clean / 0 blocking errors` |
| CCB alignment items | `16 / 16 completed` |
| auto mode on CPA / GPT-5 | `completed` |
| Windows computer-use terminal chain | `repo-level smoke completed` |
| Windows computer-use region screenshot routing | `completed` |
| Windows multi-monitor origin correctness | `completed` |
| Windows child-HWND mouse coordinate remap | `completed` |
| Windows UIA fallback screen-to-client focus alignment | `completed` |
| Windows `PrintWindow` fallback whole-window DC capture | `completed` |
| OpenAI stream trailing-usage + `max_tokens` forwarding | `completed` |
| OpenAI deferred-tool filtering | `completed` |
| Deferred-tool OpenAI retry hint hardening | `completed` |
| Windows `open_terminal` invalid terminal arg rejection | `completed` |
| Portable install/uninstall runtime path fix | `completed` |
| Windows `prompt_respond` select arg validation | `completed` |
| Windows `virtual_keyboard` arg validation | `completed` |
| Windows `request_access` exact-name ambiguity handling | `completed` |
| Windows `virtual_mouse` / `mouse_wheel` coordinate validation alignment | `completed` |
| Portable release source-build freshness guard | `completed` |
| Windows `CuErrorKind` telemetry contract alignment | `completed` |
| Portable sync stale managed-directory cleanup | `completed` |
| Win32 `bindFile()` HWND cleanup before COM binding | `completed` |
| Portable installer runtime completeness guard | `completed` |
| Win32 `WM_CLOSE` post-check before unbinding | `completed` |
| Win32 `manageWindow(close)` now returns success only when the window actually closes | `completed` |
| Win32 bound-scroll wheel routing | `completed` |
| Win32 bound `mouseWheel` explicit-true bridge fallback | `completed` |
| Win32 bound `mouseWheel` client-coordinate remap | `completed` |
| Win32 `window_management(move_resize)` paired positive-integer sizing validation | `completed` |
| source-first `BRIDGE_MODE` interactive permission forwarding parity | `completed` |
| portable template root reparse-point guard during `-RefreshDependencies` | `completed` |
| `mouse_wheel` non-zero integer + direction validation | `completed` |
| Win32 single-key input-child remap for `sendChar` / `sendKey` | `completed` |
| `bind_window` strict PID parsing | `completed` |
| portable/release destructive-target path preflight guard | `completed` |
| `bind_window` strict HWND parsing | `completed` |
| `mouse_wheel` horizontal success labeling | `completed` |
| `open_terminal(agent='custom')` non-empty command guard | `completed` |
| `open_terminal` optional string fields now fail closed | `completed` |
| `activate_window` optional click coordinates now fail closed | `completed` |
| `virtual_keyboard` optional repeat/duration now fail closed | `completed` |
| `status_indicator(show)` message type now fails closed | `completed` |
| UIA bound-window `click_element` / `type_into_element` now resolve by `HWND` instead of window title | `completed` |
| Win32 `type_into_element` UIA fast path now maps `role -> controlType` | `completed` |
| portable release now copies README/example-config from repo root instead of portable root | `completed` |
| Win32 bound-window `virtualKeyboard()` now fails closed on unresolved or rejected key injection | `completed` |
| portable release now copies root-owned launcher/install scripts instead of generating inline variants | `completed` |
| `type_into_element` now rejects empty selector queries instead of allowing broad match fallback | `completed` |
| `virtual_keyboard` false results now report a truthful generic keyboard failure | `completed` |
| `prompt_respond(select)` now honors the executor/schema default `arrow_count=1` when omitted | `completed` |
| Win32 single-letter keydown/up paths now use uppercase virtual-key codes and no longer swallow bound-key dispatch failures | `completed` |
| `virtual_keyboard` non-type actions now reject blank text before runtime dispatch | `completed` |
| cross-platform `holdKey()` now releases already-pressed keys on failure | `completed` |
| macOS TCC recheck success no longer returns failure-shaped `request_access` / `request_teach_access` results | `completed` |
| Win32 `window_management` minimize/maximize/restore/focus/move_offscreen now validate post-action success instead of treating any PowerShell output as success | `completed` |
| `key` / `hold_key` now reject blank key sequences before runtime dispatch | `completed` |
| `click_element` / `type_into_element` now reject whitespace-only selector queries | `completed` |
| `request_access` / `request_teach_access` now reject blank reasons before opening approval UI | `completed` |
| `type` / `type_into_element` now reject empty text before runtime dispatch | `completed` |
| `prompt_respond(type)` now rejects empty text before runtime dispatch | `completed` |
| Win32 `status_indicator` now reports the live indicator process state | `completed` |
| Win32 bound-window `virtualMouse()` now fails closed on rejected `SendMessage` actions | `completed` |
| Win32 `respondToPrompt()` now fails closed on rejected key/text injection | `completed` |
| Win32 `activateWindow()` and bound UIA fallback clicks now fail closed on rejected focus clicks | `completed` |
| Win32 bound `mouseDown()` / `mouseUp()` / `drag()` now fail closed on rejected `SendMessage` actions | `completed` |
| Win32 platform-layer bound `click()` now fails closed on rejected `sendClick(...)` | `completed` |
| `window_management(get_rect)` now points to `open_application` or `bind_window` when nothing is bound | `completed` |
| `click_element` runtime-false feedback now stays truthful about missing/non-actionable elements vs. bound-input failure | `completed` |
| `type_into_element` runtime-false feedback now stays truthful about missing/non-editable elements vs. bound-input failure | `completed` |
| `status_indicator(status)` no longer overclaims active state ownership of the bound window | `completed` |
| `status_indicator(status/hide)` now reports runtime indicator failures instead of inactive/hidden false success | `completed` |
| `cursor_position` now treats screenshot right/bottom edges as off-display instead of returning out-of-range image pixels | `completed` |
| Win32 bound `drag()` without an explicit start coordinate now still sends `mouseDown` from the current bound pointer | `completed` |
| `prompt_respond(select)` now enforces the declared `arrow_count <= 50` schema maximum | `completed` |
| portable release now dereferences portable workspace package links from the source repo package tree | `completed` |
| portable sync now warns when manifests changed but runtime/node_modules/dependency stamp were intentionally preserved | `completed` |
| portable sync preserved-state output now explicitly names `node_modules/` and `.portable-deps-stamp.json` | `completed` |
| portable release now fails fast on stale dependency base before rebuilding `dist` | `completed` |
| Win32 bound legacy scroll fallback now verifies standard scrollbar movement when observable instead of treating every successful PowerShell launch as a successful scroll | `completed` |
| runtime-false Windows `virtual_mouse` / `virtual_keyboard` / `mouse_wheel` / `status_indicator(show|hide)` / `activate_window` / `prompt_respond` / `window_management` now classify as `state_conflict` instead of `bad_args` | `completed` |
| portable sync stale-dependency warning now also triggers when preserved `runtime/` or `node_modules/` are missing | `completed` |
| cross-platform `holdKey()` now rethrows cleanup failures after releasing all pressed keys instead of swallowing stuck-key cleanup errors | `completed` |
| macOS installed-app bundle ID correctness | `completed` |
| Current finish phase | `review-driven hardening` |

## Current Finish-Phase Focus

- keep the current mainline publishable and trustworthy
- continue only source-faithful hardening slices
- treat new OG recovery work as a controlled queue, not default merge debt

## Current Hotspots To Protect

These are the main areas that still need discipline, not broad rewrites:

1. [packages/@ant/computer-use-mcp/src/toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
   - central dispatch hotspot
   - only take localized correctness fixes here
2. [src/utils/computerUse/executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
   - keep this as glue, not a second Win32 control center
3. feature gate/default helper proliferation
   - prefer domain consolidation over adding new one-flag helper files
4. portable/release scripts
   - enforce release correctness, but avoid creating a second launcher/install truth

## Current Verification Snapshot

- `bun run build`: `completed`
- `bun test`: `completed`
- OpenAI-compatible streaming now carries trailing usage-only chunks into the final `message_delta` usage payload instead of dropping them: `completed`
- OpenAI-compatible `length` finishes now remain `max_tokens` even when partial tool calls were seen before truncation: `completed`
- OpenAI-compatible requests now explicitly forward `max_tokens` instead of relying on backend defaults: `completed`
- OpenAI-compatible requests now filter undiscovered deferred tools before schema generation instead of exposing unusable tool schemas: `completed`
- Deferred-tool validation failures now return a clearer OpenAI-compatible retry path via `ToolSearch("select:...")`: `completed`
- Windows `open_terminal` now rejects invalid `terminal` values instead of silently falling back to the default launcher order: `completed`
- Portable install/uninstall scripts now keep runtime and bundled Git paths rooted under `%PORTABLE_ROOT%\...` instead of generating malformed `portableRootruntime` paths: `completed`
- Windows `prompt_respond(select)` now rejects invalid `arrow_direction` and negative `arrow_count` values instead of silently navigating to the wrong item: `completed`
- Windows `virtual_keyboard` now rejects out-of-range `repeat` values and negative `duration` values instead of silently forwarding them into the executor: `completed`
- Windows `request_access` now fails closed on exact display-name collisions and returns executable/bundle-ID guidance instead of silently picking one installed app: `completed`
- Windows `virtual_mouse` and `mouse_wheel` now reuse the shared coordinate validator, and `mouse_wheel` rejects non-finite deltas instead of silently forwarding them into the executor: `completed`
- portable release packaging now rebuilds `dist` from the source repo before staging a release, so fresh dependency bases can no longer be zipped with stale repo output: `completed`
- the `computer-use` MCP telemetry contract now includes the emitted `launch_failed` and `element_not_found` error kinds, instead of letting runtime telemetry drift past the declared union: `completed`
- portable sync now removes stale managed directories when the source side deletes them, instead of silently preserving old content in the portable tree: `completed`
- Win32 `bindFile()` now clears an existing HWND binding through the shared unbind path before switching into COM-controlled file mode, so old borders/cursors/indicators are not left attached to the previous window: `completed`
- portable installers now refuse to mutate PATH when `runtime\bun.exe` is missing, and the generated release installer stays aligned with that fail-closed guard: `completed`
- Win32 `window_management(close)` now waits to see whether the window actually disappears before releasing the binding, so confirmation dialogs or ignored closes no longer silently drop the target: `completed`
- Win32 bound `mouseWheel(...)` now only short-circuits when the Python bridge explicitly returns `true`; a bridge `false` now correctly falls through to the legacy fallback instead of being misreported as success: `completed`
- Win32 bound `mouseWheel(...)` now converts bound window/screenshot coordinates into client coordinates before dispatching to the Python bridge or `sendMouseWheel(...)`, so wheel events no longer target the title bar or wrong child control in bound-window mode: `completed`
- Win32 `window_management(move_resize)` now enforces integer `x/y`, requires `width/height` to be provided together, and rejects non-integer or non-positive dimensions instead of silently degrading into a move-only or zero-size resize request: `completed`
- source-first `FEATURE_BRIDGE_MODE=1` sessions now forward ordinary interactive tool permission prompts through the same bridge callbacks as packaged builds, instead of silently falling back to local-only approvals in `useCanUseTool`: `completed`
- portable dependency refresh now rejects a junctioned/symlinked `PortableTemplateRoot\\runtime` or `PortableTemplateRoot\\node_modules` root before copying, instead of only checking descendant reparse points: `completed`
- `mouse_wheel` now enforces a non-zero integer `delta` and rejects invalid `direction` values instead of silently truncating floats or treating unknown directions as vertical: `completed`
- Win32 single-key dispatch now routes `sendChar` and `sendKey` through `resolveInputHwnd(...)`, so `Enter`, `Escape`, arrows, and single-key press/release/hold reach the real child input sink on WinUI/InputSite-style windows: `completed`
- `bind_window` now rejects malformed PID strings instead of truncating them with `parseInt(...)` and silently binding the wrong process window: `completed`
- portable sync/release PowerShell flows now reject unsafe destructive directory targets such as drive roots, source roots, and source-root ancestors before any recursive delete or mirror step: `completed`
- `bind_window` now rejects malformed HWND strings or non-integer numeric HWND values instead of silently coercing them into a different target window: `completed`
- `mouse_wheel(direction=\"horizontal\")` now reports `left/right` instead of the misleading `up/down` wording in successful user-visible output: `completed`
- `open_terminal(agent=\"custom\")` now rejects blank commands instead of forwarding an empty startup string into the terminal launcher: `completed`
- `open_terminal` now also rejects non-string optional `command` / `working_directory` values instead of silently ignoring them: `completed`
- `activate_window` now rejects malformed `click_x` / `click_y` values instead of silently dropping them and falling back to a center click: `completed`
- `activate_window` now also requires `click_x` and `click_y` to be provided together when overriding the focus click position: `completed`
- `virtual_keyboard` now rejects non-number `repeat` / `duration` values instead of silently defaulting to `repeat=1` or `duration=1s`: `completed`
- `status_indicator(show)` now rejects non-string `message` values instead of treating them as a missing message: `completed`
- bound-window `click_element` and `type_into_element` now fail closed on malformed selector fields instead of silently broadening the UIA query: `completed`
- Win32 bound-window UIA actions now resolve the root automation element directly from the bound `HWND` instead of re-finding a window by title, preventing mis-targeting when multiple windows share the same or a partially matching title: `completed`
- Win32 `type_into_element(name + role)` now maps `role` into the UIA `controlType` filter on the bound-window fast path instead of silently dropping it and broad-matching by `name` only: `completed`
- portable release packaging now copies `README*.md` and `.recode/*.example.json` directly from the source repo so stale portable-root docs/config templates cannot leak into a fresh release build: `completed`
- Win32 bound-window `virtualKeyboard()` now returns `false` when `sendText(...)`, `sendKeys(...)`, or individual key resolution/injection fails, instead of silently swallowing unknown keys or backend failures and reporting success: `completed`
- portable release packaging now copies `recode.*`, `configure-provider.*`, `install-portable.*`, and `uninstall-portable.*` directly from the source repo instead of generating inline script bodies inside `build-portable-release.ps1`: `completed`
- `type_into_element` now requires at least one of `name`, `role`, or `automationId` before entering the Win32 bound-window lookup path, so empty selector queries can no longer broad-match the first editable element in the accessibility tree: `completed`
- `virtual_keyboard` request failures no longer always blame missing binding; when the Win32 runtime rejects unknown keys or backend injection fails, the tool now returns a truthful generic keyboard-failure hint instead: `completed`
- `prompt_respond(response_type="select")` no longer rejects omitted `arrow_count`; request handling now matches the tool schema and executor fallback, so the simplest select-and-enter flow again works with the documented default count of `1`: `completed`
- Win32 single-letter `press` / `release` / `hold` paths now normalize single-character keys to uppercase virtual-key codes (`VK_A` style) instead of forwarding lowercase ASCII codes that can mis-map or no-op, and the bound `input.key()` path now throws on unsupported or failed key dispatch instead of silently succeeding: `completed`
- `virtual_keyboard` now rejects blank `text` for `press` / `release` / `combo` / `hold` before entering the runtime, instead of letting an empty sequence fall through to a generic injection failure: `completed`
- `executorCrossPlatform.holdKey()` now tracks already-pressed keys and releases them in reverse order from `finally`, so a mid-press or mid-release failure no longer leaves modifiers stuck down in the runtime path: `completed`
- `prompt_respond(response_type="type")` now rejects empty text before runtime dispatch instead of silently sending only Enter and claiming it typed text: `completed`
- `status_indicator(show)` / `hide` no longer turn runtime failure into success text, and `status_indicator(status)` now reports the live indicator-process state instead of guessing from bind state: `completed`
- Win32 bound-window `virtualMouse()` now fails closed when `sendClick(...)`, `sendMouseMove(...)`, `sendMouseDown(...)`, or `sendMouseUp(...)` reject the action instead of reporting success on dropped input messages: `completed`
- Win32 bound-window `respondToPrompt()` now fails closed when `sendChar(...)`, `sendKey(...)`, or `sendText(...)` reject the requested prompt action instead of reporting success on dropped prompt input: `completed`
- Win32 `activateWindow()` and the bound UIA fallback click paths in `clickElement()` / `typeIntoElement()` now fail closed when `sendClick(...)` rejects the focus click instead of reporting success on a dropped focus action: `completed`
- Win32 bound-window `mouseDown()` / `mouseUp()` / `drag()` now throw on rejected `sendMouseDown(...)`, `sendMouseMove(...)`, or `sendMouseUp(...)` results instead of silently succeeding through the void-return executor path: `completed`
- Win32 platform-layer bound `click()` now throws when `sendClick(...)` rejects the action instead of silently succeeding through the void-return `InputPlatform.click()` seam: `completed`
- `window_management(action="get_rect")` now points users to `open_application` or `bind_window` when nothing is currently bound instead of implying only the open-app path exists: `completed`
- bare `bun src/entrypoints/cli.tsx` vs packaged / `recode.cmd` auto-mode visibility still differs because `TRANSCRIPT_CLASSIFIER` remains launcher/build-owned by design; tracked as a guardrail, not patched in `cli.tsx`: `known / intentionally not hotfixed`
- Win32 bound-window generic scrolling now routes through the existing `mouseWheel(x, y, ...)` seam before falling back to the older legacy scroll path, so modern apps are not forced onto `WM_VSCROLL`/`WM_HSCROLL` first: `completed`
- macOS installed-app enumeration now uses real bundle identifiers instead of synthetic `com.app.*` placeholders: `completed`
- `recode --help`: `completed`
- `recode --version`: `completed`
- `recode -p "/help"`: `completed`
- `recode -p "/status"`: `completed`
- `recode -p "/doctor"`: `completed`
- `recode -p "/branch"` headless fallback message: `completed`
- `recode -p "/files"`: `completed`
- `recode -p "/diff"`: `completed`
- `recode -p "/tasks"`: `completed`
- `recode -p "/context"`: `completed`
- `recode -p "/compact"` headless fallback message: `completed`
- `recode -p "/init"` headless fallback message: `completed`
- `recode -p "/commit"` headless fallback message: `completed`
- `recode -p "/review"` headless fallback message: `completed`
- `recode -p "/commit-push-pr"` headless fallback message: `completed`
- `recode -p "/ultraplan"` headless fallback message: `completed`
- `recode -p "/voice"` headless fallback message: `completed`
- `recode -p "/chrome"` headless fallback message: `completed`
- `recode -p "/remote-control"` headless fallback message: `completed`
- `recode -p "/brief"` headless fallback message: `completed`
- `recode --computer-use-mcp` source entrypoint startup no longer crashes on a null MCP server stub: `completed`
- `dist/cli.js --computer-use-mcp` startup no longer crashes on a null MCP server stub: `completed`
- `@ant/claude-for-chrome-mcp` no longer exports a null stub server and empty browser-tool list: `completed`
- Win32 region screenshot routing now reaches Python bridge region methods and converts bound-window screen coordinates into window-local crop coordinates: `completed`
- cross-platform zoom now preserves the selected `displayId` when routing Win32 region screenshots: `completed`
- source-first and packaged `AWAY_SUMMARY` feature alignment: `completed`
- source-first and packaged `TOKEN_BUDGET` feature alignment: `completed`
- source-first and packaged `PROMPT_CACHE_BREAK_DETECTION` feature alignment: `completed`
- source-first and packaged `VERIFICATION_AGENT` feature alignment: `completed`
- `recode -p "/config"` headless fallback message: `completed`
- `recode -p "/model"` headless fallback message: `completed`
- `recode -p "/model-map help"`: `completed`
- `recode -p "/model-map status"`: `completed`
- `recode -p "/model-map context 258k"`: `completed`
- local provider config is applied in `cli.tsx` before the main startup flow: `completed`
- Anthropic-only MCP / passes / fast-mode prefetches are gated to first-party base URLs: `completed`
- headless GrowthBook initialization is gated to first-party base URLs: `completed`
- portable `recode doctor` reports `ripgrep: ok (builtin)`: `completed`
- source-entrypoint `recode doctor` now also reports `ripgrep: ok (builtin)` when launched from directories outside the repository root: `completed`
- built-in `/commit` appears in the command registry and help output again: `completed`
- built-in `/commit-push-pr` appears in the command registry and help output again: `completed`
- `recode --resume <id>` branding output: `completed`
- `/config` / settings screen no longer crashes with `Gates is not defined`: `completed`
- default `recode` launcher uses `src/entrypoints/cli.tsx` with `dist/cli.js` fallback: `completed`
- project-local `.recode/lsp.json` can initialize and serve one real LSP request when a valid server is available: `completed`
- `/doctor` and `/status` now surface live LSP config and manager health: `completed`
- direct LSP tool failures now point to `.recode/lsp.json` and `/doctor`: `completed`
- direct LSP no-server failures now append matching plugin-install recommendations when a suitable local binary is already installed: `completed`
- direct LSP no-server and manager-unavailable failures now also point out missing configured local server launchers from `.recode/lsp.json`: `completed`
- `/doctor` now reports the checked-in example LSP server command line and whether its launcher exists on the current machine: `completed`
- `/doctor` and `/status` now also report configured project-local LSP launcher availability when `.recode/lsp.json` is present: `completed`
- `/doctor` no longer reports stopped LSP instances as `active`; the state breakdown now distinguishes `running`, `stopped`, `starting/stopping`, and `error`: `completed`
- `/doctor` LSP diagnostics are regression-tested for example-server quickstart hints and invalid local-config error reporting: `completed`
- commit workflow shell-placeholder expansion is covered by an integration test using a real temporary git repo: `completed`
- `commit-push-pr` optional `gh pr view ... || true` shell probe is covered by an integration test and now locked to fail open instead of breaking prompt generation: `completed`
- `review` and `commit-push-pr` prompt generation are covered by command-level regression tests, including PR-number threading and additional user instructions: `completed`
- `commit` prompt generation is covered by a command-level regression test using a real temporary git repo, including git status / branch / log context expansion and shell-noise suppression: `completed`
- git worktree create / cleanup / dirty-change detection are covered by automated tests: `completed`
- `.worktreeinclude` copying for gitignored local files and collapsed ignored directories is covered by automated tests: `completed`
- `/context` no longer double-counts duplicate skill rows in the rendered skills table: `completed`
- non-interactive command ordering for `/branch`, `/commit`, `/review`, and `/commit-push-pr` is covered by automated tests: `completed`
- non-interactive command ordering for `/init` is covered by automated tests: `completed`
- non-interactive fallback routing for `/resume`, `/continue`, `/session`, `/remote`, `/permissions`, and `/allowed-tools` is covered by automated tests: `completed`
- `/files`, `/diff`, and `/tasks` headless outputs are now regression-tested for their core daily-use text paths: `completed`
- command registry no longer trips an early config-read exception when `/model` metadata is loaded before configs are enabled: `completed`
- external builds keep internal-only commands such as `/reset-limits` and `/version` out of the visible command set: `completed`
- branch title derivation is covered by automated tests (`deriveFirstPrompt` whitespace collapse, structured text extraction, truncation): `completed`
- `/branch` transcript forking is covered by an integration test that preserves `forkedFrom`, copied `content-replacement` records, and the `recode -r` resume hint: `completed`
- `/branch` title collision handling is covered by an integration test that preserves the original `Branch / Branch 2 / Branch 3` numbering behavior: `completed`
- `keepWorktree()` and same-slug worktree reuse are now covered by integration tests, including preserving the existing linked worktree on disk and reattaching to the same named worktree instead of recreating it: `completed`
- `createAgentWorktree()` / `removeAgentWorktree()` are now covered by integration tests, including preserving the caller's current session state while creating an isolated agent worktree and deleting the temporary branch on cleanup: `completed`
- restored worktree session continuity is now covered by regression tests, including re-entering a persisted worktree on resume, returning to the original cwd on exit, and safely ignoring stale missing worktree paths: `completed`
- restored worktree continuity now also covers fresh-session precedence and missing-original-cwd exit handling, so an already-active fresh worktree is not overwritten by stale transcript state and exit remains safe even when the original path is gone: `completed`
- dangerous permission stripping/restoration for auto/classifier mode is now regression-tested for canonical wildcard rules such as `Bash(*)`, `PowerShell(*)`, `Agent(*)`, and legacy `Task(...)` CLI rules, and in-memory removals now normalize rule strings before filtering so tool-wide wildcard forms round-trip correctly: `completed`
- invalid project-local `.recode/lsp.json` now shows explicit validation failure details in `/doctor` and `/status`: `completed`
- plugin-scoped LSP error formatting and operator guidance in `/plugin` are now regression-tested for start-failure, crash, timeout, and request-failure cases: `completed`
- project-local LSP config normalization and total-server aggregation are now regression-tested, including `scope: dynamic`, `source: project-local`, and inclusion in `getAllLspServers()`: `completed`
- `lspRecommendation` filtering and preference helpers are now regression-tested for official-first ordering, installed-plugin filtering, missing-binary filtering, never-suggest filtering, and ignore-threshold disabling: `completed`
- `LSPServerManager` routing for project-local servers is now regression-tested, including extension-based selection, invalid-config isolation, and one-time lazy start behavior: `completed`
- a project-local LSP server can now be started end-to-end in tests, open a real file, and answer a definition request through the manager path: `completed`
- `bun run lint`: `completed`
- CCB Item 1 (`OpenAI` adapter tool-calling compatibility): `completed`
- CCB Item 2 (GrowthBook local gate defaults for coding-critical P0/P1 gates): `completed`
- CCB Item 3 (project/local skill `[local]` labels in suggestions + Skills UI): `completed`
- CCB Item 4 (thin interview skill entry over the existing plan-interview runtime): `completed`
- CCB Item 5 (ultraplan gate/runtime alignment over the existing source implementation): `completed`
- CCB Item 6 (voice gate/runtime alignment over the existing source implementation): `completed`
- CCB Item 7 (bridge source-first feature-opt-in alignment over the existing source implementation): `completed`
- CCB Item 8 (computer-use / chrome-use alignment): `completed`
- CCB Item 9 (brief / `KAIROS_BRIEF` source-first + packaged alignment): `completed`
- CCB Item 10 (away-summary / `AWAY_SUMMARY` source-first + packaged alignment): `completed`
- CCB Item 11 (token-budget / `TOKEN_BUDGET` source-first + packaged alignment): `completed`
- CCB Item 12 (prompt-cache-break / `PROMPT_CACHE_BREAK_DETECTION` source-first + packaged alignment): `completed`
- CCB Item 13 (verification-agent / `VERIFICATION_AGENT` source-first + packaged alignment): `completed`
- CCB Item 14 (`AGENT_TRIGGERS`, `AGENT_TRIGGERS_REMOTE`, and `BUILTIN_EXPLORE_PLAN_AGENTS` source-first + packaged alignment): `completed`
- CCB Item 15 (`EXTRACT_MEMORIES` and `LODESTONE` source-first + packaged alignment): `completed`
- CCB Item 16 (`SHOT_STATS` source-first + packaged alignment): `completed`
- `recode -p "/loop"` source-first usage/help path: `completed`
- `recode auto-mode defaults`: `completed`
- `recode --permission-mode auto -p "hi"` on CPA/OpenAI GPT-5 routes: `completed`
- Windows `open_terminal` repo-level fallback chain (`wt -> PowerShell -> cmd`): `completed`
- Windows terminal `request_access` for `PowerShell` / `Command Prompt`: `completed`
- Windows `bind_window` list/bind/status repo-level smoke: `completed`
- Win32 child-HWND mouse message routing now remaps parent-client coordinates into child-client space before `WM_*BUTTON*`, `WM_MOUSEMOVE`, and `WM_MOUSEWHEEL` delivery: `completed`
- Win32 UIA fallback focus/type clicks now convert screen-space element bounds into bound-window client coordinates before `sendClick`: `completed`
- Win32 Python bridge `PrintWindow` fallback now captures from `GetWindowDC(hwnd)` so whole-window screenshots and crops stay spatially aligned when `BitBlt` is used: `completed`

## Usable Right Now

- CLI startup
- base REPL
- high-value headless slash commands
- `/context` in headless mode
- `/files` in headless mode
- `/diff` in headless mode
- `/tasks` in headless mode
- regression-tested daily-use headless outputs for `/files`, `/diff`, and `/tasks`
- accurate non-interactive fallback messages for interactive-only commands such as `/config` and `/model`
- accurate non-interactive fallback messages for interactive-only branching commands such as `/branch`
- accurate non-interactive fallback messaging for `/compact`
- accurate non-interactive fallback messaging for `/init`
- accurate non-interactive fallback messages for interactive-only publishing commands such as `/commit`, `/review`, and `/commit-push-pr`
- accurate non-interactive fallback messages for interactive-only cloud-planning commands such as `/ultraplan`
- accurate non-interactive fallback messages for interactive-only voice commands such as `/voice`
- accurate non-interactive fallback messages for interactive-only brief commands such as `/brief`
- accurate non-interactive fallback messages for interactive-only bridge commands such as `/remote-control` when bridge is explicitly opt-in enabled
- accurate non-interactive fallback messages for interactive-only continuity commands such as `/resume`, `/continue`, `/session`, `/remote`, `/permissions`, and `/allowed-tools`
- source-faithful shell expansion for the `/commit` prompt context (`git status`, `git branch`, `git log`) without spurious shell-reset noise when the project root is aligned
- source-faithful command-level prompt generation for `/commit`, including real repo git context and shell-noise suppression
- source-faithful shell expansion for the `/commit-push-pr` optional `gh pr view --json number 2>/dev/null || true` probe without breaking prompt generation
- source-faithful prompt generation for `/review` and `/commit-push-pr`, including local review wording and appended user instructions
- stable command-registry loading before config enablement, including `/model` metadata
- basic MCP, plugin, and agents command paths
- plugin LSP error formatting and guidance paths
- custom `/v1/models` model discovery
- `/model-map` alias mapping
- `/model-map` storage target selection between project config and legacy global settings
- `/model-map context <tokens|258k>` context-cap persistence
- CPA-style model suffix passthrough such as `gpt-5.4(high)`
- project-local portable provider config via `.recode/local-provider.json`
- project-local provider routing via `providerType` + `baseURL` in `.recode/local-provider.json`
- project-local persistence for `/model-map` and `/effort` when portable config is present
- live CPA chat requests using project-local provider config
- LSP tool registration in the base tool pool
- LSP manager initialization path
- project-local LSP server discovery through `.recode/lsp.json`
- regression-tested project-local LSP normalization and aggregation into the base server set
- regression-tested `LSPServerManager` extension routing and lazy-start behavior for project-local servers
- verified real LSP request/response flow when a working local server is available
- regression-tested end-to-end project-local LSP daily-use path (start -> didOpen -> definition request)
- live LSP config/manager health reporting in headless `/doctor` and `/status`
- explicit LSP local-config validation reporting when `.recode/lsp.json` exists but fails schema validation
- regression-tested `.recode/lsp.example.json` quickstart hints in `/doctor`
- clearer direct LSP failure guidance when no server is configured or the manager is unavailable
- plugin-aware LSP no-server guidance when a matching plugin can be enabled on the current machine
- regression-tested LSP plugin recommendation filtering and official-first ordering
- configured project-local LSP launcher visibility in `/doctor` and `/status`
- built-in `/commit`
- built-in `/commit-push-pr`
- automated git worktree create / cleanup / dirty-change coverage
- automated `.worktreeinclude` propagation coverage for worktree-local ignored files
- source-faithful `/branch` transcript forking with preserved content replacements and `recode -r` resume hint
- source-faithful `/branch` numbered-title collision handling (`Branch`, `Branch 2`, `Branch 3`)
- source-faithful worktree keep/reuse behavior for named git worktrees
- source-faithful agent worktree create/remove lifecycle without mutating the caller session
- source-faithful restored worktree resume/exit continuity
- source-faithful dangerous permission stripping/restoration across canonical and legacy rule spellings
- deduplicated skill rows in `/context` output
- `recode --resume` and resume hints
- source-entrypoint launcher for stable long-running local sessions
- source-first and packaged `KAIROS_BRIEF` feature alignment, including `--brief` CLI option visibility
- source-first and packaged `AWAY_SUMMARY` feature alignment, including the CCB-style unknown-focus idle fallback for terminals that do not expose focus tracking
- source-first and packaged `TOKEN_BUDGET` feature alignment across prompt, query, REPL, attachments, spinner, and prompt-input token-budget surfaces
- source-first and packaged `PROMPT_CACHE_BREAK_DETECTION` feature alignment across compact, auto-compact, API, and subagent cleanup surfaces
- source-first and packaged `VERIFICATION_AGENT` feature alignment across prompts, built-in agents, and todo/task completion guidance surfaces
- source-first and packaged `AGENT_TRIGGERS`, `AGENT_TRIGGERS_REMOTE`, and `BUILTIN_EXPLORE_PLAN_AGENTS` alignment across `/loop`, cron surfaces, bundled skills, and built-in explore/plan agent gating
- source-first and packaged `EXTRACT_MEMORIES` and `LODESTONE` alignment across memory extraction, background housekeeping, deep-link handling, and desktop deep-link settings surfaces
- auto mode on CPA/OpenAI GPT-5 routes, including `recode auto-mode defaults` and `--permission-mode auto`
- source-first and packaged `BRIDGE_MODE`, `VOICE_MODE`, `ULTRAPLAN`, `KAIROS_BRIEF`, `AWAY_SUMMARY`, `TOKEN_BUDGET`, `PROMPT_CACHE_BREAK_DETECTION`, and `VERIFICATION_AGENT` gate/default alignment
- Windows `open_terminal` fallback from `wt` to `PowerShell` to `cmd`
- Windows terminal `request_access` discovery for `Windows Terminal`, `PowerShell`, `Windows PowerShell`, and `Command Prompt`
- repo-level `bind_window` list/bind/status smoke for Windows terminal windows
- unresolved Windows `request_access` / `request_teach_access` requests now return actionable installed-app guidance and no longer fall through to the approval dialog path when no applications can be resolved, including the grant-flag edge case and mixed resolved/unresolved request shaping
- Windows app launch no longer snapshots visible HWNDs after `Start-Process`; newly launched windows are now detected against the true pre-launch baseline
- bound-window generic tools (`left_click`, `type`, `scroll`, `drag`, `left_mouse_down`, `left_mouse_up`) now stay on the standard handler path instead of silently auto-routing through `virtual_mouse` / `virtual_keyboard`
- Windows Python bridge lifecycle now invalidates dead bridge processes promptly, rejects pending requests on unexpected exit/stdout failure, and allows the next call to recreate the bridge cleanly
- Windows existing-window reuse now prefers exact process-name matches and strong title matches instead of raw title substring matches
- `/skills` now includes bundled skills in the interactive browser instead of filtering them out
- source-first `ULTRAPLAN` prompt trigger/highlight and exit-plan affordances now use the same feature helper path as the rest of the source-first alignment work
- bound-window `mouseDown()` / `mouseUp()` now resolve client coordinates from the latest bound-window pointer state (with a window-rect fallback) instead of relying only on the real desktop cursor
- portable runtime under `E:\appdev\recode-portable`
- portable CPA config carried in the local `.recode` folder
- portable built-in ripgrep fallback via SDK vendor assets
- cwd-independent built-in ripgrep fallback via SDK vendor assets
- normal portable sync preserves the documented `sync-portable.bat` entrypoint
- portable dependency refresh now rejects non-materialized junction/reparse-point templates
- portable release packaging now rejects stale portable dependency bases before building a zip by requiring a refreshed `.portable-deps-stamp.json`, failed dependency refreshes now clear any previously trusted stamp, and `-RefreshDependencies` now refuses stale `PortableTemplateRoot` manifests before copying dependencies
- shared line-number formatting again emits the intended `→` separator
- shared truncation helpers again emit a real ellipsis (`…`) instead of stitched garbage
- `/ultrareview` metadata is readable again
- the shared loading `StatusIcon` ellipsis glyph is restored and regression-tested
- the shared `Byline` and prompt-footer suggestion rows again use the intended ` · ` separator
- high-frequency Windows `computer-use` request/runtime strings no longer carry stitched mojibake in tier guidance, allowlist guidance, teach-mode retry text, clipboard denial text, bounds/dimension text, and drag/status messages
- Windows multi-monitor desktop origins now flow through display geometry and screenshot metadata correctly, so secondary-monitor actions no longer replay from `(0,0)`
- the active finish phase now treats large added hotspots as constrained zones instead of automatic extension points

## Still In Progress

- lower-traffic UI fidelity versus the original interactive experience
- real LSP daily use still depends on a working server process on the user's machine, even though local config, diagnostics, and one end-to-end request path are now verified
- deeper brand cleanup in lower-traffic flows
- a small number of nonessential first-party analytics/metrics probes still assume Anthropic endpoints
- Windows desktop-control issues can still exist in outer wrapper/runtime layers beyond this repo even though the in-repo terminal chain is now much healthier
- Bun bundled `dist/cli.js` can still crash on very long interactive sessions, so it is currently treated as a verification path instead of the recommended daily-use launcher
- `E:\recode-portable` still exists outside the repository root because another process is currently holding the directory open; the canonical local portable copy now lives at `E:\appdev\recode-portable`
- lint is now clean at the repo level; remaining desktop-control risk is in outer wrapper/runtime layers rather than the current repo code
- portable/release review is still in progress for any additional release-grade guards beyond sync-entry preservation, materialized dependency refresh, and stale-base rejection
- architecture/style review of non-OG additions is complete; remaining work is now constrained by hotspot guardrails rather than broad parity expansion
