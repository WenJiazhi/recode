import * as React from 'react';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Box, Text, useInput } from '../../ink.js';
import type { LocalWorkflowTaskState } from '../../tasks/LocalWorkflowTask/LocalWorkflowTask.js';
import type { DeepImmutable } from '../../types/utils.js';
import { formatTokens } from '../../utils/format.js';
import { truncateToWidth } from '../../utils/truncate.js';
import { Byline } from '../design-system/Byline.js';
import { Dialog } from '../design-system/Dialog.js';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js';
import { Tab, Tabs } from '../design-system/Tabs.js';
import {
  buildWorkflowMonitor,
  buildWorkflowPhaseRows,
  type WorkflowMonitor,
  type WorkflowMonitorPhaseStatus,
  type WorkflowMonitorStep,
  type WorkflowMonitorTab,
  routeWorkflowMonitorKey,
  windowWorkflowRows,
} from './workflowMonitor.js';

type Props = {
  workflow: DeepImmutable<LocalWorkflowTaskState>;
  onDone: () => void;
  onKill?: () => void;
  onSkipStep?: (stepId: string) => void;
  onRetryStep?: (stepId: string) => void;
  onBack?: () => void;
};

function statusColor(status: string): 'success' | 'error' | 'warning' | undefined {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'skipped' || status === 'cancelled') return 'warning';
  return undefined;
}

function statusMark(status: string): string {
  if (status === 'running') return '●';
  if (status === 'completed') return '✓';
  if (status === 'pending') return '○';
  return '×';
}

function phaseMark(status: WorkflowMonitorPhaseStatus): string {
  if (status === 'running') return '●';
  if (status === 'completed') return '✓';
  if (status === 'pending') return '○';
  return '×';
}

function phaseColor(status: WorkflowMonitorPhaseStatus): 'success' | 'error' | 'warning' | undefined {
  if (status === 'completed') return 'success';
  if (status === 'attention') return 'error';
  if (status === 'running') return 'warning';
  return undefined;
}

function formatCost(value: number, incomplete: boolean): string {
  return `$${value.toFixed(4)}${incomplete ? '+' : ''}`;
}

function stepLabel(step: WorkflowMonitorStep): string {
  return step.title === step.id ? step.id : `${step.title} [${step.id}]`;
}

export function WorkflowOverview({
  monitor,
  columns,
  rows,
  compact,
}: {
  monitor: WorkflowMonitor;
  columns: number;
  rows: number;
  compact: boolean;
}): React.ReactNode {
  const contentWidth = Math.max(12, columns - 10);
  const maxItems = Math.max(1, Math.min(3, Math.floor((rows - 13) / 3)));
  const active = monitor.activeSteps.slice(0, maxItems);
  const attention = monitor.attentionSteps.slice(0, maxItems);
  const retained = monitor.retainedWorktrees.slice(0, maxItems);

  return (
    <Box flexDirection="column">
      <Text bold>Progress</Text>
      <Text>
        {monitor.completed} completed · {monitor.running} active · {monitor.pending} waiting · {monitor.attention}{' '}
        attention
      </Text>

      <Text bold>Active workers ({monitor.activeSteps.length})</Text>
      {active.length === 0 ? (
        <Text dimColor> No steps are running</Text>
      ) : (
        active.map(step => {
          const model = step.state.models?.at(-1);
          const details = compact
            ? `${formatTokens(step.state.tokens)} tok`
            : `${model ? `${model} · ` : ''}${formatTokens(step.state.tokens)} tok · ${step.state.toolUses} tools`;
          return (
            <Text key={step.id} color="warning">
              {truncateToWidth(`  ● ${stepLabel(step)} · ${details}`, contentWidth)}
            </Text>
          );
        })
      )}
      {monitor.activeSteps.length > active.length && (
        <Text dimColor> +{monitor.activeSteps.length - active.length} more active</Text>
      )}

      <Text bold>Attention ({monitor.attentionSteps.length})</Text>
      {attention.length === 0 ? (
        <Text dimColor> No failed, skipped, or cancelled steps</Text>
      ) : (
        attention.map(step => (
          <Text key={step.id} color={statusColor(step.state.status)}>
            {truncateToWidth(
              `  ${statusMark(step.state.status)} ${stepLabel(step)} · ${step.state.status}${step.state.error ? ` · ${step.state.error}` : ''}`,
              contentWidth,
            )}
          </Text>
        ))
      )}
      {monitor.attentionSteps.length > attention.length && (
        <Text dimColor> +{monitor.attentionSteps.length - attention.length} more</Text>
      )}

      <Text bold>Retained worktrees ({monitor.retainedWorktrees.length})</Text>
      {retained.length === 0 ? (
        <Text dimColor> None</Text>
      ) : (
        retained.map(item => (
          <Text key={`${item.stepId}:${item.worktree.slug}`} color="warning">
            {truncateToWidth(`  ${item.stepTitle} · ${item.worktree.slug} · ${item.worktree.path}`, contentWidth)}
          </Text>
        ))
      )}
      {monitor.retainedWorktrees.length > retained.length && (
        <Text dimColor> +{monitor.retainedWorktrees.length - retained.length} more retained</Text>
      )}
    </Box>
  );
}

