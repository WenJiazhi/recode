# CCB Merge Plan

## Goal

Integrate high-value features from the current CCB mainline into `recode`
without hard-merging unrelated code. Every item must satisfy all of these:

- exists in the current CCB base
- is compatible with the original restored `src` architecture
- materially improves the daily coding workflow or unlocks an already-present
  source feature
- can be merged incrementally with tests/build kept green

## Current Snapshot

| Item | State |
| --- | --- |
| CCB merge items completed | `16 / 16` |
| Mainline tests | `266 pass / 0 fail` |
| Build | `completed` |
| Lint | `completed (clean / 0 blocking errors)` |
| Current phase | `post-merge finish-phase hardening and review-driven verification` |

## Post-Merge Remaining Work

The first meaningful CCB merge wave is done. The remaining work is no longer
"missing feature slices" except for a few low-priority defaults; it is mostly:

1. keep the progress tables and warning floor honest
2. harden the Windows desktop-control chain that was just opened
3. continue the remaining interactive-safe verification around the coding loop
4. keep lower-traffic brand cleanup incremental and low-risk

## Post-Merge Guardrails

The merge wave is complete. The main risk is no longer "missing CCB features";
it is allowing the stitched layers to grow past the original source style.

Current hotspot constraints:

1. keep [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts) limited to localized correctness fixes
2. keep [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts) as glue, not a Win32 policy hub
3. avoid further one-flag helper proliferation unless there is real shared value
4. avoid growing portable/release scripts into a second product/runtime definition

## Merge Order

| Order | Item | Current `recode` status | Current CCB delta | Merge policy |
| --- | --- | --- | --- | --- |
| 1 | OpenAI adapter tool-calling compatibility | `completed` | CCB adds JSON Schema `const -> enum` sanitation plus forces `stop_reason=tool_use` when tool calls are present | Merged as a controlled adapter graft |
| 2 | GrowthBook local gate defaults for P0/P1 | `completed` | CCB adds `LOCAL_GATE_DEFAULTS` fallback chain for selected coding-critical gates | Merged only for source-faithful P0/P1 coding surfaces |
| 3 | Project-local skill `[local]` label | `completed` | CCB adds yellow `[local]` labels in suggestions + skills UI for project/local scopes | Merged with minimal UI-only slice |
| 4 | Interview mode | `completed` | CCB adds a `.claude/skills/interview/SKILL.md` shim; our source already contains plan-interview runtime/UI | Completed as a thin entry-layer add only |
| 5 | Ultraplan alignment | `completed` | Our source already contains `/ultraplan`; CCB recently enabled more gates around it | Merged as a minimal gate/runtime wiring slice |
| 6 | Voice | `completed` | Source already existed; CCB mainly enables it through build-feature defaults | Merged as a minimal gate/default alignment slice |
| 7 | Bridge | `completed` | Source exists; CCB does not default-enable `BRIDGE_MODE`, so the real delta is explicit feature opt-in wiring for source-first runs | Merged as a minimal source-first feature-opt-in slice |
| 8 | Computer-use / Chrome-use | `completed` | Source exists; CCB defaults `CHICAGO_MCP` in build features and adds a cross-platform executor slice under `src/utils/computerUse/*` | Merged as a minimal `CHICAGO_MCP` gate/build alignment plus the self-contained cross-platform executor subtree |
| 9 | Brief / `KAIROS_BRIEF` | `completed` | Source exists; CCB defaults `KAIROS_BRIEF` and wires the existing brief runtime through that gate | Merged as a minimal gate/default alignment slice |
| 10 | Away summary / `AWAY_SUMMARY` | `completed` | Source exists; CCB defaults `AWAY_SUMMARY` and updates away detection for terminals that report unknown focus state | Merged as a minimal gate/default alignment slice plus the source-faithful unknown-focus idle fallback |
| 11 | Token budget / `TOKEN_BUDGET` | `completed` | Source exists; CCB defaults `TOKEN_BUDGET` in packaged builds and relies on the existing token-budget runtime surfaces | Merged as a minimal gate/default alignment slice |
| 12 | Prompt cache break detection / `PROMPT_CACHE_BREAK_DETECTION` | `completed` | Source exists; CCB defaults `PROMPT_CACHE_BREAK_DETECTION` in packaged builds and relies on the existing prompt-cache-break runtime surfaces | Merged as a minimal gate/default alignment slice |
| 13 | Verification agent / `VERIFICATION_AGENT` | `completed` | Source exists; CCB defaults `VERIFICATION_AGENT` in packaged builds and relies on the existing verification-agent runtime surfaces | Merged as a minimal gate/default alignment slice |
| 14 | Agent triggers / built-in explore-plan agents | `completed` | Source exists; CCB defaults `AGENT_TRIGGERS`, `AGENT_TRIGGERS_REMOTE`, and `BUILTIN_EXPLORE_PLAN_AGENTS`, while source-first `recode` previously kept `/loop` and explore/plan agent gating hidden behind compile-time-only checks | Merged as a minimal gate/default alignment slice for source-first and packaged runs |
| 15 | Extract memories / Lodestone | `completed` | Source exists; CCB defaults `EXTRACT_MEMORIES` and `LODESTONE`, while source-first `recode` previously kept memory-extraction and deep-link runtime behind compile-time-only checks | Merged as a minimal gate/default alignment slice for source-first and packaged runs |
| 16 | Shot stats | `completed` | Source exists; CCB defaults `SHOT_STATS`, while source-first `recode` previously kept the extended stats view behind compile-time-only checks | Merged as a minimal gate/default alignment slice for source-first and packaged runs |

