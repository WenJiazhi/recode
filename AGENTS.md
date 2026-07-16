# Repository Guide

## Runtime

- Use Bun `1.3.14` or newer. The project is ESM and uses Bun workspaces.
- Keep `.js` specifiers in TypeScript imports unless a focused change proves
  they are incorrect; Bun resolves these to the source modules.
- Use `bun run dev` for normal development and `bun run build` to verify the
  single-file bundle.

## Architecture

- `src/entrypoints/cli.tsx` initializes configuration and routes CLI startup.
- `src/main.tsx` assembles commands, tools, plugins, MCP, LSP, and the REPL.
- `src/query.ts` owns one agent turn and tool-execution loop.
- `src/QueryEngine.ts` owns a multi-turn headless session.
- `src/tools.ts` and `src/commands.ts` are the central registries.

## Checks

Run these before opening a pull request:

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run check:docs
bun run test
bun run build
bun run test:smoke
```

Use `bun run test:single <path>` while iterating on one test file. The complete
test command isolates files in separate processes to prevent Bun module mocks
from leaking across files.

## Repository Rules

- Never commit `.recode/local-provider.json`, `.recode/api-key.txt`, `.env`,
  generated `dist/`, or `node_modules/`.
- Do not add private service endpoints, internal discussion links, credentials,
  or machine-specific absolute paths.
- Keep provider-specific behavior behind provider selection boundaries.
- Add tests for changes to permissions, shell execution, worktrees, provider
  conversion, or tool routing.
- Update `docs/development/roadmap.mdx` when a change materially affects the
  public product direction.
- Do not push or rewrite remote history unless the repository owner explicitly
  approves a release operation.
- Do not bulk-delete feature-gated or dynamically loaded modules from Knip
  output. Classify and verify each entry first.
