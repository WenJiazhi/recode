# Source Parity Checklist

This document tracks three things:

1. which major systems exist in the original `src` / base architecture
2. how far the current `recode` repository has restored or verified them
3. which remaining high-value gaps are still worth repairing

Status labels:

- `completed`
- `partial`
- `pending`
- `gated`

## Current Source Snapshot

These counts are from the current `recode` tree, not from an archived reference:

| Area | Current count |
| --- | ---: |
| `src/**/*.ts,tsx` files | `2850` |
| `src/commands/*` directories | `95` |
| `src/tools/*` directories | `55` |
| `src/services/*` directories | `24` |
| `src/components/*` directories | `32` |

## Structural Delta vs Archived Original `src`

The archived original source has now been re-extracted as a read-only reference.
At the directory-surface level, the current mainline is a superset rather than a
subset of that archive.

Shared top-level source directories are still aligned around the original coding
surfaces:

- `commands`
- `tools`
- `services`
- `components`
- `query`
- `screens`
- `remote`
- `bridge`
- `voice`

Current mainline also contains additional directories or command/tool groups that
do not represent missing original-source parity work by themselves:

- top-level extras: `daemon`, `environment-runner`, `jobs`, `proactive`, `self-hosted-runner`, `ssh`
- command-surface extras: `agents-platform`, `assistant`, `buddy`, `fork`, `model-map`, `peers`, `workflows`
- tool-surface extras: `DiscoverSkillsTool`, `MonitorTool`, `OverflowTestTool`, `ReviewArtifactTool`, `SendUserFileTool`, `SnipTool`, `SuggestBackgroundPRTool`, `TerminalCaptureTool`, `TungstenTool`, `VerifyPlanExecutionTool`, `WebBrowserTool`, `WorkflowTool`
- service-surface extras: `contextCollapse`, `sessionTranscript`, `skillSearch`

This matters because the repair feed should keep targeting:

1. shared original-source coding paths that still need parity work
2. deliberate `recode` additions already accepted as secondary-development items

It should not treat every extra directory in the current tree as source-parity debt.

Two command surfaces are also worth calling out explicitly:

- `/share`
- `/summary`

In the archived original source, both still resolve to stub placeholders rather
than full external-build command implementations. They should therefore stay out
of the main repair feed unless a fuller original-source implementation is later
recovered from a stronger reference.

## Core Module Parity