## Current Evidence

### 1. OpenAI tool-calling compatibility

CCB commit:
- `e88dcb2 fix: OpenAI adapter tool calling compatibility`

CCB changed:
- `src/services/api/openai/convertTools.ts`
- `src/services/api/openai/streamAdapter.ts`
- tests for both

Observed delta:
- sanitize tool JSON Schema `const` -> `enum`
- force `tool_use` stop reason when `tool_calls` are present even if backend
  sends `finish_reason=stop`

Merged result:
- grafted `src/services/api/openai/*` from CCB as a minimal adapter subtree
- added provider routing for explicit `openai`
- branched `src/services/api/claude.ts` into the OpenAI adapter before Anthropic-only request shaping
- added permanent regression coverage for message conversion, tool conversion, model mapping, and stream adaptation

### 2. GrowthBook local gate defaults

CCB commit:
- `1b47333 feat: enable GrowthBook local gate defaults for P0/P1 features`

Observed delta:
- adds `LOCAL_GATE_DEFAULTS` in `src/services/analytics/growthbook.ts`
- inserts local defaults into getter fallback chain
- explicitly targets P0/P1 coding-related flags

Merged result:
- added `LOCAL_GATE_DEFAULTS` plus `CLAUDE_CODE_DISABLE_LOCAL_GATES` bypass
- wired local defaults into blocking and cached GrowthBook getter paths
- kept the slice limited to coding-critical/source-present P0/P1 gates
- added permanent regression coverage for cached/blocking fallback behavior

### 3. Project-local skill `[local]` label

CCB commit:
- `dd2bd12 feat: 为 project 级 skill 添加黄色 [local] 标签区分显示`

CCB changed:
- `src/components/PromptInput/PromptInputFooterSuggestions.tsx`
- `src/components/skills/SkillsMenu.tsx`
- `src/utils/suggestions/commandSuggestions.ts`

Merged result:
- prompt suggestions now render project/local prompt commands with a yellow `[local]` tag
- Skills dialog now shows `[local]`, `[global]`, and `[managed]` scope tags
- added permanent regression coverage for project/local suggestion tagging

### 4. Interview mode

CCB commit:
- `dc8ce1b feat: 添加 interview 模式`

Observed delta:
- only adds `.claude/skills/interview/SKILL.md`

Current `recode` already has source runtime pieces for plan interview flows in:
- `src/components/permissions/AskUserQuestionPermissionRequest/*`
- `src/utils/planModeV2*`

Merged result:
- added the thin project skill entry at `.claude/skills/interview/SKILL.md`
- kept runtime untouched because the plan-interview UI/tool chain already exists in `recode`

### 5. Ultraplan

