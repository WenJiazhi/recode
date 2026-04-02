# Status

Current version: `0.0.1`

## Current Verification Snapshot

- `bun run build`: `completed`
- `bun test`: `completed`
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
- `recode -p "/commit"` no longer renders as a visually blank line when the result body is empty: `completed`
- `recode -p "/review"` headless fallback message: `completed`
- `recode -p "/commit-push-pr"` headless fallback message: `completed`
- `recode -p "/config"` headless fallback message: `completed`
- `recode -p "/model"` headless fallback message: `completed`
- `recode -p "/model-map help"`: `completed`
- `recode -p "/model-map status"`: `completed`
- `recode -p "/model-map context 258k"`: `completed`
- local provider config is applied in `cli.tsx` before the main startup flow: `completed`
- Anthropic-only MCP / passes / fast-mode prefetches are gated to first-party base URLs: `completed`
- headless GrowthBook initialization is gated to first-party base URLs: `completed`
- portable `recode doctor` reports `ripgrep: ok (builtin)`: `completed`
- built-in `/commit` appears in the command registry and help output again: `completed`
- built-in `/commit-push-pr` appears in the command registry and help output again: `completed`
- `recode --resume <id>` branding output: `completed`
- `/config` / settings screen no longer crashes with `Gates is not defined`: `completed`
- default `recode` launcher uses `src/entrypoints/cli.tsx` with `dist/cli.js` fallback: `completed`
- project-local `.recode/lsp.json` can initialize and serve one real LSP request when a valid server is available: `completed`
- `/doctor` and `/status` now surface live LSP config and manager health: `completed`
- direct LSP tool failures now point to `.recode/lsp.json` and `/doctor`: `completed`
- direct LSP no-server failures now append matching plugin-install recommendations when a suitable local binary is already installed: `completed`
- git worktree create / cleanup / dirty-change detection are covered by automated tests: `completed`
- `/context` no longer double-counts duplicate skill rows in the rendered skills table: `completed`
- `bun run lint`: `completed`

## Usable Right Now

- CLI startup
- base REPL
- high-value headless slash commands
- `/context` in headless mode
- `/files` in headless mode
- `/diff` in headless mode
- `/tasks` in headless mode
- accurate non-interactive fallback messages for interactive-only commands such as `/config` and `/model`
- accurate non-interactive fallback messages for interactive-only branching commands such as `/branch`
- accurate non-interactive fallback messages for interactive-only publishing commands such as `/review` and `/commit-push-pr`
- basic MCP, plugin, and agents command paths
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
- verified real LSP request/response flow when a working local server is available
- live LSP config/manager health reporting in headless `/doctor` and `/status`
- clearer direct LSP failure guidance when no server is configured or the manager is unavailable
- plugin-aware LSP no-server guidance when a matching plugin can be enabled on the current machine
- built-in `/commit`
- built-in `/commit-push-pr`
- automated git worktree create / cleanup / dirty-change coverage
- deduplicated skill rows in `/context` output
- `recode --resume` and resume hints
- source-entrypoint launcher for stable long-running local sessions
- portable runtime under `E:\appdev\recode-portable`
- portable CPA config carried in the local `.recode` folder
- portable built-in ripgrep fallback via SDK vendor assets

## Still In Progress

- UI fidelity versus the original interactive experience
- real LSP end-to-end usability still depends on at least one working server process on the user's machine, but the runtime now supports project-local `.recode/lsp.json` discovery, reports live health in `/doctor` and `/status`, and the request path has been verified against a working local server
- deeper brand cleanup in lower-traffic flows
- a small number of nonessential first-party analytics/metrics probes still assume Anthropic endpoints
- more advanced feature-flagged runtime paths
- Bun bundled `dist/cli.js` can still crash on very long interactive sessions, so it is currently treated as a verification path instead of the recommended daily-use launcher
- `E:\recode-portable` still exists outside the repository root because another process is currently holding the directory open; the canonical local portable copy now lives at `E:\appdev\recode-portable`
- lint warnings still exist across lower-value files, but the blocking lint error set has been cleared and CI no longer fails on `bun run lint`