| Module | Original source/base scope | Status | What is working now | Main remaining gap |
| --- | --- | --- | --- | --- |
| CLI entry and startup | `main.tsx`, `entrypoints/*` | `completed` | `recode --help`, `--version`, `-p`, source-entrypoint launcher, external-cwd startup | bundled `dist/cli.js` still stays in verification role, not daily-use role |
| REPL screen and UI | `screens/REPL.tsx`, `components/*` | `partial` | REPL starts and is interactive | fidelity and lower-traffic screen polish still trail the original |
| Query loop | `query.ts`, `QueryEngine.ts` | `partial` | main prompt loop works | deeper parity still needs behavioral audit |
| Slash command system | `commands.ts`, `commands/*` | `partial` | high-value commands are verified; headless built-ins now fail fast cleanly instead of showing `Unknown skill` | more low-frequency commands still need route-by-route audit |
| Tool system | `tools.ts`, `tools/*` | `partial` | core tools load; LSP registration is restored; builtin ripgrep now resolves from external cwd; `/doctor` and `/status` expose live tool health | more direct tool error paths still need source-faithful tightening |
| Settings and config | `utils/settings/*`, config helpers | `completed` | settings read/write paths are active; `/config` no longer crashes | lower-frequency settings flows still need brand cleanup |
| Help, status, doctor | corresponding commands | `completed` | interactive and headless paths are repaired and verified | mostly polish and wording cleanup, not architecture gaps |
| MCP and plugins | `services/mcp/*`, `plugins/*` | `partial` | list/help/basic registry paths work; plugin-scoped LSP error rendering/guidance is now regression-tested | deeper lifecycle/health/install flows still need wider verification |
| Sessions and resume | storage and session commands | `partial` | session paths exist, resume hints work, and branch transcript forking now carries `forkedFrom` and `content-replacement` records under test | broader interactive audit still needed |
| Permissions | hooks and UI | `partial` | basic chains run, and dangerous auto/classifier permission stripping is now regression-tested for canonical wildcard rules and legacy `Task(...)` CLI spellings | advanced interactive policy/gating flows still need wider review |
| Branch / worktree / git workflow | `commands/branch/*`, `utils/worktree.ts`, git helpers | `partial` | create / cleanup / dirty detection / `.worktreeinclude` propagation are now regression-tested, `/branch` transcript forks now have coverage for resume hints and numbered title collision handling, named worktree keep/reuse behavior is now covered, and isolated agent worktree create/remove is now regression-tested without mutating the caller session state | more interactive flow verification is still needed |
| LSP runtime | `services/lsp/*`, `tools/LSPTool/*` | `partial` | local `.recode/lsp.json`, example config, plugin recommendations, direct failure hints, launcher diagnostics, health summaries, local-config aggregation into the total server set, recommendation filtering/order behavior, quickstart/error diagnostic summaries, manager routing/lazy-start behavior for project-local servers, and one end-to-end local server path (start -> didOpen -> definition request) are all wired and regression-tested | first-class daily-use setup still depends on at least one real local server being present |
| Remote and bridge | `bridge/*`, `remote/*` | `partial` | bridge source-first gate/default alignment is complete, `/remote-control` fallback routing is verified, and the core repo-level terminal/window chain has repo-level smoke coverage on Windows | deeper live desktop/runtime integration still depends on wrapper/runtime layers outside this repo |
| Voice, computer-use, chrome-use | corresponding feature modules | `partial` | voice gate/default alignment is complete, `/voice` and `/chrome` route cleanly, and the computer-use/chrome-use runtime packages are no longer stubs | deeper live device/browser integration still depends on local environment and outer wrappers |
| Proactive, buddy, workflows | corresponding feature modules | `gated` | code is present | still intentionally gated because they are not current daily coding priorities |

## Verified Usable Paths

- `recode --help`
- `recode --version`
- `recode -p "<prompt>"`
- `recode -p "/help"`
- `recode -p "/status"`
- `recode -p "/doctor"`
- `recode -p "/files"`
- `recode -p "/diff"`
- `recode -p "/tasks"`
- `recode -p "/context"`
- `recode -p "/cost"`
- `recode -p "/resume"` -> interactive-only guidance message
- `recode -p "/continue"` -> interactive-only guidance message
- `recode -p "/session"` -> interactive-only guidance message
- `recode -p "/remote"` -> interactive-only guidance message
- `recode -p "/permissions"` -> interactive-only guidance message
- `recode -p "/allowed-tools"` -> interactive-only guidance message
- `recode -p "/config"` -> interactive-only guidance message
- `recode -p "/model"` -> interactive-only guidance message
- `recode -p "/init"` -> interactive-only guidance message
- `recode -p "/compact"` -> interactive-only guidance message
- `recode -p "/branch"` -> interactive-only guidance message
- `recode -p "/files"` -> `No files in context` / relative file list summary
- `recode -p "/diff"` -> non-git, clean-tree, and per-file headless summaries
- `recode -p "/tasks"` -> empty-task and ordered task summaries
- `recode -p "/commit"` -> interactive-only guidance message
- `recode -p "/review"` -> interactive-only guidance message
- `recode -p "/commit-push-pr"` -> interactive-only guidance message
- built-in `/commit` appears in help and command registry again
- built-in `/commit-push-pr` appears in help and command registry again
- `recode -p "/model-map help"`
- `recode -p "/model-map status"`
- `recode -p "/model-map context 258k"`
- `recode auth status`
- `recode agents`
- `recode mcp --help`
- `recode mcp list`
- `recode plugin list`
- automated git worktree create / cleanup / dirty-change coverage via [worktree.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/worktree.test.ts)
- automated `.worktreeinclude` propagation coverage via [worktree.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/worktree.test.ts)
- regression-tested `/branch` title collision handling for `Branch / Branch 2 / Branch 3`
- regression-tested isolated `createAgentWorktree()` / `removeAgentWorktree()` lifecycle without mutating the caller session
- live LSP health reporting in headless `/doctor` and `/status`
- direct LSP failure messages now surface invalid local config, matching plugins, and missing configured local launchers
- regression-tested official-first LSP plugin recommendation ordering plus installed-plugin / binary / never-list / ignore-threshold filtering
- regression-tested LSP diagnostic summary quickstart hints and invalid-local-config reporting
- regression-tested core headless output paths for `/files`, `/diff`, and `/tasks`
- builtin ripgrep vendor fallback now works when launched from directories outside the repository root