export function WorkflowPhases({
  monitor,
  selectedStepId,
  columns,
  rows,
  compact,
}: {
  monitor: WorkflowMonitor;
  selectedStepId?: string;
  columns: number;
  rows: number;
  compact: boolean;
}): React.ReactNode {
  const allRows = buildWorkflowPhaseRows(monitor);
  const selectedRow = allRows.findIndex(row => row.kind === 'step' && row.step.id === selectedStepId);
  const rowLimit = Math.max(3, Math.min(18, rows - 13));
  const visible = windowWorkflowRows(allRows, selectedRow < 0 ? 0 : selectedRow, rowLimit);
  const contentWidth = Math.max(12, columns - 10);

  if (allRows.length === 0) return <Text dimColor>No workflow steps</Text>;

  return (
    <Box flexDirection="column">
      {visible.hiddenBefore > 0 && <Text dimColor> ↑ {visible.hiddenBefore} rows hidden</Text>}
      {visible.items.map(row => {
        if (row.kind === 'phase') {
          const phase = row.phase;
          const metrics = compact
            ? `${phase.completed}/${phase.total}${phase.running > 0 ? ` · ${phase.running} active` : ''}`
            : `${phase.completed}/${phase.total} · ${formatTokens(phase.tokens)} tok · ${phase.toolUses} tools · ${formatCost(phase.estimatedCostUsd, phase.hasUnknownCost)}`;
          return (
            <Text key={`phase:${phase.title}`} bold color={phaseColor(phase.status)}>
              {truncateToWidth(`${phaseMark(phase.status)} ${phase.title} · ${metrics}`, contentWidth)}
            </Text>
          );
        }

        const step = row.step;
        const selected = step.id === selectedStepId;
        const model = step.state.models?.at(-1);
        const metadata = compact
          ? `${step.state.status} · ${formatTokens(step.state.tokens)} tok`
          : `${step.state.status} · ${model ? `${model} · ` : ''}${formatTokens(step.state.tokens)} tok · ${step.state.toolUses} tools${step.isolation ? ` · ${step.isolation}` : ''}`;
        return (
          <Text key={`step:${step.id}`} color={statusColor(step.state.status)}>
            {truncateToWidth(
              `${selected ? '›' : ' '} ${statusMark(step.state.status)} ${stepLabel(step)} · ${metadata}`,
              contentWidth,
            )}
          </Text>
        );
      })}
      {visible.hiddenAfter > 0 && <Text dimColor> ↓ {visible.hiddenAfter} rows hidden</Text>}
    </Box>
  );
}