Current `recode` already contains:
- `src/commands/ultraplan.tsx`
- `/ultraplan` registration behind `feature('ULTRAPLAN')`

So this is not a feature import from zero; it is a gate/alignment task.

Merged result:
- added the missing ultraplan UI components:
  - `src/components/ultraplan/UltraplanChoiceDialog.tsx`
  - `src/components/ultraplan/UltraplanLaunchDialog.tsx`
- updated `src/screens/REPL.tsx` to import and render the ultraplan dialogs explicitly, matching the current CCB shape
- aligned source-runtime external gating by defaulting `FEATURE_ULTRAPLAN=1` in the source launcher and honoring that env in command registration / REPL dialog routing
- aligned the command surface with CCB by making `/ultraplan` externally enabled
- added a non-interactive fallback verification path so `recode -p "/ultraplan"` now returns a precise interactive-only message instead of `Unknown skill`
- fixed command cache invalidation so dynamic command-surface env gates clear both `COMMANDS()` and `builtInCommandNames()`

### 6. Voice

CCB commit:
- `7ae9432 feat: enable /voice mode with native audio binaries`

Observed delta:
- CCB keeps the existing voice runtime and primarily enables it through build-feature defaults
- current `recode` source already contains:
  - `src/commands/voice/*`
  - `src/voice/*`
  - `src/context/voice.js`
  - voice-related REPL/input/config wiring

Merged result:
- defaulted `FEATURE_VOICE_MODE=1` in the source launcher so source/runtime external sessions mirror the CCB build-feature default
- aligned source-runtime gate checks across the existing voice surfaces:
  - command registration
  - REPL voice hooks / keybinding handler
  - app state voice provider
  - prompt footer / notifications / text input
  - config tool and settings schema registration
- added a permanent regression so `recode -p "/voice"` now returns the same precise interactive-only fallback style as other gated local commands instead of `Unknown skill`
- verified the bundled path also returns the precise non-interactive fallback

### 7. Bridge

Observed delta:
- current CCB bridge runtime files are effectively the same as `recode`
- CCB does **not** default-enable `BRIDGE_MODE` in its external build features
- the meaningful gap in `recode` was source-first parity: there was no way to
  opt into bridge mode locally when running `src/entrypoints/cli.tsx`

Merged result:
- added explicit `FEATURE_BRIDGE_MODE` opt-in support across the existing
  bridge source surfaces without default-enabling bridge for all external runs
- aligned source-first bridge gating in:
  - `src/entrypoints/cli.tsx`
  - `src/main.tsx`
  - `src/commands.ts`
  - `src/commands/bridge/index.ts`
  - `src/bridge/bridgeEnabled.ts`
  - REPL / footer / settings / ConfigTool bridge UI surfaces
- added a permanent regression so
  `FEATURE_BRIDGE_MODE=1 recode -p "/remote-control"` now resolves to the
  standard interactive-only fallback instead of `Unknown skill`

Verification:

- `bun test src/utils/processUserInput/__tests__/processSlashCommand.test.ts`
- `FEATURE_BRIDGE_MODE=1 bun ./src/entrypoints/cli.tsx -p "/remote-control"`
- `FEATURE_BRIDGE_MODE=1 bun ./dist/cli.js -p "/remote-control"`
- `bun test`
- `bun run build`
- `bun run lint`

### 8. Computer-use / Chrome-use

Observed delta:
- current `recode` already contains the computer-use/chrome-use command and
  runtime surfaces
- CCB defaults `CHICAGO_MCP` in packaged builds, while source-first `recode`
  still needed explicit opt-in wiring
- CCB also adds a self-contained cross-platform executor subtree under
  `src/utils/computerUse/*` for non-macOS computer-use execution

Merged result:
- defaulted `FEATURE_CHICAGO_MCP=1` in the source launcher and propagated the
  env-backed gate through the existing computer-use source surfaces:
  - `src/entrypoints/cli.tsx`
  - `src/main.tsx`
  - `src/query.ts`
  - `src/query/stopHooks.ts`
  - `src/services/mcp/client.ts`
  - `src/services/mcp/config.ts`
  - `src/services/analytics/metadata.ts`
  - `src/utils/computerUse/gates.ts`
