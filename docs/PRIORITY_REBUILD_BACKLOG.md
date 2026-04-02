# Priority Rebuild Backlog

This backlog is ordered from highest value to lowest value for `recode` as a
programming-first terminal tool. The ranking favors paths that are both:

1. close to the original source/base architecture
2. important in day-to-day coding workflows

Status labels:

- `ready`
- `in_progress`
- `partial`
- `gated`

| Priority | Item | Status | Why it matters | Key files | Smallest safe next step |
| --- | --- | --- | --- | --- | --- |
| P0 | Review and commit workflow verification | `in_progress` | `/review` and `/commit` are core coding loops. They affect PR review and safe publishing, so they need real verification instead of only source presence. | [src/commands/review.ts](/E:/appdev/claudecode-rebuild/src/commands/review.ts), [src/commands/commit.ts](/E:/appdev/claudecode-rebuild/src/commands/commit.ts), [src/utils/promptShellExecution.ts](/E:/appdev/claudecode-rebuild/src/utils/promptShellExecution.ts) | Built-in `/commit` registration is restored. Next verify prompt generation and safe shell expansion without producing an accidental commit. Then patch only if Windows/runtime behavior diverges. |
| P1 | Real LSP daily-use usability | `partial` | `LSP` is now registered again, project-local discovery works, one real request path has been verified, and `/doctor` + `/status` now show live config/manager health. The remaining gap is turning that into a predictable daily-use workflow. This is still one of the biggest programming-quality multipliers. | [src/tools.ts](/E:/appdev/claudecode-rebuild/src/tools.ts), [src/tools/LSPTool/LSPTool.ts](/E:/appdev/claudecode-rebuild/src/tools/LSPTool/LSPTool.ts), [src/services/lsp/manager.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/manager.ts), [src/services/lsp/config.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/config.ts), [src/services/lsp/localConfig.ts](/E:/appdev/claudecode-rebuild/src/services/lsp/localConfig.ts), [src/utils/doctorDiagnostic.ts](/E:/appdev/claudecode-rebuild/src/utils/doctorDiagnostic.ts) | Keep the current manager shape, improve discoverability, and surface clearer health around local `.recode/lsp.json` servers instead of reopening the architecture. |
| P2 | Branch/worktree/git workflow parity | `partial` | Branching, worktree isolation, diff review, and clean git context are part of the original coding UX and directly affect safe parallel development. | [src/commands/branch/index.ts](/E:/appdev/claudecode-rebuild/src/commands/branch/index.ts), [src/commands/branch/branch.ts](/E:/appdev/claudecode-rebuild/src/commands/branch/branch.ts), [src/utils/worktreeModeEnabled.ts](/E:/appdev/claudecode-rebuild/src/utils/worktreeModeEnabled.ts), [src/utils/worktree.ts](/E:/appdev/claudecode-rebuild/src/utils/worktree.ts), [src/utils/__tests__/worktree.test.ts](/E:/appdev/claudecode-rebuild/src/utils/__tests__/worktree.test.ts) | The real git worktree create / cleanup / dirty-detection path is now covered by tests. Next step is to validate more interactive branch/worktree flows without weakening safety. |
| P3 | Context inspection parity | `partial` | `/context` is a high-value debugging surface for prompt pressure, tools, MCP, agents, and memory usage. It helps explain model behavior in real coding sessions. | [src/commands/context/index.ts](/E:/appdev/claudecode-rebuild/src/commands/context/index.ts), [src/commands/context/context-noninteractive.ts](/E:/appdev/claudecode-rebuild/src/commands/context/context-noninteractive.ts), [src/utils/analyzeContext.ts](/E:/appdev/claudecode-rebuild/src/utils/analyzeContext.ts) | Verify headless `/context` output and then decide whether any token accounting or display section is broken. |
| P4 | Headless/local command routing parity | `in_progress` | Mislabeling built-in commands as `Unknown skill` makes automation and scripting feel broken. This is now partially repaired but still needs coverage review. | [src/utils/processUserInput/processSlashCommand.tsx](/E:/appdev/claudecode-rebuild/src/utils/processUserInput/processSlashCommand.tsx), [src/main.tsx](/E:/appdev/claudecode-rebuild/src/main.tsx), [src/types/command.ts](/E:/appdev/claudecode-rebuild/src/types/command.ts) | Audit other interactive-only built-ins and add either real non-interactive siblings or precise fallback messaging. |
| P5 | File/context/task daily-use commands | `partial` | `/files`, `/diff`, and `/tasks` are now usable in headless mode, but this group still needs broader regression coverage because they are now part of the everyday coding surface. | [src/commands/files/index.ts](/E:/appdev/claudecode-rebuild/src/commands/files/index.ts), [src/commands/diff/index.ts](/E:/appdev/claudecode-rebuild/src/commands/diff/index.ts), [src/commands/diff/diff-noninteractive.ts](/E:/appdev/claudecode-rebuild/src/commands/diff/diff-noninteractive.ts), [src/commands/tasks/index.ts](/E:/appdev/claudecode-rebuild/src/commands/tasks/index.ts), [src/commands/tasks/tasks-noninteractive.ts](/E:/appdev/claudecode-rebuild/src/commands/tasks/tasks-noninteractive.ts) | Keep these stable while the higher-value git/LSP work lands. |
| P6 | Permissions and tool gating consistency | `partial` | Coding quality depends on tools being available when they should be, and denied when they should be. Wrong gating creates silent capability regressions. | [src/tools.ts](/E:/appdev/claudecode-rebuild/src/tools.ts), [src/hooks/useCanUseTool.ts](/E:/appdev/claudecode-rebuild/src/hooks/useCanUseTool.ts), [src/utils/permissions](/E:/appdev/claudecode-rebuild/src/utils/permissions) | Recheck coding-critical tools after each repair instead of doing a large speculative permissions refactor. |
| P7 | Interactive UI fidelity | `partial` | Important, but lower than git/LSP/review/commit for now. The source tree is present; the main remaining work is UX fit-and-finish. | [src/screens/REPL.tsx](/E:/appdev/claudecode-rebuild/src/screens/REPL.tsx), [src/components](/E:/appdev/claudecode-rebuild/src/components) | Keep following source behavior and avoid cosmetic rewrites until higher-value programming flows are solid. |
| P8 | Remote/bridge/voice/workflows | `gated` | These are real source subsystems, but they are not the highest-value blockers for the programming-first rebuild. | [src/bridge](/E:/appdev/claudecode-rebuild/src/bridge), [src/remote](/E:/appdev/claudecode-rebuild/src/remote), [src/voice](/E:/appdev/claudecode-rebuild/src/voice) | Leave gated until the local coding loop is stable. |

## Current Sprint Order

1. `review / commit`
2. `LSP daily-use polish`
3. `branch / worktree`
4. `context`
5. remaining headless routing gaps
