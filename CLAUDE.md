# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a reverse-engineered / decompiled rebuild of Claude Code CLI maintained as `recode`. Prioritize restoring runtime behavior over cleaning up decompilation fallout.

Important constraints:
- The runtime is **Bun**, not Node. The repo is ESM + TSX and uses Bun workspaces.
- The codebase still contains many decompilation-related TypeScript issues; do not treat global type cleanup as a prerequisite for feature work.
- `feature()` is polyfilled to always return `false` in `src/entrypoints/cli.tsx`, so many Anthropic-internal branches are present in source but dead in this rebuild.
- Many imports intentionally use `.js` specifiers from `.ts/.tsx` sources. Do not mechanically rewrite them.

## Commands

```bash
# Install dependencies
bun install

# Run the CLI directly from source
bun run dev
# equivalent to: bun run src/entrypoints/cli.tsx

# Preferred local launcher on Windows (source-first, dist fallback)
./recode.cmd

# Pipe / non-interactive mode example
echo "say hello" | bun run src/entrypoints/cli.tsx -p

# Smoke-test headless command routing
bun run src/entrypoints/cli.tsx -p "/status"
bun run src/entrypoints/cli.tsx -p "/doctor"

# Build the distributable CLI bundle
bun run build

# Run the built bundle (mainly a build verification path)
bun run start
bun ./dist/cli.js --help

# Lint / format (Biome is configured primarily for src/)
bun run lint
bun run lint:fix
bun run format

# Run the full test suite configured for this repo
bun run test

# Run a single test file directly with Bun
bun test src/__tests__/commandOrdering.test.ts
bun test src/tools/LSPTool/__tests__/messages.test.ts
bun test packages/color-diff-napi/src/__tests__/color-diff.test.ts

# Detect unused files / exports / deps
bun run check:unused

# Aggregate health report (lint + tests + knip + build)
bun run health

# Docs preview for the Mintlify docs site
bun run docs:dev
```

## Architecture

### Runtime and bootstrap

- `src/entrypoints/cli.tsx` is the true bootstrap router. It:
  - defines the local `feature()` polyfill,
  - seeds `MACRO`, `BUILD_TARGET`, `BUILD_ENV`, and `INTERFACE_TYPE`,
  - applies project-local provider config before the main startup flow,
  - redirects plugin cache to `~/.recode/plugins` unless overridden,
  - handles fast-path flags before importing the full CLI.
- `src/main.tsx` is the main CLI entry after bootstrap. It has important top-level side effects before `main()` runs, then sets up Commander commands, config/trust flow, bundled plugin + bundled skill initialization, MCP/LSP/plugin initialization, and launches the REPL or headless path.
- `src/entrypoints/init.ts` is the main runtime initializer for config loading, safe env injection, CA certs, proxy/mTLS setup, graceful shutdown, telemetry scaffolding, scratchpad setup, and Windows shell configuration.
- `build.ts` bundles `src/entrypoints/cli.tsx` into a single-file Bun target with `splitting: false`, then patches `import.meta.require` in `dist/*.js` for Node-compatible packaged execution.

### Conversation execution

- `src/query.ts` is the core turn loop. It is not a thin API wrapper; it handles:
  - message preparation,
  - compact / microcompact / recovery paths,
  - streaming model responses,
  - tool-use detection and execution,
  - attachment and memory injection,
  - slash-command queueing / lifecycle integration,
  - continuation / retry behavior.
- `src/QueryEngine.ts` owns a conversation across turns for the headless / SDK path. It persists message history, usage, file-read cache, permission denials, and turn-scoped state around `query()`.
- `src/services/api/claude.ts` assembles the final provider request, tool schemas, beta headers, model-specific behavior, and streaming event handling. Provider selection flows through `src/utils/model/providers.ts`.

### Commands, skills, tools, and plugins

- `src/commands.ts` is the authoritative slash-command assembly layer.
  - `COMMANDS()` defines built-in commands.
  - `getCommands(cwd)` merges built-ins with bundled skills, built-in plugin skills, filesystem skills, plugin commands, plugin skills, workflow commands, and dynamic skills.