- grafted the current CCB cross-platform executor slice without rewriting the
  existing macOS executor flow:
  - `src/utils/computerUse/common.ts`
  - `src/utils/computerUse/executor.ts`
  - `src/utils/computerUse/executorCrossPlatform.ts`
  - `src/utils/computerUse/platforms/*`
  - `src/utils/computerUse/win32/*`
- replaced the local `@ant/computer-use-mcp` stub with the current CCB package
  implementation so `createComputerUseMcpServer()` returns a real MCP server
  instead of `null`
- replaced the local `@ant/claude-for-chrome-mcp` stub with the current CCB
  package implementation so chrome MCP server creation and browser tool lists
  are real again instead of returning `null` / `[]`
- aligned packaged builds with the merged feature set by teaching `build.ts`
  to pass feature flags and defaulting:
  - `CHICAGO_MCP`
  - `VOICE_MODE`
  - `ULTRAPLAN`
- kept `/chrome` unchanged because the useful CCB delta was gate/runtime
  alignment rather than a separate chrome command rewrite

Verification:

- `bun test src/utils/computerUse/__tests__/gates.test.ts`
- `bun test`
- `bun run build`
- `bun run lint`
- `bun ./src/entrypoints/cli.tsx --computer-use-mcp`
- `bun ./dist/cli.js --computer-use-mcp`
- `bun ./dist/cli.js -p "/chrome"`
- `bun ./dist/cli.js -p "/voice"`
- `bun ./dist/cli.js -p "/ultraplan"`

### 9. Brief / KAIROS_BRIEF

CCB delta:
- `build.ts` defaults `KAIROS_BRIEF`
- the existing brief runtime already exists in source; the useful merge slice
  is source-first/build gate alignment rather than inventing a new subsystem

Merged result:
- defaulted `FEATURE_KAIROS_BRIEF=1` in the source launcher so source-first
  sessions mirror the packaged feature default
- aligned packaged builds by adding `KAIROS_BRIEF` to the build feature list
- added a dedicated helper:
  - `src/tools/BriefTool/briefFeatureEnabled.ts`
- rewired the existing brief source/runtime surfaces to honor source-first
  `FEATURE_KAIROS_BRIEF` instead of only compile-time `feature(...)` checks:
  - `src/tools/BriefTool/BriefTool.ts`
  - `src/commands/brief.ts`
  - `src/commands.ts`
  - `src/main.tsx`
  - `src/constants/prompts.ts`
  - brief UI / transcript / keybinding / settings / tool-search / recovery
    surfaces
- added a permanent regression so `/brief` now resolves to the standard
  interactive-only fallback instead of `Unknown skill`
- verified `--brief` is now visible in the source-first CLI help path

Verification:

- `bun test`
- `bun run build`
- `bun run lint`
- `bun ./src/entrypoints/cli.tsx -p "/brief"`
- `bun ./dist/cli.js -p "/brief"`
- `bun ./src/entrypoints/cli.tsx --help`

### 10. Away summary / AWAY_SUMMARY

CCB delta:
- `build.ts` defaults `AWAY_SUMMARY`
- the existing away-summary runtime already exists in source; the useful merge
  slice is source-first/build gate alignment plus updated handling for
  terminals that only report `unknown` focus state

Merged result:
- defaulted `FEATURE_AWAY_SUMMARY=1` in the source launcher so source-first
  sessions mirror the packaged feature default
- aligned packaged builds by adding `AWAY_SUMMARY` to the build feature list
- added a dedicated helper:
  - `src/hooks/awaySummaryFeatureEnabled.ts`
- rewired the existing away-summary source/runtime surfaces to honor
  source-first `FEATURE_AWAY_SUMMARY` instead of only compile-time
  `feature(...)` checks:
  - `src/hooks/useAwaySummary.ts`
  - `src/screens/REPL.tsx`
- aligned the core away-summary hook with the current CCB logic for terminals
  that do not support DECSET 1004 focus tracking:
  - treat `unknown` focus state like an idle-capable surface for timer
    scheduling
  - use `isLoading` transitions as the presence signal so CMD/PowerShell style
    terminals can still schedule away summaries when generation finishes
