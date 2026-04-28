# Windows Access Feedback Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make unresolved Windows `request_access` / `request_teach_access` requests fail with actionable, source-faithful guidance instead of low-signal dead ends.

**Architecture:** Keep the work entirely inside the existing `@ant/computer-use-mcp` request-resolution layer. Reuse the current request normalization and app-resolution helpers, add one small suggestion helper, and lock behavior with focused Windows regression tests. No new commands, no new settings, no new runtime layers.

**Tech Stack:** TypeScript, Bun test runner, existing `@ant/computer-use-mcp` tool-call handlers, existing Windows desktop-control test fixtures.

---

This is the next **sub-project** inside Windows desktop-control hardening. The previous slice already normalized app inputs and rejected empty/no-op requests; this plan handles the next remaining usability gap: unresolved app feedback.

## File Structure

- Modify: `packages/@ant/computer-use-mcp/src/toolCalls.ts`
  - Owns request normalization, installed-app resolution, and tool error/result shaping.
- Modify: `packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`
  - Owns focused Windows regression coverage for `request_access`, `open_terminal`, and `bind_window`.
- Modify: `docs/WORKLOG.md`
  - Records the new behavior change.
- Modify: `docs/STATUS.md`
  - Records the new verified behavior and updated test count if it changes.

## Task 1: Add failing tests for actionable unresolved-app feedback

**Files:**
- Modify: `packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`:

```ts
test('handleToolCall request_access returns actionable suggestions for unresolved Windows apps', async () => {
  const overrides = {
    ...createOverrides(),
    onPermissionRequest: async () => ({
      granted: [],
      denied: [],
      flags: createOverrides().grantFlags,
    }),
  }

  const result = await handleToolCall(
    createAdapter({
      listInstalledApps: async () => [
        {
          bundleId: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
          displayName: 'PowerShell',
          path: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
        },
        {
          bundleId: 'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
          displayName: 'Windows Terminal',
          path: 'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
        },
        {
          bundleId: 'C:\\Windows\\System32\\cmd.exe',
          displayName: 'Command Prompt',
          path: 'C:\\Windows\\System32\\cmd.exe',
        },
      ],
    }),
    'request_access',
    { reason: 'open shell', apps: ['terminal.exe'] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('None of the requested applications could be resolved')
  expect(result.content[0]?.text).toContain('PowerShell')
  expect(result.content[0]?.text).toContain('Windows Terminal')
})

test('handleToolCall request_teach_access returns generic unresolved guidance when no suggestions exist', async () => {
  const overrides = {
    ...createOverrides(),
    onTeachPermissionRequest: async () => ({
      granted: [],
      denied: [],
      flags: createOverrides().grantFlags,
    }),
  }

  const result = await handleToolCall(
    createAdapter({
      listInstalledApps: async () => [],
    }),
    'request_teach_access',
    { reason: 'guide me', apps: ['missing-app.exe'] },
    overrides,
  )

  expect(result.isError).toBe(true)
  expect(result.telemetry?.error_kind).toBe('bad_args')
  expect(result.content[0]?.type).toBe('text')
  expect(result.content[0]?.text).toContain('None of the requested applications could be resolved')
  expect(result.content[0]?.text).toContain('Use an installed application name, bundle ID, or common executable name')
})
```

- [ ] **Step 2: Run the focused test file to verify the new tests fail**

Run:

```bash
bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts
```

Expected:

- the new tests fail because unresolved requests currently return only generic text without suggestions

- [ ] **Step 3: Commit the failing tests**

```bash
git add packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts
git commit -m "test: define unresolved windows access feedback behavior"
```

## Task 2: Implement source-faithful unresolved-app suggestions

**Files:**
- Modify: `packages/@ant/computer-use-mcp/src/toolCalls.ts`
- Modify: `packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts`

- [ ] **Step 1: Add a small installed-app suggestion helper**

Add this helper near `normalizeRequestedAppNames` / `resolveRequestedApps` in `packages/@ant/computer-use-mcp/src/toolCalls.ts`:

```ts
function suggestInstalledApps(
  requestedApps: string[],
  installed: InstalledApp[],
): string[] {
  const requestedTokens = requestedApps.map(normalizeExecutableLookupToken)
  const out: string[] = []
  const seen = new Set<string>()

  for (const app of installed) {
    const display = app.displayName.trim()
    if (!display) continue
    const basename = normalizeExecutableLookupToken(app.path || app.bundleId)
    const matches = requestedTokens.some(
      (token) =>
        display.toLowerCase().includes(token) ||
        basename.includes(token) ||
        token.includes(basename),
    )
    if (!matches) continue
    const key = display.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(display)
    if (out.length === 3) break
  }

  return out
}
```

