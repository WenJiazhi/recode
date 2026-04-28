# Superpowers Workflow For `claudecode-rebuild`

This directory records how `superpowers` should actually be used in this
repository.

The goal is not "use more skills." The goal is to use the right skill at the
right stage while keeping the project source-faithful, small-slice, and
enterprise-grade.

## Current Principle

The project is in a **finish phase**, not a feature-expansion phase.

That means:

1. keep the mainline publishable and trustworthy
2. keep recovering OG behavior only through controlled, small slices
3. do not use skills as an excuse to widen the product

## Recommended Skill Order

### 1. `brainstorming`

Use only when a phase boundary or design frame needs to be set.

Good use here:
- define the finish-phase structure
- separate release hardening from OG recovery
- decide whether a candidate belongs in current work at all

Do **not** use it for every bugfix or every small implementation slice.

### 2. `writing-plans`

Use after the direction is already known and one small area has been selected.

Good use here:
- write a narrow plan for one Windows desktop-control hardening slice
- write a short plan for one interactive coding-loop verification slice
- write a short plan for one portable release hardening slice

### 3. `systematic-debugging`

Default skill for runtime bugs and correctness issues.

Good use here:
- Windows desktop-control failures
- request shaping problems
- bridge/runtime behavior mismatches
- source-first vs packaged drift

This should be preferred over speculative patching.

### 4. `test-driven-development`

Use for small correctness repairs where a focused regression can be added first.

Good use here:
- request/input normalization
- dialog path correctness
- runtime glue regressions
- formatting or user-visible correctness helpers

### 5. `subagent-driven-development`

Use when the work is already broken into independent tasks or independent
read-only review partitions.

Good use here:
- large partitioned review of non-OG additions
- parallel read-only audits of:
  - Windows runtime
  - gate/default alignment
  - portable/release

Avoid using it for tightly coupled edits in the same hotspot file.

### 6. `verification-before-completion`

Mandatory before claiming a slice is done.

Default evidence:
- targeted test
- `bun test`
- `bun run build`
- `bun run lint`

### 7. `requesting-code-review`

Use after a meaningful slice, especially when:
- the touched files are hot spots
- the change altered request shaping
- the change altered runtime routing

## Current Hotspots

These are the files and areas where skill-driven work must stay extra strict:

1. [packages/@ant/computer-use-mcp/src/toolCalls.ts](/E:/appdev/claudecode-rebuild/packages/@ant/computer-use-mcp/src/toolCalls.ts)
2. [src/utils/computerUse/executorCrossPlatform.ts](/E:/appdev/claudecode-rebuild/src/utils/computerUse/executorCrossPlatform.ts)
3. feature gate/default helper proliferation
4. portable/release script duplication

## Default Next-Step Order

When no special instruction overrides it, use this order:

1. Windows desktop-control hardening
2. interactive coding-loop verification
3. portable release hardening
4. fresh OG/CCB candidate audit

## What To Avoid

- using `brainstorming` for work that is already understood
- writing large plans for tiny bugfixes
- using subagents for tightly shared write scopes
- widening the product because a skill suggests more ideas
- letting a plan survive after the hotspot review says the target area is too hot
