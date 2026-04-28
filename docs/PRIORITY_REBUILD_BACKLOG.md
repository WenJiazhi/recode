# Priority Rebuild Backlog

This backlog is now the **post-CCB-alignment** queue. The large source-faithful
rebuild and the first 13 meaningful CCB slices are already merged, so the next
phase is about:

1. keeping the mainline honest and maintainable
2. hardening the newly opened runtime paths
3. only touching work that still has real daily coding value

Status labels:

- `ready`
- `in_progress`
- `partial`
- `external`

| Priority | Item | Status | Why it matters now | Key files | Smallest safe next step |
| --- | --- | --- | --- | --- | --- |
| P0 | Progress-table refresh and lint warning burn-down | `in_progress` | The runtime is green again, so the highest-value work is keeping the repo readable, the docs honest, and the warning floor low enough that new regressions stand out. | [README.md](/E:/appdev/claudecode-rebuild/README.md), [README.zh-CN.md](/E:/appdev/claudecode-rebuild/README.zh-CN.md), [docs/STATUS.md](/E:/appdev/claudecode-rebuild/docs/STATUS.md), [docs/SOURCE_PARITY_CHECKLIST.md](/E:/appdev/claudecode-rebuild/docs/SOURCE_PARITY_CHECKLIST.md), [docs/CCB_MERGE_PLAN.md](/E:/appdev/claudecode-rebuild/docs/CCB_MERGE_PLAN.md), [src/components](/E:/appdev/claudecode-rebuild/src/components), [src/hooks](/E:/appdev/claudecode-rebuild/src/hooks) | Keep clearing low-risk stale suppressions and top-level `biome-ignore-all` placement issues without touching runtime behavior. |
| P1 | Windows desktop-control hardening | `partial` | `computer-use` and `chrome-use` are no longer stubs. The highest-value remaining runtime work is the Windows terminal/window path: `open_terminal`, `request_access`, `bind_window`, and the outer desktop bridge. | [src/utils/computerUse/executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts), [src/utils/computerUse/windowsTerminalLaunch.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/windowsTerminalLaunch.ts), [src/utils/computerUse/platforms/win32.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/platforms/win32.ts), [packages/@ant/computer-use-mcp/src/toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts) | Keep hardening the in-repo Windows terminal/window chain and separate repo bugs from outer wrapper/runtime bugs. |
| P2 | Interactive review / commit / publish verification | `partial` | Prompt generation, shell expansion, and headless fallbacks are already covered. The remaining real value is deeper interactive verification without remote side effects. | [src/commands/review.ts](/E:/appdev/claudecode-rebuild/src/commands/review.ts), [src/commands/commit.ts](/E:/appdev/claudecode-rebuild/src/commands/commit.ts), [src/commands/commit-push-pr.ts](/E:/appdev/claudecode-rebuild/src/commands/commit-push-pr.ts), [src/utils/promptShellExecution.ts](/E:/appdev/claudecode-rebuild/src/utils/promptShellExecution.ts) | Keep verifying safe interactive flows against local-only git state. |
| P3 | Branch / worktree / session interactive parity | `partial` | The low-level lifecycle is now well covered. The next value is confidence in the user-facing interactive chain rather than more unit-level micro-tests. | [src/commands/branch/branch.ts](/E:/appdev/claudecode-rebuild/src/commands/branch/branch.ts), [src/utils/worktree.ts](/E:/appdev/claudecode-rebuild/src/utils/worktree.ts), [src/utils/sessionRestore.ts](/E:/appdev/claudecode-rebuild/src/utils/sessionRestore.ts) | Add only the smallest interactive-safe verification that proves the already-merged behavior holds end to end. |
| P4 | LSP daily-use polish | `partial` | LSP is no longer a black box. The architecture, recommendation path, diagnostics, and one real request chain are already in place. The remaining gap is smoother first-success setup. | [src/services/lsp/localConfig.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/localConfig.ts), [src/services/lsp/LSPServerManager.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/LSPServerManager.ts), [src/tools/LSPTool/messages.ts](/E:/appdev/claudecode-rebuild/src/tools/LSPTool/messages.ts), [src/utils/doctorDiagnostic.ts](/E:/appdev/claudecode-rebuild/src/utils/doctorDiagnostic.ts) | Keep tightening the first-success path without changing the manager architecture. |
| P5 | Lower-traffic brand and wording cleanup | `partial` | The high-traffic branding is already `recode`, but lower-traffic Anthropic/Claude wording still exists. This is worth doing only after the runtime and warning floor stay stable. | [src/components](/E:/appdev/claudecode-rebuild/src/components), [src/utils](/E:/appdev/claudecode-rebuild/src/utils), [docs](/E:/appdev/claudecode-rebuild/docs) | Continue only the low-risk text cleanup that does not reopen product logic. |
| P6 | Bundled `dist/cli.js` long-session stability | `partial` | The packaged build works, but the daily recommendation still favors source-first because Bun bundled long sessions can still be brittle. | [build.ts](/E:/appdev/claudecode-rebuild/build.ts), [src/entrypoints/cli.tsx](/E:/appdev/claudecode-rebuild/src/entrypoints/cli.tsx), [src/main.tsx](/E:/appdev/claudecode-rebuild/src/main.tsx) | Treat `dist` as verification-first until a clearly better long-session story exists. |

## Current Sprint Order

1. refresh the public progress tables and keep them honest
2. continue meaningful lint cleanup until warning noise is lower
3. harden the Windows desktop-control chain that was just opened
4. resume interactive-safe coding-loop verification where it still adds value
