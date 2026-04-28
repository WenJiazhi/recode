# Mainline Stitching Finish Design

## Goal

Define the next phase of `claudecode-rebuild` so the project can be finished as
an OG-faithful, publishable mainline rather than drifting into endless feature
sprawl.

This design assumes:

- the first meaningful CCB merge wave is already done
- the remaining work should optimize for release-grade stability
- OG alignment should continue, but only through controlled queueing

## Outcome Definition

The target state for "mainline stitching finish" is:

1. the current mainline is stable enough to be treated as a formal release line
2. remaining OG abilities are tracked in a clear candidate queue
3. those OG abilities are merged back one at a time, without destabilizing the
   release line
4. new `recode`-specific features are deferred until the release line and OG
   recovery queue are both under control

This intentionally separates "finishing the rebuild" from "inventing the next
product surface."

## Architecture of the Finish Phase

The next phase is split into two layers.

### Layer 1: Release-Grade Mainline

This is the operational backbone.

Its job is to make sure:

- the coding loop is dependable
- desktop/runtime paths are not fragile
- source-first and packaged builds behave coherently
- portable release work can depend on a stable mainline
- docs and verification output reflect reality

This layer is about making the current system trustworthy enough to ship.

### Layer 2: OG Candidate Queue

This is the controlled recovery lane for original-source capabilities.

Its job is to:

- keep visibility into what OG still contains
- avoid losing potentially worthwhile capabilities
- prevent uncontrolled bulk imports into mainline
- provide a queue of small, safe, source-faithful recovery slices

The queue exists to stop the team from treating "OG exists" as automatic
"merge now."

## Candidate Admission Rules

Every OG candidate must be classified before implementation.

### Class A: allowed directly into mainline

A candidate belongs in Class A only if all of these are true:

- it exists in OG or current CCB
- it improves daily coding or release usability
- it can be merged as a small graft, gate/default fix, or recovery patch
- it does not require a new configuration surface
- it does not widen the product in a speculative way

Typical examples:

- command routing recovery
- source-first / build gate alignment
- fallback message repair
- runtime/diagnostic stitching fixes
- recovery of already-present but partially hidden command surfaces

### Class B: retain as candidate, do not merge immediately

A candidate belongs in Class B when:

- it exists in OG
- but it has heavier runtime assumptions or weaker day-to-day value
- or it needs deeper live-environment validation before it is safe

Typical examples:

- heavier desktop/remote integrations
- lower-frequency but real OG modes
- features whose code exists but whose environment assumptions remain uncertain

These stay visible but do not block release.

### Class C: do not pursue in this phase

A candidate belongs in Class C when:

- it would add complexity disproportionate to its value
- it would require new surfaces, concepts, or configuration
- it would make the release line fatter without solving a current problem

These should be explicitly resisted.

## Release-First Execution Policy

The finish phase should be run in this order:

### Phase 1: release-grade stability

Finish hardening:

- Windows desktop-control
- source-first vs packaged consistency
- portable sync/release dependence on mainline
- core interactive command trust
- docs/status honesty

This is the highest priority because an unstable line makes every future OG
merge more dangerous.

### Phase 2: controlled OG recovery

Once the line is stable enough, recover OG candidates one by one:

- one slice per iteration
- source-faithful only
- complete verification every time
- no bulk imports

### Phase 3: new `recode` features

Only after the line is stable and OG recovery is no longer the dominant task
should new feature work begin.

This is explicitly out of scope for the current finish phase.

## Working Rules For Every Iteration

Each implementation iteration must follow this pattern:

1. inspect parity, merge, and backlog docs
2. choose exactly one smallest valuable slice
3. classify it as:
   - release hardening
   - or OG candidate recovery
4. implement minimally
5. verify with:
   - targeted regression
   - `bun test`
   - `bun run build`
   - `bun run lint`
6. update state docs only if project state actually changed

This prevents drift, hidden scope expansion, and accidental architecture weight.

## Near-Term Execution Order

The current recommended order is:

1. Windows desktop-control hardening
2. interactive coding-loop verification
3. portable release hardening
4. fresh OG/CCB candidate audit

### Why Windows desktop-control is first

Because it is:

- still the highest remaining runtime rough edge
- clearly a stitching-layer problem
- highly visible to users
- fixable in small slices without touching core OG architecture

### Why interactive coding-loop verification is second

Because:

- `review / commit / branch / worktree` are central to daily trust
- much of the logic already exists and is tested
- the remaining value is mostly interactive-safe verification, not subsystem
  invention

### Why portable release hardening is third

Because:

- it depends on mainline stability
- it should track mainline, not drive it
- it belongs to release finishing, not architecture invention

### Why fresh OG/CCB audit is last

Because:

- current known meaningful alignment work is already merged
- a new upstream slice should only be taken once current runtime rough edges
  are calmer

## Design Constraints

The finish phase must continue to obey these constraints:

- no speculative feature expansion
- no new configuration surfaces
- no broad architectural rewrites
- no changes to OG runtime internals when the bug lives in the stitch layer
- no treating low-frequency OG code as mandatory merge debt

## Success Criteria

This finish phase succeeds when:

- the mainline is release-grade and predictable
- the remaining OG recovery work is controlled by a queue, not impulse
- future changes mostly refine or recover, rather than rescue
- the project can confidently move from "rebuild" to "maintained release line"
