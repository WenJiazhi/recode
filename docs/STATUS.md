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
- `recode -p "/files"`: `completed`
- `recode -p "/diff"`: `completed`
- `recode -p "/tasks"`: `completed`
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

## Usable Right Now

- CLI startup
- base REPL
- high-value headless slash commands
- `/files` in headless mode
- `/diff` in headless mode
- `/tasks` in headless mode
- accurate non-interactive fallback messages for interactive-only commands such as `/config` and `/model`
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
- built-in `/commit`
- built-in `/commit-push-pr`
- `recode --resume` and resume hints
- source-entrypoint launcher for stable long-running local sessions
- portable runtime under `Portable/recode-portable`
- portable CPA config carried in the local `.recode` folder
- portable built-in ripgrep fallback via SDK vendor assets

## Still In Progress

- UI fidelity versus the original interactive experience
- real LSP end-to-end usability still depends on at least one discoverable LSP server config; current runtime initializes the manager successfully but loads `0` servers
- deeper brand cleanup in lower-traffic flows
- a small number of nonessential first-party analytics/metrics probes still assume Anthropic endpoints
- more advanced feature-flagged runtime paths
- Bun bundled `dist/cli.js` can still crash on very long interactive sessions, so it is currently treated as a verification path instead of the recommended daily-use launcher
- `E:\recode-portable` still exists outside the repository root because another process is currently holding the directory open; the repository now uses `Portable/recode-portable` as the canonical local portable copy
