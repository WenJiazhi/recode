# OG Next Phase Brainstorm

## Purpose

Define the next execution phase for `claudecode-rebuild` without drifting away
from the original source style.

This document is not a product roadmap. It is a constrained execution brief
for the next set of mainline iterations.

## Current Understanding

The repository is no longer in the "recover the skeleton" stage.

What is already true:

- the main OG/CCB alignment wave is largely complete
- the coding loop is usable
- source-first and packaged paths both work
- Windows desktop-control is no longer a stub chain

What is no longer justified:

- adding features for the sake of visual completeness
- importing large CCB slices just because they exist upstream
- editing OG runtime internals when the bug actually lives in glue code

So the next phase should be:

1. selective upstream audit
2. stitching bug repair
3. interactive-safe verification

## Two Explicit Tracks

### Track A: OG / CCB Alignment

Use this track only when all of these are true:

- the capability exists in OG or current CCB
- it still improves the daily coding workflow
- it can be merged as a small graft or gate/default correction
- it does not introduce a new product surface

Current status:

- the known meaningful CCB default/gate items are already aligned
- new work here must come from a fresh upstream delta review, not from the old
  backlog

### Track B: Stitching Bug Repair

Use this track when the bug comes from:

- launcher defaults
- source-first / packaged gate mismatches
- adapters
- wrappers
- bridge parsing
- argument normalization
- fallback routing
- diagnostics hiding the real failure mode

Default rule:

- repair the stitch before touching OG runtime

## Strategic Decision

For the next phase, **Track B should dominate**.

Reason:

- this is where the remaining user-facing instability is
- fixes are small, testable, and source-faithful
- more feature alignment now would give worse value-per-risk than runtime
  hardening

Track A should only resume when:

- a specific new upstream CCB slice is identified
- it clearly maps to existing OG runtime
- Track B is no longer the highest pain point

## Highest-Value Domains

### 1. Windows desktop-control chain

Why it matters:

- highest remaining real runtime rough edge
- recent work already proved small fixes here produce immediate value

Scope:

- `packages/@ant/computer-use-mcp/src/toolCalls.ts`
- `src/utils/computerUse/*`
- Windows bridge / launcher / normalization / diagnostics helpers

Do not do:

- broad UI redesign
- new settings
- alternate execution models

### 2. Interactive coding-loop verification

Why it matters:

- core user trust comes from `review / commit / branch / worktree` behaving
  predictably

Scope:

- verify local interactive flows only
- keep remote side effects out

Do not do:

- speculative refactors
- product expansion around git workflows

### 3. LSP first-success polish

Why it matters:

- architecture is already in place
- remaining gap is setup clarity, not new capability

Scope:

- only messages / guidance / first-success path

Do not do:

- new LSP architecture
- new config layers

## Detailed Execution Waves

## Wave 1: Windows desktop-control hardening

Goal:

- move the repo-side Windows chain from "mostly works" to "predictably works"

Candidate slices:

1. normalize `request_access` inputs and reject empty-noop requests
2. improve unmatched-app resolution and its feedback path
3. harden bridge output parsing and noisy stdout handling
4. normalize `bind_window` argument shapes
5. harden launcher fallback sequencing for `open_terminal`

Selection rule:

- always pick the smallest slice that removes a real user-visible failure

Acceptance bar:

- targeted regression added
- full test/build/lint remain green

## Wave 2: Interactive coding-loop verification

Goal:

- prove that already-merged coding flows hold under interactive-safe paths

Candidate slices:

1. local interactive verification around `review`
2. local interactive verification around `commit`
3. branch/worktree/session continuity checks with user-facing flows

Selection rule:

- verify behavior first
- only patch when there is a confirmed gap

Acceptance bar:

- no remote side effects
- local-only git state
- regression where practical

## Wave 3: Fresh upstream CCB audit

Goal:

- identify whether there is any new slice worth merging

Candidate audit questions:

1. Did CCB add a real coding-surface improvement after the current `16/16`?
2. Does it already exist in OG runtime here?
3. Can it be merged as a helper/gate/default change rather than a subsystem?

Rejection criteria:

- docs-only
- branding-only
- workflow style changes without runtime value
- broad feature imports

## Explicit Non-Goals

Do not spend time on these unless the problem becomes concrete:

- new major feature surfaces
- fresh configuration systems
- broad UI polish
- deep remote/voice/chrome expansion
- abstract architectural cleanup

## Slice Quality Checklist

Every iteration must satisfy:

- one behavioral point
- one clear root cause
- one narrow file cluster
- one targeted regression where possible
- full test/build/lint verification

If the candidate slice fails any of these, shrink it or skip it.

## Recommended Immediate Next Slice

The strongest next move is still inside Wave 1:

**Improve the `request_access` unresolved-app path so that app-name failures
produce more actionable, stable feedback instead of low-signal "not installed"
style dead ends.**

Why this one:

- it sits directly on the main Windows permission path
- it improves real usability without changing capabilities
- it is still stitch-layer work, not OG runtime mutation
- it is easy to verify with focused tests

## Exit Criteria For This Brainstorm

This brainstorming pass is successful if it produces:

- a clear separation between Track A and Track B
- a reasoned decision to prioritize Track B
- a wave order for the next few iterations
- one concrete next slice to execute

This document now serves as that execution brief.
