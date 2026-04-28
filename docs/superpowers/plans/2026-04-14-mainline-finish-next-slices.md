# Mainline Finish Next Slices

## Purpose

Capture the next practical slices after the architecture review so the project
can resume quickly without re-deciding direction.

## Current Baseline

- `bun test`: `266 pass / 0 fail`
- `bun run build`: green
- `bun run lint`: green
- CCB alignment wave: complete (`16 / 16`)
- current phase: release-grade finish work

## Slice Order

### Slice 1: Windows desktop-control hardening

Keep working only inside the existing runtime/request seams.

Good candidates:
- correctness bugs in `request_access`, `request_teach_access`, `bind_window`
- runtime glue gaps in Win32 bridge / platform routing
- user-visible text corruption in high-frequency desktop-control flows

Hard constraints:
- do not add new policy layers to
  [toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
- do not keep moving Win32 detail into
  [executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)

### Slice 2: interactive coding-loop verification

Only verify or repair real user-visible gaps.

Focus:
- `review`
- `commit`
- `commit-push-pr`
- `branch`
- `worktree`
- `session`

Constraint:
- prefer smoke/regression coverage and the smallest repair possible

### Slice 3: portable release hardening

Focus:
- release-grade correctness guards
- sync boundary enforcement
- launcher/runtime sanity

Constraint:
- do not turn the scripts into a second runtime definition

### Slice 4: fresh OG/CCB candidate audit

Only after the above are calmer.

Admission filters:
- real OG/CCB source exists
- real user value
- small graft
- no new config surface
- no architecture weight increase

## Explicit Non-Goals

- no speculative new features
- no broad refactors
- no "clean because it looks nicer" passes in hot files
- no helper-file proliferation unless it genuinely reduces weight
