import { describe, expect, test } from 'bun:test';
import { PassThrough } from 'node:stream';
import * as React from 'react';
import stripAnsi from 'strip-ansi';
import type { LocalWorkflowTaskState } from '../../tasks/LocalWorkflowTask/LocalWorkflowTask.js';
import { render } from '../../ink.js';
import { stringWidth } from '../../ink/stringWidth.js';
import { renderToString } from '../../utils/staticRender.js';
import {
  WorkflowDetailDialog,
  WorkflowOverview,
  WorkflowPhases,
} from './WorkflowDetailDialog.js';
import {
  buildWorkflowMonitor,
  buildWorkflowPhaseRows,
  routeWorkflowMonitorKey,
  UNPHASED_WORKFLOW_PHASE,
  windowWorkflowRows,
} from './workflowMonitor.js';

function taskFixture(): LocalWorkflowTaskState {
  return {
    id: 'w12345678',
    type: 'local_workflow',
    status: 'running',
    description: 'Review and apply a change',
    startTime: 1,
    outputFile: '/tmp/recode/tasks/w12345678.output',
    outputOffset: 0,
    notified: false,
    runId: '12345678-aaaa-bbbb-cccc-123456789abc',
    workflowName: 'review-and-apply',
    workflowFile: '/tmp/recode/workflows/review-and-apply.json',
    summary: 'Review and apply a change',
    agentCount: 5,
    completedCount: 1,
    failedCount: 1,
    concurrencyLimit: 2,
    tokenBudget: 20_000,
    totalTokens: 2_000,
    totalToolUses: 7,
    estimatedCostUsd: 0.0123,
    hasUnknownCost: true,
    stepDefinitions: [
      { id: 'scan', title: 'Scan implementation', phase: 'Review', mode: 'read' },
      { id: 'apply', title: 'Apply patch', phase: 'Implement', mode: 'write', isolation: 'worktree' },
      { id: 'verify', title: 'Run verification', phase: 'Verify', mode: 'read' },
      { id: 'report', title: 'Write report', mode: 'read' },
    ],
    steps: {
      scan: {
        id: 'scan',
        status: 'completed',
        attempts: 1,
        tokens: 500,
        toolUses: 2,
        estimatedCostUsd: 0.002,
      },
      apply: {
        id: 'apply',
        status: 'running',
        attempts: 1,
        tokens: 1_200,
        toolUses: 4,
        models: ['model-a'],
        estimatedCostUsd: 0.01,
        hasUnknownCost: true,
        worktrees: [
          {
            slug: 'apply-a1',
            path: '/tmp/recode/worktrees/apply-a1',
            branch: 'recode/workflow/apply-a1',
            sourceHead: 'a'.repeat(40),
            inputTree: 'b'.repeat(40),
            status: 'retained',
            attempt: 1,
            resumeCount: 0,
            createdAt: 2,
          },
          {
            slug: 'apply-old',
            path: '/tmp/recode/worktrees/apply-old',
            branch: 'recode/workflow/apply-old',
            sourceHead: 'c'.repeat(40),
            inputTree: 'd'.repeat(40),
            status: 'cleaned',
            attempt: 1,
            resumeCount: 0,
            createdAt: 1,
          },
        ],
      },
      verify: {
        id: 'verify',
        status: 'failed',
        attempts: 2,
        tokens: 300,
        toolUses: 1,
        error: 'verification failed with a deliberately long diagnostic',
      },
      report: {
        id: 'report',
        status: 'pending',
        attempts: 0,
        tokens: 0,
        toolUses: 0,
      },
      recovered: {
        id: 'recovered',
        status: 'pending',
        attempts: 0,
        tokens: 0,
        toolUses: 0,
      },
    },
  };
}