- added permanent regression coverage for the new source-first gate helper

Verification:

- `bun test`
- `bun run build`
- `bun run lint`

### 11. Token budget / TOKEN_BUDGET

CCB delta:
- `build.ts` defaults `TOKEN_BUDGET`
- the existing token-budget runtime already exists in source; the useful merge
  slice is source-first/build gate alignment rather than inventing a new
  budgeting subsystem

Merged result:
- defaulted `FEATURE_TOKEN_BUDGET=1` in the source launcher so source-first
  sessions mirror the packaged feature default
- aligned packaged builds by adding `TOKEN_BUDGET` to the build feature list
- added a dedicated helper:
  - `src/utils/tokenBudgetFeatureEnabled.ts`
- rewired the existing token-budget source/runtime surfaces to honor
  source-first `FEATURE_TOKEN_BUDGET` instead of only compile-time
  `feature(...)` checks:
  - `src/constants/prompts.ts`
  - `src/query.ts`
  - `src/screens/REPL.tsx`
  - `src/utils/attachments.ts`
  - `src/components/Spinner.tsx`
  - `src/components/PromptInput/PromptInput.tsx`
- added permanent regression coverage for the new source-first gate helper

Verification:

- `bun test`
- `bun run build`
- `bun run lint`

### 12. Prompt cache break detection / PROMPT_CACHE_BREAK_DETECTION

CCB delta:
- `build.ts` defaults `PROMPT_CACHE_BREAK_DETECTION`
- the existing prompt-cache-break runtime already exists in source; the useful
  merge slice is source-first/build gate alignment rather than inventing a new
  cache-break subsystem

Merged result:
- defaulted `FEATURE_PROMPT_CACHE_BREAK_DETECTION=1` in the source launcher so
  source-first sessions mirror the packaged feature default
- aligned packaged builds by adding `PROMPT_CACHE_BREAK_DETECTION` to the build
  feature list
- added a dedicated helper:
  - `src/utils/promptCacheBreakFeatureEnabled.ts`
- rewired the existing prompt-cache-break source/runtime surfaces to honor
  source-first `FEATURE_PROMPT_CACHE_BREAK_DETECTION` instead of only
  compile-time `feature(...)` checks:
  - `src/commands/compact/compact.ts`
  - `src/services/compact/microCompact.ts`
  - `src/services/compact/compact.ts`
  - `src/services/compact/autoCompact.ts`
  - `src/services/api/claude.ts`
  - `src/tools/AgentTool/runAgent.ts`
- added permanent regression coverage for the new source-first gate helper

Verification:

- `bun test`
- `bun run build`
- `bun run lint`

### 13. Verification agent / VERIFICATION_AGENT

CCB delta:
- `build.ts` defaults `VERIFICATION_AGENT`
- the existing verification-agent runtime already exists in source; the useful
  merge slice is source-first/build gate alignment rather than inventing a new
  agent subsystem

Merged result:
- defaulted `FEATURE_VERIFICATION_AGENT=1` in the source launcher so
  source-first sessions mirror the packaged feature default
- aligned packaged builds by adding `VERIFICATION_AGENT` to the build feature
  list
- added a dedicated helper:
  - `src/tools/AgentTool/verificationAgentFeatureEnabled.ts`
- rewired the existing verification-agent source/runtime surfaces to honor
  source-first `FEATURE_VERIFICATION_AGENT` instead of only compile-time
  `feature(...)` checks:
  - `src/constants/prompts.ts`
  - `src/tools/TodoWriteTool/TodoWriteTool.ts`
  - `src/tools/TaskUpdateTool/TaskUpdateTool.ts`
  - `src/tools/AgentTool/builtInAgents.ts`
- added permanent regression coverage for the new source-first gate helper

Verification:

- `bun test`
- `bun run build`
- `bun run lint`

### 14. Agent triggers / AGENT_TRIGGERS / AGENT_TRIGGERS_REMOTE / BUILTIN_EXPLORE_PLAN_AGENTS

CCB delta:
- `build.ts` defaults:
  - `AGENT_TRIGGERS`
  - `AGENT_TRIGGERS_REMOTE`
  - `BUILTIN_EXPLORE_PLAN_AGENTS`
