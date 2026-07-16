import type { GoalState } from '../../types/logs.js'
import { escapeXml } from '../../utils/xml.js'
import { formatGoalElapsed } from './goalState.js'

function formatUsage(goal: GoalState): string {
  if (goal.tokenBudget === null) return `${goal.tokensUsed} tokens used`
  const remaining = Math.max(0, goal.tokenBudget - goal.tokensUsed)
  return `${goal.tokensUsed} / ${goal.tokenBudget} tokens used (${remaining} remaining)`
}

function checkpointSection(goal: GoalState): string {
  const latest = goal.checkpoints.at(-1)
  return latest ? `\n## Latest Checkpoint\n${escapeXml(latest.summary)}\n` : ''
}

export function buildContinuationPrompt(goal: GoalState): string {
  return `<goal-steering type="continuation">
Continue working autonomously toward the active goal.

## Objective
${escapeXml(goal.objective)}

## Runtime Status
- Active time: ${formatGoalElapsed(goal)}
- ${formatUsage(goal)}
- Automatic continuations: ${goal.turnsExecuted}
${checkpointSection(goal)}
## Operating Rules
1. Preserve the full objective. Do not redefine success around partial progress.
2. Continue with concrete implementation, verification, and cleanup work.
3. Record a Goal checkpoint after a meaningful milestone, not after routine steps.
4. User messages and explicit user control always take priority over autonomous work.

Before marking the goal complete with the Goal tool, perform a completion audit:
- Derive every concrete requirement from the objective and referenced artifacts.
- Identify authoritative evidence for each requirement.
- Confirm tests and checks actually cover the claimed behavior.
- Treat uncertain or indirect evidence as incomplete.

Only mark the goal blocked after the same insurmountable condition persists across at least three continuation attempts. Difficulty, slow progress, or incomplete work is not a blocker.

Resume work now.
</goal-steering>`
}

export function buildBudgetLimitPrompt(goal: GoalState): string {
  return `<goal-steering type="budget_limit">
The active Goal has reached its token budget.

- Objective: ${escapeXml(goal.objective)}
- Usage: ${formatUsage(goal)}
- Active time: ${formatGoalElapsed(goal)}

Stop starting new substantive work. Summarize what is complete, what remains, and the strongest verification evidence available. Mark the Goal complete only if the original objective is fully proven; otherwise leave it budget-limited for the user to extend or clear.
</goal-steering>`
}

export function buildObjectiveUpdatedPrompt(
  objective: string,
  previousObjective?: string,
): string {
  const previous = previousObjective
    ? `\nPrevious objective: ${escapeXml(previousObjective)}`
    : ''
  return `<goal-steering type="objective_updated">
The user has set a persistent autonomous Goal.${previous}

New objective: ${escapeXml(objective)}

Begin working toward the complete objective. Preserve relevant prior progress, use checkpoints for meaningful milestones, and use the Goal tool only after a strict completion or blocked audit.
</goal-steering>`
}

export function buildGoalContextBlock(goal: GoalState): string {
  const latest = goal.checkpoints.at(-1)
  const checkpoint = latest
    ? `\n<latest-checkpoint>${escapeXml(latest.summary)}</latest-checkpoint>`
    : ''
  return `<persistent-goal status="${goal.status}" tokens="${goal.tokensUsed}" continuations="${goal.turnsExecuted}">${escapeXml(goal.objective)}${checkpoint}\n</persistent-goal>`
}
