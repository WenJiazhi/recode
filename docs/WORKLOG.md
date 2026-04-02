# Worklog

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

### Provider bootstrap alignment

- moved project-local provider loading forward into `src/entrypoints/cli.tsx` so `.recode/local-provider.json` is applied before the main startup flow
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