export function WorkflowDetailDialog({
  workflow,
  onDone,
  onKill,
  onSkipStep,
  onRetryStep,
  onBack,
}: Props): React.ReactNode {
  const { columns, rows } = useTerminalSize();
  const compact = columns < 84;
  const monitor = React.useMemo(() => buildWorkflowMonitor(workflow), [workflow]);
  const [activeTab, setActiveTab] = React.useState<WorkflowMonitorTab>('overview');
  const [selectedStepId, setSelectedStepId] = React.useState<string | undefined>(
    () => monitor.activeSteps[0]?.id ?? monitor.steps[0]?.id,
  );
  const selectedIndex = Math.max(
    0,
    monitor.steps.findIndex(step => step.id === selectedStepId),
  );
  const selectedStep = monitor.steps[selectedIndex];
  const tokenUsage =
    workflow.tokenBudget === null
      ? `${formatTokens(workflow.totalTokens)} tokens`
      : `${formatTokens(workflow.totalTokens)}/${formatTokens(workflow.tokenBudget)} tokens`;
  const cost = formatCost(workflow.estimatedCostUsd, workflow.hasUnknownCost);
  const subtitle = compact
    ? `${workflow.completedCount}/${workflow.agentCount} steps · ${tokenUsage} · ${cost}`
    : `${workflow.completedCount}/${workflow.agentCount} steps · ${tokenUsage} · ${cost} est. · c${workflow.concurrencyLimit} · ${workflow.totalToolUses} tools`;

  const moveSelection = (offset: number): void => {
    if (monitor.steps.length === 0) return;
    const next = (selectedIndex + offset + monitor.steps.length) % monitor.steps.length;
    setSelectedStepId(monitor.steps[next]?.id);
  };

  useInput((input, key) => {
    const action = routeWorkflowMonitorKey(input, key, activeTab);
    if (action === 'toggle_view') {
      setActiveTab(tab => (tab === 'overview' ? 'phases' : 'overview'));
    } else if (action === 'previous_step') moveSelection(-1);
    else if (action === 'next_step') moveSelection(1);
    else if (action === 'skip_step' && selectedStep?.state.status === 'running' && onSkipStep) {
      onSkipStep(selectedStep.id);
    } else if (action === 'retry_step' && selectedStep?.state.status === 'running' && onRetryStep) {
      onRetryStep(selectedStep.id);
    } else if (action === 'close') onDone();
    else if (action === 'back' && onBack) onBack();
    else if (action === 'stop' && workflow.status === 'running' && onKill) onKill();
  });

  return (
    <Dialog
      title={workflow.workflowName}
      subtitle={subtitle}
      color="permission"
      onCancel={onDone}
      inputGuide={() => (
        <Byline>
          {onBack && <KeyboardShortcutHint shortcut="←" action="go back" />}
          <KeyboardShortcutHint shortcut="Tab" action="switch view" />
          {activeTab === 'phases' && monitor.steps.length > 1 && (
            <KeyboardShortcutHint shortcut="↑/↓" action="select" />
          )}
          {activeTab === 'phases' && selectedStep?.state.status === 'running' && onSkipStep && (
            <KeyboardShortcutHint shortcut="s" action="skip step" />
          )}
          {activeTab === 'phases' && selectedStep?.state.status === 'running' && onRetryStep && (
            <KeyboardShortcutHint shortcut="r" action="retry step" />
          )}
          <KeyboardShortcutHint shortcut="Esc/Enter" action="close" />
          {workflow.status === 'running' && onKill && <KeyboardShortcutHint shortcut="x" action="stop" />}
        </Byline>
      )}
    >
      <Tabs color="permission" selectedTab={activeTab} disableNavigation>
        <Tab key="overview" id="overview" title="Overview">
          <WorkflowOverview monitor={monitor} columns={columns} rows={rows} compact={compact} />
        </Tab>
        <Tab key="phases" id="phases" title="Phases">
          <WorkflowPhases
            monitor={monitor}
            selectedStepId={selectedStep?.id}
            columns={columns}
            rows={rows}
            compact={compact}
          />
        </Tab>
      </Tabs>
      {workflow.error && <Text color="error">{truncateToWidth(workflow.error, Math.max(12, columns - 10))}</Text>}
      <Text dimColor>
        {truncateToWidth(
          `Run ${workflow.runId.slice(0, 8)} · output ${workflow.outputFile}`,
          Math.max(12, columns - 10),
        )}
      </Text>
    </Dialog>
  );
}