## High-Value Issue Harvest

This is the refreshed issue list to keep using as the mainline repair feed after
the first CCB merge wave and the mainline stabilization pass.

| Priority | Issue | Why it matters | Current evidence | Next safe action |
| --- | --- | --- | --- | --- |
| P0 | Windows desktop-control hardening | this is now the highest-value runtime gap after computer-use/chrome-use alignment | in-repo `open_terminal`, terminal `request_access`, and `bind_window` smokes now work; remaining friction is in deeper outer integration | keep hardening the in-repo terminal/window chain and separate repo bugs from outer-wrapper bugs |
| P1 | interactive `review / commit / commit-push-pr` verification | these are still core coding/publishing loops | headless fallbacks are correct, shared shell prompt expansion is covered, and command-level prompt generation is covered, but interactive execution still lacks systematic verification without side effects | verify prompt/tool flow against local-only git state without touching remotes |
| P2 | branch/worktree interactive parity | worktrees are still central to safe parallel coding | low-level create/cleanup/dirty/include logic, transcript forking, keep/reuse, agent worktree lifecycle, and restore continuity are covered, but broader interactive flows remain less verified | add more interactive-safe verification around branch creation and worktree flows |
| P3 | first-class local LSP daily-use setup | LSP remains one of the biggest coding multipliers | diagnostics, routing, recommendation filtering, and one real request path are all in place, but daily success still depends on a real local server being installed | keep tightening the first-success local-server path without changing the manager architecture |
| P4 | MCP / plugin deeper lifecycle verification | plugin/LSP/MCP remain coding-adjacent core surfaces | list/help paths are fine and plugin LSP error rendering is regression-tested, but deeper lifecycle/install/reporting states are still less verified | verify health/install/error-reporting paths without changing plugin architecture |
| P5 | lower-traffic brand, wording, and warning cleanup | not architecture-critical, but still user-facing and maintainability-relevant | some lower-frequency Anthropic/Claude wording and stale lint suppressions still remain | keep cleaning only the low-risk surfaces after P0-P4 stay stable |

## recode-Specific Additions

Only the deliberate `recode` secondary-development items belong here. These are
not counted as source-parity work.

### 1. Project-local provider routing

- `.recode/local-provider.json`
- `.recode/api-key.txt`
- local CPA/provider selection without depending on global system state

### 2. Custom `/v1/models` discovery and capability cache

- model discovery from custom `ANTHROPIC_BASE_URL`
- model capability cache for external hosts
- thinking / effort metadata support for custom hosts

### 3. `/model-map`

This is a deliberate `recode` feature, not a straight upstream restore.

It keeps `/model` alias semantics intact while adding a separate guided mapping flow:

- configure `Opus`
- configure `Sonnet`
- configure `Haiku`
- for each alias, choose model first and thinking level second
- save all mappings together

### 4. Custom-host alias fallback

For custom API hosts, `recode` also builds best-effort fallback alias mappings for:

- `opus`
- `sonnet`
- `haiku`

### 5. Portable runtime support

- portable sync scripts
- portable provider config preservation
- portable builtin ripgrep fallback
