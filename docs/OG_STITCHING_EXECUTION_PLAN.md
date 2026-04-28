# OG Stitching Execution Plan

## Goal

Keep `recode` on an OG/source-faithful path:

1. continue merging only the worthwhile CCB slices that map cleanly onto the
   original restored `src` architecture
2. debug and harden the stitched runtime without gratuitously rewriting OG
   code paths

This plan is intentionally split into two tracks so we do not blur
"feature-graft" work with "stitching-repair" work.

## Core Rule

Every future change must belong to exactly one of these buckets:

- **Track A: OG/CCB feature alignment**
  - only if the capability already exists in OG/CCB
  - only if the slice is still high-value
  - only if it can be merged as a minimal graft or gate alignment
- **Track B: stitching bug repair**
  - fix the glue, adapters, launchers, gating helpers, wrappers, and recovery
    logic added during rebuild
  - avoid editing OG runtime code unless the bug clearly lives there

If a change does not clearly fit A or B, do not do it.

## Track A: OG / CCB Alignment

### What is already done

- CCB default/gate alignment is complete through the current known meaningful
  slice set (`16 / 16`)
- the remaining work is no longer "keep adding feature flags"
- new alignment work must now be justified by:
  - a real new CCB upstream delta
  - a clean mapping to OG runtime already present in `src`
  - low abstraction cost

### What still counts as valid alignment work

Only do one of these:

1. **New upstream slice audit**
   - check whether CCB added a real new capability worth keeping
   - reject docs-only, branding-only, and speculative additions

2. **Missed OG surface recovery**
   - an original `src` capability exists but still routes badly, is hidden, or
     is only partially stitched

3. **Source-faithful gate/default correction**
   - existing runtime is correct, but launcher/build/gating still prevents use

### What does not count

- adding new `recode`-specific product features
- inventing alternate runtime layers
- speculative parity for gated areas with no daily value
- bulk imports "just because CCB has it"

## Track B: Stitching Bug Repair

### Main principle

Prefer fixing rebuild-introduced glue over editing OG runtime internals.

### Repair priority

1. **Launcher / entry / gating glue**
   - source-first env defaults
   - packaged-build default features
   - command registration / routing
   - non-interactive fallback paths

2. **Bridge / adapter / wrapper glue**
   - OpenAI adapter normalization
   - local-provider config loading
   - Windows computer-use bridge parsing
   - terminal/window matching and input normalization

3. **Recovery / diagnostics**
   - `/doctor`
   - `/status`
   - error messages that currently hide the true failure mode

4. **OG runtime edits**
   - only when the bug clearly reproduces inside the original runtime path and
     cannot be solved in the stitch layer

### Default repair heuristic

Before editing an OG-heavy file, ask:

1. Can this be solved in a helper?
2. Can this be solved in an adapter?
3. Can this be solved in a launcher/gate/default?
4. Can this be solved in validation/normalization before hitting OG code?

If yes, fix there first.

## Execution Loop

Every future mainline iteration should follow this loop:

1. **Re-check backlog**
   - inspect:
     - `docs/SOURCE_PARITY_CHECKLIST.md`
     - `docs/CCB_MERGE_PLAN.md`
     - `docs/PRIORITY_REBUILD_BACKLOG.md`
     - current upstream CCB recent commits if needed

2. **Pick one smallest valuable slice**
   - must improve either:
     - a still-missing OG/CCB capability
     - a known stitched runtime failure

3. **Classify the slice**
   - Track A or Track B
   - if unclear, stop and simplify the slice

4. **Implement minimally**
   - no new product surface
   - no new configuration surface
   - no large-scale refactor
   - one behavioral point per iteration

5. **Verify**
   - targeted test
   - full `bun test`
   - `bun run build`
   - `bun run lint`

6. **Update state**
   - only update docs when the behavioral state actually changed

## Immediate Priority Queue

### Priority 1: Windows desktop-control hardening

Why:
- highest remaining user-visible runtime rough edge
- largely a stitching problem, not an OG architecture problem

Allowed edits:
- `packages/@ant/computer-use-mcp/src/toolCalls.ts`
- `src/utils/computerUse/*`
- Windows bridge / launcher / normalization helpers

Avoid unless clearly necessary:
- broad rewrites of OG command/UI surfaces

### Priority 2: interactive coding-loop verification

Why:
- core daily-use loop value
- already mostly implemented; needs selective end-to-end validation

Allowed scope:
- `review / commit / commit-push-pr`
- `branch / worktree / session`

Goal:
- verify existing behavior
- fix only real gaps

### Priority 3: new upstream CCB delta audit

Why:
- only after Track B is calmer
- should be selective, not routine

Required test before doing any new alignment:
- identify one specific upstream slice
- explain why it is still source-faithful
- explain why it will not increase architecture weight

## Decision Filters

Before any future patch, the change must pass all filters:

- **OG fit**: already present in OG or a clear stitch around OG
- **Value**: improves a real user path
- **Smallness**: one focused behavior change
- **Verifiability**: testable this turn
- **Non-bloat**: no new unnecessary abstraction layer

If a candidate fails even one filter, skip it.

## What We Should Actively Resist

- "complete-looking" but low-value parity work
- adding wrappers around wrappers
- broad cleanup disguised as bug fixing
- changing OG code just because it is easier than understanding the stitch
- adding options/settings instead of fixing defaults

## Recommended Near-Term Sequence

1. finish the next 2-4 Windows desktop-control stitch fixes
2. re-evaluate whether the chain is now "good enough"
3. then switch to interactive coding-loop verification
4. only then audit for a truly worthwhile new CCB delta

## Hotspot Constraints

The finish phase now has a second constraint layer from the architecture review.
These are not rewrite targets; they are zones where future edits must be more
strictly limited.

### 1. `toolCalls.ts`

- [packages/@ant/computer-use-mcp/src/toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
- treat as a central dispatch hotspot
- allowed:
  - small request-shaping fixes
  - localized correctness repairs
  - focused user-visible text repairs
- avoid:
  - new cross-cutting policy
  - new workflow/state concepts
  - widening the tool surface there

### 2. `executorCrossPlatform.ts`

- [src/utils/computerUse/executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
- treat as glue, not as the long-term home for Windows detail
- allowed:
  - small routing fixes
  - coordinate / metadata correctness repairs
- avoid:
  - pushing more Win32 orchestration or platform policy into this file

### 3. feature helper proliferation

- existing `*FeatureEnabled.ts` helpers are acceptable for now
- future work should prefer domain consolidation over adding more one-flag
  wrappers

### 4. portable / release scripts

- [scripts/sync-portable.ps1](/E:/appdev/claudecode-rebuild/scripts/sync-portable.ps1)
- [scripts/build-portable-release.ps1](/E:/appdev/claudecode-rebuild/scripts/build-portable-release.ps1)
- allowed:
  - release-grade correctness guards
  - dependency/base validation
- avoid:
  - duplicating more launcher/install logic
  - turning scripts into a second runtime/config system

## Success Condition

The rebuild is in a good state when:

- no major daily-use path is broken
- Windows desktop-control repo-side chain is predictably usable
- interactive coding loop is trustworthy
- new changes are mostly refinement, not rescue