- `src/tools.ts` is the built-in tool registry.
  - `getAllBaseTools()` defines the built-in tool universe.
  - `getTools()` applies mode and permission filtering.
  - `assembleToolPool()` is the authoritative merge point for built-in tools plus MCP tools.
- Built-in plugin and bundled skill initialization order matters. `src/main.tsx` initializes them before command loading; if command availability looks wrong, inspect startup ordering before editing command code.
- LSP support still exists in this rebuild, but the LSP tool is runtime-gated: the manager must initialize and at least one server must connect before the tool becomes usable.

### Context and system prompt assembly

- `src/context.ts` builds two cached context objects:
  - **system context**: git snapshot / cache-breaker data,
  - **user context**: discovered `CLAUDE.md` content plus current date.
- `src/utils/claudemd.ts` is the authoritative loader for repo guidance. It handles hierarchical `CLAUDE.md` discovery, `.claude/CLAUDE.md`, `.claude/rules/*.md`, `CLAUDE.local.md`, `@include`, injected memory files, deduplication, and priority ordering between managed/user/project/local instructions.
- `src/utils/systemPrompt.ts` composes the effective system prompt from override, coordinator, agent, custom, default, and append-only layers.
- The final request payload is assembled in `src/query.ts` right before the model call by combining the effective system prompt with `appendSystemContext(...)` and `prependUserContext(...)`.

### State and UI layers

- Session-global state and caches live in `src/bootstrap/state.ts`.
- App / REPL state is managed under `src/state/*` and fed into the Ink UI.
- The terminal UI is Ink-based; REPL behavior, permission prompts, and tool rendering depend on the app state assembled in `main.tsx` and the tool pool assembled in `src/tools.ts`.

## Useful repository docs

- `README.md` - current project positioning, verified command surface, preferred daily workflow, and the distinction between the source launcher and build-verification bundle.
- `docs/STATUS.md` - current verification snapshot.
- `docs/COMMAND_TOOL_AUDIT.md` - verified command/tool coverage.
- `docs/PRIORITY_REBUILD_BACKLOG.md` - prioritized rebuild order.
- `docs/WORKLOG.md` - implementation log for repaired paths.
- `.recode/lsp.example.json` - example local LSP server configuration.

## Repo-specific pitfalls

- Do not try to “fix the repo” by removing all decompilation artifacts. Many noisy type issues are non-blocking at runtime.
- Do not assume source presence means runtime reachability. Because `feature()` always returns `false`, many feature-gated paths are dead code in this rebuild.
- Do not rewrite `.js` import specifiers to `.ts`; they are intentional in this Bun/ESM setup.
- Top-level side effects matter in this repo. `src/entrypoints/cli.tsx`, `src/main.tsx`, and `src/entrypoints/init.ts` all do meaningful work during module evaluation.
- `build.ts` is part of the runtime contract, not just packaging glue: it disables Bun splitting and patches `import.meta.require` in the emitted bundle.
- Prefer the source entrypoint (`bun run dev` / `./recode.cmd`) for normal local sessions; `dist/cli.js` is primarily a build-verification artifact and can still diverge in long interactive runs.
- Biome is configured selectively: `bun run lint` targets `src/`, and formatting is disabled for `scripts/**`, `packages/**`, and JS-family files by config.
- Memoization is used heavily in command loading, context loading, and plugin / skill discovery. If behavior looks stale, inspect cache boundaries before assuming the business logic is wrong.
- `--bare` disables most automatic discovery, but explicit inputs such as added directories still flow through several loaders.
- Built-in tools/commands and MCP-provided tools/skills are merged later than many call sites suggest; absence from a built-in registry does not necessarily mean the capability is unavailable.
- Project-local runtime config lives under `.recode/`, especially `.recode/local-provider.json`, `.recode/api-key.txt`, and `.recode/lsp.json`.
