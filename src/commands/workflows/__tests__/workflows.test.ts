import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runWithCwdOverride } from '../../../utils/cwd.js'
import { createWorkflowRun } from '../../../services/workflow/engine.js'
import {
  initializeWorkflowJournal,
  loadWorkflowRun,
} from '../../../services/workflow/storage.js'
import { _clearWorkflowStoreForTesting } from '../../../services/workflow/store.js'
import { validateWorkflowSpec } from '../../../services/workflow/validation.js'
import { call } from '../workflows.js'

test('/workflows configures persisted budget and concurrency', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-workflows-command-'))
  const run = createWorkflowRun({
    spec: validateWorkflowSpec({
      version: 1,
      name: 'command-config',
      objective: 'Configure a persisted run',
      steps: [{ id: 'inspect', title: 'Inspect', prompt: 'Inspect' }],
    }),
    sessionId: 'session',
    projectRoot: root,
    runId: '99999999-9999-4999-8999-999999999999',
  })

  try {
    await initializeWorkflowJournal(run)
    const budget = await runWithCwdOverride(root, () =>
      call(`budget ${run.runId.slice(0, 8)} 20k`, {} as never),
    )
    expect(budget).toMatchObject({
      type: 'text',
      value: expect.stringContaining('20k'),
    })
    const concurrency = await runWithCwdOverride(root, () =>
      call(`concurrency ${run.runId.slice(0, 8)} 4`, {} as never),
    )
    expect(concurrency).toMatchObject({
      type: 'text',
      value: expect.stringContaining('set to 4'),
    })

    const restored = await loadWorkflowRun(root, run.runId)
    expect(restored?.tokenBudget).toBe(20_000)
    expect(restored?.concurrencyLimit).toBe(4)
  } finally {
    _clearWorkflowStoreForTesting()
    await rm(root, { recursive: true, force: true })
  }
})
