import * as React from 'react';
import type { LocalJSXCommandCall } from '../../types/command.js';
import { removeByFilter } from '../../utils/messageQueueManager.js';
import { parseGoalCommand } from '../../services/goal/goalCommandParser.js';
import {
  clearGoal,
  completeGoal,
  continueGoalFromMaxTurns,
  formatGoalElapsed,
  formatGoalStatusLabel,
  getGoal,
  MAX_GOAL_CONTINUATIONS,
  pauseGoal,
  recordGoalCheckpoint,
  resumeGoal,
  setGoal,
  updateGoalBudget,
} from '../../services/goal/goalState.js';
import { persistCurrentGoal, persistGoalClear } from '../../services/goal/goalStorage.js';
import { buildObjectiveUpdatedPrompt } from '../../services/goal/prompts.js';
import { GoalReplaceConfirmDialog } from './GoalReplaceConfirmDialog.js';

function drainGoalQueue(): void {
  removeByFilter(command => ['goal-continuation', 'goal-budget-limit'].includes(command.origin ?? ''));
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatGoalStatus(): string {
  const goal = getGoal();
  if (!goal) return 'No Goal is active. Start one with `/goal <objective>`.';

  const lines = [
    `Goal: ${goal.objective}`,
    `Status: ${formatGoalStatusLabel(goal.status)}`,
    `Active time: ${formatGoalElapsed(goal)}`,
    `Tokens: ${formatTokens(goal.tokensUsed)}${
      goal.tokenBudget === null ? '' : ` / ${formatTokens(goal.tokenBudget)}`
    }`,
    `Automatic continuations: ${goal.turnsExecuted} / ${MAX_GOAL_CONTINUATIONS}`,
  ];
  const latest = goal.checkpoints.at(-1);
  if (latest) lines.push(`Latest checkpoint: ${latest.summary}`);
  if (goal.lastStopReason) lines.push(`Last stop reason: ${goal.lastStopReason}`);
  if (goal.status === 'max_turns') {
    lines.push('Run `/goal continue` to reset the continuation safety cap.');
  } else if (goal.status === 'paused' || goal.status === 'blocked' || goal.status === 'usage_limited') {
    lines.push('Run `/goal resume` after the stopping condition is resolved.');
  } else if (goal.status === 'budget_limited') {
    lines.push('Run `/goal budget <tokens|none>` to extend or remove the budget.');
  }
  return lines.join('\n');
}

function setNewGoal(objective: string, tokenBudget: number | null): void {
  setGoal(objective, { tokenBudget });
  persistCurrentGoal();
}

export const call: LocalJSXCommandCall = async (onDone, _context, rawArgs) => {
  const parsed = parseGoalCommand(rawArgs ?? '');

  if (parsed.action === 'error') {
    onDone(parsed.message, { display: 'system' });
    return null;
  }
  if (parsed.action === 'status') {
    onDone(formatGoalStatus(), { display: 'system' });
    return null;
  }
  if (parsed.action === 'clear') {
    const cleared = clearGoal();
    if (cleared) {
      persistGoalClear();
      drainGoalQueue();
    }
    onDone(cleared ? 'Goal cleared.' : 'No Goal is active.', {
      display: 'system',
    });
    return null;
  }
  if (parsed.action === 'pause') {
    const goal = pauseGoal();
    if (goal) {
      persistCurrentGoal();
      drainGoalQueue();
    }
    onDone(goal ? 'Goal paused.' : 'No active Goal can be paused.', {
      display: 'system',
    });
    return null;
  }
  if (parsed.action === 'resume') {
    const goal = resumeGoal();
    if (goal) persistCurrentGoal();
    onDone(goal ? 'Goal resumed.' : 'This Goal cannot be resumed in its current state.', {
      display: 'system',
      shouldQuery: Boolean(goal),
    });
    return null;
  }
  if (parsed.action === 'continue') {
    const goal = continueGoalFromMaxTurns();
    if (goal) persistCurrentGoal();
    onDone(
      goal ? 'Goal continuation counter reset. Resuming work.' : 'The Goal has not reached its continuation limit.',
      { display: 'system', shouldQuery: Boolean(goal) },
    );
    return null;
  }
  if (parsed.action === 'complete') {
    const goal = completeGoal();
    if (goal) {
      persistCurrentGoal();
      drainGoalQueue();
    }
    onDone(goal ? 'Goal marked complete.' : 'No Goal is active.', {
      display: 'system',
    });
    return null;
  }
  if (parsed.action === 'checkpoint') {
    try {
      const goal = recordGoalCheckpoint(parsed.summary);
      if (goal) persistCurrentGoal();
      onDone(goal ? 'Goal checkpoint saved.' : 'Only an active Goal accepts checkpoints.', { display: 'system' });
    } catch (error) {
      onDone(error instanceof Error ? error.message : String(error), {
        display: 'system',
      });
    }
    return null;
  }
  if (parsed.action === 'budget') {
    const before = getGoal();
    const goal = updateGoalBudget(parsed.tokenBudget);
    const resumed = before?.status === 'budget_limited' && goal?.status === 'active';
    if (goal) persistCurrentGoal();
    if (goal && (resumed || goal.status !== 'active')) drainGoalQueue();
    onDone(
      goal
        ? `Goal token budget set to ${
            parsed.tokenBudget === null ? 'unlimited' : formatTokens(parsed.tokenBudget)
          }.${resumed ? ' Resuming work.' : ''}`
        : 'No Goal is active.',
      { display: 'system', shouldQuery: Boolean(resumed) },
    );
    return null;
  }

  const existing = getGoal();
  const apply = () => {
    drainGoalQueue();
    setNewGoal(parsed.objective, parsed.tokenBudget);
    onDone('Goal started.', {
      display: 'system',
      shouldQuery: true,
      metaMessages: [buildObjectiveUpdatedPrompt(parsed.objective, existing?.objective)],
    });
  };

  if (!existing || existing.status === 'complete') {
    apply();
    return null;
  }

  return (
    <GoalReplaceConfirmDialog
      currentGoal={existing}
      newObjective={parsed.objective}
      onConfirm={apply}
      onCancel={() => onDone('Kept the current Goal.', { display: 'system' })}
    />
  );
};
