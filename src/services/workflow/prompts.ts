import type {
  WorkflowDependencyResult,
  WorkflowRun,
  WorkflowStep,
} from './types.js'
import { escapeXml } from '../../utils/xml.js'

const MAX_DEPENDENCY_OUTPUT_CHARS = 30_000
const MAX_TOTAL_DEPENDENCY_OUTPUT_CHARS = 80_000

function dependencyContext(
  outputs: Record<string, WorkflowDependencyResult>,
): string {
  let remaining = MAX_TOTAL_DEPENDENCY_OUTPUT_CHARS
  const sections: string[] = []
  for (const [id, result] of Object.entries(outputs)) {
    if (remaining <= 0) break
    const rawOutput = result.output
    const output = rawOutput.slice(
      0,
      Math.min(MAX_DEPENDENCY_OUTPUT_CHARS, remaining),
    )
    remaining -= output.length
    const format =
      result.structuredOutput === undefined ? 'text' : 'structured-json'
    sections.push(
      `<dependency id="${id}" format="${format}">${escapeXml(output)}</dependency>`,
    )
  }
  return sections.length > 0
    ? `\n<dependency-results>\n${sections.join('\n')}\n</dependency-results>`
    : ''
}

export function buildWorkflowStepPrompt(
  run: WorkflowRun,
  step: WorkflowStep,
  dependencyResults: Record<string, WorkflowDependencyResult>,
): string {
  const modeRule =
    step.mode === 'read'
      ? 'This is a read-only step. Inspect and reason, but do not modify files or external state.'
      : step.isolation === 'worktree'
        ? 'This write step runs in an isolated Git worktree. Other isolated write steps may run concurrently, so stay within the requested scope and verify your changes before finishing.'
        : 'This is the only active shared-directory write step. Make the requested changes and verify them before finishing.'
  const outputRule = step.outputSchema
    ? `\nYou must finish by calling StructuredOutput exactly once with an object matching this JSON Schema:\n<output-schema>${escapeXml(JSON.stringify(step.outputSchema))}</output-schema>`
    : '\nYour final response is the text result consumed by dependent workflow steps. Be concrete, preserve file paths and evidence, and do not address the end user directly.'
  return `<workflow-step run-id="${run.runId}" step-id="${step.id}">
<workflow-objective>${escapeXml(run.spec.objective)}</workflow-objective>
<step-title>${escapeXml(step.title)}</step-title>
<step-instructions>${escapeXml(step.prompt)}</step-instructions>${dependencyContext(dependencyResults)}

${modeRule}${outputRule}
</workflow-step>`
}

export const ORCHESTRATE_PROMPT = `The user explicitly requested multi-agent orchestration.

Construct and launch one declarative Workflow using the Workflow tool. Use a small DAG that matches the task instead of spawning agents without a dependency model.

Rules:
- Use 2-6 focused read steps for independent investigation, review, or verification.
- Add dependencies wherever a later step consumes earlier results.
- Prefer diverse evidence paths over several agents repeating the same prompt. For reviews, assign distinct lenses such as correctness, security, tests, and performance, then add an evidence-checking synthesis or critic step.
- Prefer one shared-directory write step, normally dependent on all initial reads. When the objective has genuinely independent file scopes in a Git project, multiple write steps may set isolation="worktree" and run without ordering between each other; every isolated write must still be dependency-ordered with all read and shared-directory write steps. Any post-write verification must depend on every write it verifies.
- Treat agreement as a signal, not proof. Verification steps should cite concrete files, commands, or reproduced behavior and should try to refute uncertain findings.
- Keep maxConcurrency at 3 unless the user explicitly requested another value.
- Omit tokenBudget unless the user explicitly requested a run-level token cap; never infer a spending limit from task size.
- Use maxAttempts=2 only for steps where a transient provider failure is worth retrying.
- Use outputSchema only when a dependent step needs a machine-checkable object. Keep schemas small, require the important fields, and use an object root.
- Do not invent arbitrary JavaScript, shell-based orchestration, nested workflows, or hidden loops.
- After the Workflow tool returns, report the run ID and explain that /workflows or /tasks shows progress. Do not claim completion until the background notification arrives.
`