- the existing cron/loop and explore-plan agent runtime already exists in source; the useful merge slice is source-first/build gate alignment rather than inventing new runtime

Merged result:
- defaulted these source-first launcher envs in `src/entrypoints/cli.tsx`:
  - `FEATURE_AGENT_TRIGGERS=1`
  - `FEATURE_AGENT_TRIGGERS_REMOTE=1`
  - `FEATURE_BUILTIN_EXPLORE_PLAN_AGENTS=1`
- taught `build.ts` to include:
  - `AGENT_TRIGGERS`
  - `AGENT_TRIGGERS_REMOTE`
  - `BUILTIN_EXPLORE_PLAN_AGENTS`
- added dedicated helpers:
  - `src/utils/agentTriggersFeatureEnabled.ts`
  - `src/utils/agentTriggersRemoteFeatureEnabled.ts`
  - `src/tools/AgentTool/explorePlanAgentsFeatureEnabled.ts`
- rewired the existing source/runtime surfaces to honor source-first env gates instead of only compile-time `feature(...)` checks:
  - `src/tools/ScheduleCronTool/prompt.ts`
  - `src/tools.ts`
  - `src/skills/bundled/index.ts`
  - `src/screens/REPL.tsx`
  - `src/cli/print.ts`
  - `src/constants/tools.ts`
  - `src/tools/AgentTool/builtInAgents.ts`
- added permanent regressions for:
  - source-first `AGENT_TRIGGERS` / `AGENT_TRIGGERS_REMOTE` helpers
  - source-first built-in explore/plan agent helper
- verified `/loop` is now exposed and resolves to its real usage/help path in source-first mode instead of `Unknown skill`
- kept remote scheduling policy conservative; this merge aligns feature exposure and source-first parity without forcing unrelated remote-only rollout defaults

Verification:

- `bun test`
- `bun run build`
- `bun run lint`
- `bun ./src/entrypoints/cli.tsx -p "/loop"`
- `bun ./src/entrypoints/cli.tsx -p "/help"`

### 15. Extract memories / EXTRACT_MEMORIES / Lodestone / LODESTONE

CCB delta:
- `build.ts` defaults:
  - `EXTRACT_MEMORIES`
  - `LODESTONE`
- the existing memory-extraction and desktop deep-link runtime already exists in source; the useful merge slice is source-first/build gate alignment rather than inventing new subsystems

Merged result:
- defaulted these source-first launcher envs in `src/entrypoints/cli.tsx`:
  - `FEATURE_EXTRACT_MEMORIES=1`
  - `FEATURE_LODESTONE=1`
- taught `build.ts` to include:
  - `EXTRACT_MEMORIES`
  - `LODESTONE`
- added dedicated helpers:
  - `src/utils/extractMemoriesFeatureEnabled.ts`
  - `src/utils/lodestoneFeatureEnabled.ts`
- rewired the existing source/runtime surfaces to honor source-first env gates instead of only compile-time `feature(...)` checks:
  - `src/cli/print.ts`
  - `src/query/stopHooks.ts`
  - `src/utils/backgroundHousekeeping.ts`
  - `src/interactiveHelpers.tsx`
  - `src/main.tsx`
  - `src/utils/settings/types.ts`
- added permanent regressions for the new source-first env helpers in:
  - `src/utils/__tests__/desktopFeatureEnabled.test.ts`
- kept the merge source-faithful:
  - memory extraction still remains subject to `isExtractModeActive()`
  - Lodestone deep-link behavior still stays on the existing runtime paths
  - this only aligns external source-first and packaged feature exposure

Verification:

- `bun test`
- `bun run build`
- `bun run lint`
- `bun ./src/entrypoints/cli.tsx -p "/help"`
- `bun ./dist/cli.js -p "/help"`

## Execution Rules

- Do not bulk-copy CCB code blindly.
- Diff each item first.
- Merge the smallest source-faithful slice.
- Keep `bun test`, `bun run build`, and `bun run lint` green after each item.
- If an item turns out to be mostly a gate/config toggle rather than a real
  runtime delta, record that and move on.
