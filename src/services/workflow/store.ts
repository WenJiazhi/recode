import type { WorkflowRun } from './types.js'
import { listWorkflowRuns } from './storage.js'

const runs = new Map<string, WorkflowRun>()
const hydratedRoots = new Set<string>()

export function setWorkflowRun(run: WorkflowRun): void {
  runs.set(run.runId, structuredClone(run))
}

export function getWorkflowRuns(projectRoot?: string): WorkflowRun[] {
  return [...runs.values()]
    .filter(run => !projectRoot || run.projectRoot === projectRoot)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(run => structuredClone(run))
}

export async function hydrateWorkflowRuns(projectRoot: string): Promise<void> {
  if (hydratedRoots.has(projectRoot)) return
  for (const run of await listWorkflowRuns(projectRoot))
    runs.set(run.runId, run)
  hydratedRoots.add(projectRoot)
}

export function _clearWorkflowStoreForTesting(): void {
  runs.clear()
  hydratedRoots.clear()
}
