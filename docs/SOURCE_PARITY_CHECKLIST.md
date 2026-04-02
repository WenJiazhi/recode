# Source Parity Checklist

This document tracks three things:

1. which major systems exist in the original `src`
2. how far the current `recode` repository has restored or verified them
3. which features were added by `recode` as secondary development work

Status labels:

- `completed`
- `partial`
- `pending`
- `gated`

## Core Module Parity

| Module | Original source scope | Status | Notes |
| --- | --- | --- | --- |
| CLI entry and startup | `main.tsx`, `entrypoints/*` | `completed` | `recode --help`, `--version`, and `-p` are verified |
| REPL screen and UI | `screens/REPL.tsx`, `components/*` | `partial` | starts and is interactive, but UI fidelity is still in progress |
| Query loop | `query.ts`, `QueryEngine.ts` | `partial` | main prompt loop works, deeper parity still needs audit |
| Slash command system | `commands.ts`, `commands/*` | `partial` | high-value paths are verified, including `/help`, `/status`, `/doctor`, `/files`, `/diff`, `/tasks`, `/model-map`, and restored built-in `/commit` registration; headless mode now reports built-in interactive-only commands accurately instead of mislabeling them as unknown skills |
| Tool system | `tools.ts`, `tools/*` | `partial` | core runtime tools load; LSP registration is restored, `recode` supports project-local `.recode/lsp.json` discovery in addition to plugin-declared servers, one real request path is verified when a working server exists, and `/doctor` + `/status` now surface live LSP health, but deeper paths remain gated |
| Settings and config | `utils/settings/*`, config helpers | `completed` | user settings read/write paths are active |
| Help, status, doctor | corresponding commands | `completed` | interactive and headless high-value paths are repaired and verified |
| MCP and plugins | `services/mcp/*`, `plugins/*` | `partial` | base list/help paths work, deeper lifecycle paths need more verification |
| Sessions and resume | storage and session commands | `partial` | source paths are present, full audit is still in progress |
| Permissions | hooks and UI | `partial` | basic chains run, advanced policy paths still need review |
| Remote and bridge | `bridge/*`, `remote/*` | `gated` | still largely feature-flagged |
| Voice, proactive, buddy, workflows | corresponding feature modules | `gated` | currently not opened in the active runtime path |

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
- `recode -p "/config"` -> interactive-only guidance message
- `recode -p "/model"` -> interactive-only guidance message
- built-in `/commit` appears in help and command registry again
- built-in `/commit-push-pr` appears in help and command registry again
- `recode -p "/model-map help"`
- `recode -p "/model-map status"`
- `recode auth status`
- `recode agents`
- `recode mcp --help`
- `recode mcp list`
- `recode plugin list`
- automated git worktree create / cleanup / dirty-change coverage via `src/utils/__tests__/worktree.test.ts`
- live LSP health reporting in headless `/doctor` and `/status`

## recode-Specific Additions

### 1. Branding and release cleanup

- executable name changed to `recode`
- version normalized to `0.0.1`
- primary theme accent changed to sky blue
- high-visibility product strings updated to `recode`

### 2. Bun packaging repair

- repaired the build output path so `dist/cli.js` starts cleanly under Bun

### 3. Headless slash-command repair

- stabilized `/help`
- stabilized `/status`
- stabilized `/doctor`
- added verified headless support for `/model-map help` and `/model-map status`

### 4. Custom `/v1/models` discovery and capability cache

- model discovery from custom `ANTHROPIC_BASE_URL`
- model list cache for external hosts
- capability cache for thinking and effort metadata

### 5. Project-local LSP config discovery

- added `.recode/lsp.json` as a project-local LSP server discovery path
- kept plugin-declared `lspServers` support intact
- added `.recode/lsp.example.json` as a local configuration example

### 6. Worktree verification hardening

- added automated git worktree create / cleanup / dirty-change regression coverage
- kept the original worktree implementation shape instead of rewriting the workflow around tests

### 7. LSP health visibility

- added live LSP config and manager status into `getDoctorDiagnostic()`
- surfaced that data in headless `/doctor` and `/status`
- kept the existing manager/config lifecycle intact instead of inventing a parallel diagnostics path

### 7. `/model-map`

This is a deliberate `recode` feature, not a straight upstream restore.

It keeps `/model` alias semantics intact while adding a separate guided mapping flow:

- configure `Opus`
- configure `Sonnet`
- configure `Haiku`
- for each alias, choose model first and thinking level second
- save all mappings together

### 8. Custom-host alias fallback

For custom API hosts, `recode` also builds best-effort fallback alias mappings for:

- `opus`
- `sonnet`
- `haiku`

That keeps alias resolution usable even before the user explicitly configures `/model-map`.