- [ ] **Step 2: Replace the unresolved-app error builder with a suggestion-aware version**

Replace the existing unresolved error helper in `packages/@ant/computer-use-mcp/src/toolCalls.ts` with:

```ts
function buildUnresolvedAppsError(
  apps: string[],
  installed: InstalledApp[],
): CuCallToolResult {
  const quoted = apps.map((app) => `"${app}"`).join(", ")
  const suggestions = suggestInstalledApps(apps, installed)
  const suggestionText =
    suggestions.length > 0
      ? ` Closest installed matches: ${suggestions.map((name) => `"${name}"`).join(", ")}.`
      : ' Use an installed application name, bundle ID, or common executable name such as powershell.exe or cmd.exe.'

  return errorResult(
    `None of the requested applications could be resolved: ${quoted}.${suggestionText}`,
    'bad_args',
  )
}
```

- [ ] **Step 3: Thread the installed-app list through the unresolved-request guards**

In `buildAccessRequest`, keep:

```ts
  const installed = await adapter.executor.listInstalledApps();
```

In `handleRequestAccess`, update the unresolved-request guard so it uses the same `installed` list that powered `buildAccessRequest(...)`. The final call site should have the shape:

```ts
  if (
    apps.length > 0 &&
    needDialog.length === 0 &&
    skipDialogGrants.length === 0 &&
    userDenied.length === 0 &&
    policyDenied.length === 0 &&
    Object.keys(requestedFlags).length === 0
  ) {
    return buildUnresolvedAppsError(apps, installed)
  }
```

Do the same in `handleRequestTeachAccess`:

```ts
  if (
    apps.length > 0 &&
    needDialog.length === 0 &&
    skipDialogGrants.length === 0 &&
    userDenied.length === 0 &&
    policyDenied.length === 0
  ) {
    return buildUnresolvedAppsError(apps, installed)
  }
```

This must stay a small extension to existing request shaping. Do not add any new config or tool.

- [ ] **Step 4: Run the focused test file and verify it passes**

Run:

```bash
bun test packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts
```

Expected:

- all tests in the file pass
- unresolved requests now carry actionable suggestions when available
- generic guidance remains for cases with no installed matches

- [ ] **Step 5: Commit**

```bash
git add packages/@ant/computer-use-mcp/src/toolCalls.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts
git commit -m "fix: improve unresolved windows access feedback"
```

## Task 3: Final verification and state update

**Files:**
- Modify: `docs/WORKLOG.md`
- Modify: `docs/STATUS.md`
- Test: full repository verification

- [ ] **Step 1: Add the worklog entry**

Append this section near the current 2026-04-13 work in `docs/WORKLOG.md`:

```md
### Windows unresolved-app feedback hardening

- unresolved Windows `request_access` / `request_teach_access` requests now
  return actionable guidance instead of low-signal dead ends
- when close matches exist, the response now suggests installed app names
- when no matches exist, the response keeps a generic executable-name fallback
- the change stays inside `@ant/computer-use-mcp` request shaping and tests
```

- [ ] **Step 2: Update the status snapshot**

In `docs/STATUS.md`, add one new verification bullet:

```md
- unresolved Windows `request_access` / `request_teach_access` requests now return actionable installed-app guidance when close matches exist: `completed`
```

If the total `bun test` pass count changed, update the count line to the exact new number.

- [ ] **Step 3: Run full verification**

Run:

```bash
bun test
bun run build
bun run lint
```

Expected:

- all tests pass
- build passes
- lint passes

- [ ] **Step 4: Commit**

```bash
git add docs/WORKLOG.md docs/STATUS.md packages/@ant/computer-use-mcp/src/toolCalls.ts packages/@ant/computer-use-mcp/src/__tests__/toolCallsWindows.test.ts
git commit -m "fix: harden windows access feedback"
```

## Self-Review

- Spec coverage:
  - covers the next concrete Windows desktop-control slice after input normalization and no-op rejection
  - stays inside the stitching layer
- Placeholder scan:
  - no placeholders remain
- Type consistency:
  - `suggestInstalledApps` returns `string[]`
  - `buildUnresolvedAppsError` remains a `CuCallToolResult`
  - both handlers keep existing unresolved-request guard shapes

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-13-windows-access-feedback-hardening-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