describe('workflow monitor selectors', () => {
  test('preserves declared order and groups undeclared states under a stable fallback', () => {
    const monitor = buildWorkflowMonitor(taskFixture());

    expect(monitor.steps.map(step => step.id)).toEqual(['scan', 'apply', 'verify', 'report', 'recovered']);
    expect(monitor.phases.map(phase => phase.title)).toEqual([
      'Review',
      'Implement',
      'Verify',
      UNPHASED_WORKFLOW_PHASE,
    ]);
    expect(monitor.phases.at(-1)?.steps.map(step => step.id)).toEqual(['report', 'recovered']);
  });

  test('derives live phase, usage, failure, and retained worktree summaries', () => {
    const monitor = buildWorkflowMonitor(taskFixture());
    const implement = monitor.phases.find(phase => phase.title === 'Implement');
    const verify = monitor.phases.find(phase => phase.title === 'Verify');

    expect(implement).toMatchObject({
      status: 'running',
      running: 1,
      tokens: 1_200,
      toolUses: 4,
      estimatedCostUsd: 0.01,
      hasUnknownCost: true,
    });
    expect(verify).toMatchObject({ status: 'attention', attention: 1 });
    expect(monitor.activeSteps.map(step => step.id)).toEqual(['apply']);
    expect(monitor.attentionSteps.map(step => step.id)).toEqual(['verify']);
    expect(monitor.retainedWorktrees.map(item => item.worktree.slug)).toEqual(['apply-a1']);
  });

  test('windows long phase rows around the selected step', () => {
    const rows = buildWorkflowPhaseRows(buildWorkflowMonitor(taskFixture()));
    const selected = rows.findIndex(row => row.kind === 'step' && row.step.id === 'verify');
    const visible = windowWorkflowRows(rows, selected, 3);

    expect(visible.items).toHaveLength(3);
    expect(visible.start).toBeGreaterThan(0);
    expect(visible.hiddenBefore + visible.items.length + visible.hiddenAfter).toBe(rows.length);
    expect(visible.items.some(row => row.kind === 'step' && row.step.id === 'verify')).toBe(true);
  });

  test('routes view and step controls without exposing hidden selection on overview', () => {
    expect(routeWorkflowMonitorKey('\t', {}, 'overview')).toBe('toggle_view');
    expect(routeWorkflowMonitorKey('', { downArrow: true }, 'overview')).toBeNull();
    expect(routeWorkflowMonitorKey('', { downArrow: true }, 'phases')).toBe('next_step');
    expect(routeWorkflowMonitorKey('s', {}, 'phases')).toBe('skip_step');
    expect(routeWorkflowMonitorKey('r', {}, 'phases')).toBe('retry_step');
    expect(routeWorkflowMonitorKey('x', {}, 'overview')).toBe('stop');
    expect(routeWorkflowMonitorKey('', { leftArrow: true }, 'overview')).toBe('back');
  });
});

describe('workflow monitor terminal rendering', () => {
  test('renders overview and phase data inside a narrow viewport', async () => {
    const monitor = buildWorkflowMonitor(taskFixture());
    const overview = await renderToString(<WorkflowOverview monitor={monitor} columns={52} rows={24} compact />, 52);
    const phases = await renderToString(
      <WorkflowPhases monitor={monitor} selectedStepId="apply" columns={52} rows={24} compact />,
      52,
    );

    expect(overview).toContain('Active workers (1)');
    expect(overview).toContain('Retained worktrees (1)');
    expect(phases).toContain('Review');
    expect(phases).toContain('Apply patch');
    for (const line of `${overview}\n${phases}`.split('\n')) {
      expect(stringWidth(line)).toBeLessThanOrEqual(52);
    }
  });

  test('switches the live dialog to phases and keeps running-step controls wired', async () => {
    const stdin = new PassThrough() as PassThrough & {
      isTTY: boolean;
      setRawMode: (enabled: boolean) => PassThrough;
      ref: () => PassThrough;
      unref: () => PassThrough;
    };
    stdin.isTTY = true;
    stdin.setRawMode = () => stdin;
    stdin.ref = () => stdin;
    stdin.unref = () => stdin;
    const stdout = new PassThrough() as PassThrough & {
      columns: number;
      rows: number;
      isTTY: boolean;
    };
    stdout.columns = 72;
    stdout.rows = 24;
    stdout.isTTY = false;
    let output = '';
    stdout.on('data', chunk => {
      output += chunk.toString();
    });
    const actions: string[] = [];
    const instance = await render(
      <WorkflowDetailDialog
        workflow={taskFixture()}
        onDone={() => actions.push('done')}
        onKill={() => actions.push('kill')}
        onSkipStep={stepId => actions.push(`skip:${stepId}`)}
        onRetryStep={stepId => actions.push(`retry:${stepId}`)}
      />,
      {
        stdin: stdin as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WriteStream,
        patchConsole: false,
        exitOnCtrlC: false,
      },
    );

    try {
      await Bun.sleep(80);
      expect(stripAnsi(output)).toContain('Active workers (1)');

      output = '';
      stdin.write('\t');
      await Bun.sleep(80);
      expect(stripAnsi(output)).toContain('Review');

      stdin.write('s');
      await Bun.sleep(40);
      stdin.write('r');
      await Bun.sleep(40);
      stdin.write('x');
      await Bun.sleep(40);
      expect(actions).toEqual(['skip:apply', 'retry:apply', 'kill']);
    } finally {
      instance.unmount();
      instance.cleanup();
    }
  });
});
