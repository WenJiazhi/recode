import * as React from 'react';
import { Select } from '../../components/CustomSelect/index.js';
import { PermissionDialog } from '../../components/permissions/PermissionDialog.js';
import { Box, Text } from '../../ink.js';
import { formatGoalElapsed, formatGoalStatusLabel } from '../../services/goal/goalState.js';
import type { GoalState } from '../../types/logs.js';

type Props = {
  currentGoal: GoalState;
  newObjective: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function GoalReplaceConfirmDialog({ currentGoal, newObjective, onConfirm, onCancel }: Props): React.ReactNode {
  return (
    <PermissionDialog color="warning" title="Replace active Goal?">
      <Box flexDirection="column" marginTop={1}>
        <Text>Replacing the current Goal resets its progress, budget usage, and continuation counter.</Text>
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Current</Text>
          <Text>{currentGoal.objective}</Text>
          <Text dimColor>
            {formatGoalStatusLabel(currentGoal.status)} · {formatGoalElapsed(currentGoal)} · {currentGoal.tokensUsed}{' '}
            tokens
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>New</Text>
          <Text>{newObjective}</Text>
        </Box>
        <Box marginTop={1}>
          <Select
            options={[
              { label: 'Replace current Goal', value: 'replace' as const },
              { label: 'Keep current Goal', value: 'keep' as const },
            ]}
            onChange={value => (value === 'replace' ? onConfirm() : onCancel())}
            onCancel={onCancel}
          />
        </Box>
      </Box>
    </PermissionDialog>
  );
}
