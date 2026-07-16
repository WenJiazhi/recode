import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getProjectRoot, setProjectRoot } from '../../../bootstrap/state.js'
import { call as workflowsCommand } from '../../../commands/workflows/workflows.js'
import type { AppState } from '../../../state/AppState.js'
import type { ToolUseContext } from '../../../Tool.js'
import { WorkflowTool } from '../../../tools/WorkflowTool/WorkflowTool.js'
import { runWithCwdOverride } from '../../../utils/cwd.js'
import {
  _clearOutputsForTest,
  _resetTaskOutputDirForTest,
  getTaskOutputDir,
} from '../../../utils/task/diskOutput.js'
import { resetCommandQueue } from '../../../utils/messageQueueManager.js'
import {
  flushSessionStorage,
  resetProjectForTesting,
  setSessionFileForTesting,
} from '../../../utils/sessionStorage.js'
import { _clearWorkflowControlsForTesting } from '../control.js'
import { _setWorkflowStepRunnerForTesting } from '../service.js'
import { loadWorkflowRun } from '../storage.js'
import { _clearWorkflowStoreForTesting } from '../store.js'

const temporaryPaths: string[] = []
const initialProjectRoot = getProjectRoot()
const initialConfigDir = process.env.CLAUDE_CONFIG_DIR

afterEach(async () => {
  _setWorkflowStepRunnerForTesting()
  _clearWorkflowControlsForTesting()
  _clearWorkflowStoreForTesting()
  resetCommandQueue()
  await _clearOutputsForTest()
  await flushSessionStorage()
  resetProjectForTesting()
  setProjectRoot(initialProjectRoot)
  if (initialConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = initialConfigDir
  await rm(getTaskOutputDir(), { recursive: true, force: true })
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map(path => rm(path, { recursive: true, force: true })),
  )
})

function createContext(): {
  context: ToolUseContext
  getState: () => AppState
} {
  let state = { tasks: {} } as AppState
  const setAppState = (updater: (previous: AppState) => AppState): void => {
    state = updater(state)
  }
  return {
    context: {
      toolUseId: 'template-tool-use',
      getAppState: () => state,
      setAppState,
      setAppStateForTasks: setAppState,
      options: {},
    } as unknown as ToolUseContext,
    getState: () => state,
  }
}

async function waitForTerminalTask(
  getState: () => AppState,
  taskId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const status = getState().tasks[taskId]?.status
    if (status && status !== 'running' && status !== 'pending') return
    await Bun.sleep(2)
  }
  throw new Error(`Workflow task ${taskId} did not finish`)
}

async function writeTemplate(root: string): Promise<string> {
  const directory = join(root, '.recode', 'workflows')
  const filePath = join(directory, 'project-review.json')
  await mkdir(directory, { recursive: true })
  await writeFile(
    filePath,
    JSON.stringify({
      templateVersion: 1,
      name: 'project-review',
      description: 'Review one project target',
      argumentHint: '<target>',
      spec: {
        version: 1,
        name: 'project-review',
        objective: 'Review $ARGUMENTS',
        steps: [
          {
            id: 'inspect',
            title: 'Inspect target',
            prompt: 'Inspect $ARGUMENTS',
          },
        ],
      },
    }),
  )
  return filePath
}

test('Workflow Tool and /workflows run launch validated project templates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-template-launch-'))
  const configDir = await mkdtemp(join(tmpdir(), 'recode-template-config-'))
  temporaryPaths.push(root, configDir)
  const templateFile = await writeTemplate(root)
  setProjectRoot(root)
  process.env.CLAUDE_CONFIG_DIR = configDir
  resetProjectForTesting()
  setSessionFileForTesting(join(configDir, 'session.jsonl'))
  resetCommandQueue()
  _resetTaskOutputDirForTest()
  _clearWorkflowStoreForTesting()
  _clearWorkflowControlsForTesting()

  const prompts: string[] = []
  _setWorkflowStepRunnerForTesting(async ({ step }) => {
    prompts.push(step.prompt)
    return { output: `done:${step.id}`, tokens: 5, toolUses: 1 }
  })
  const { context, getState } = createContext()
  const canUseTool = async () =>
    ({ behavior: 'allow', updatedInput: {} }) as never

  const templateList = await workflowsCommand('templates', {
    ...context,
    canUseTool,
  } as never)
  expect(templateList).toMatchObject({
    type: 'text',
    value: expect.stringContaining('project-review <target>'),
  })

  const toolResult = await runWithCwdOverride(root, () =>
    WorkflowTool.call(
      {
        action: 'launch',
        template_name: 'project-review',
        template_arguments: 'src/auth',
      },
      context,
      canUseTool,
    ),
  )
  const firstTaskId = toolResult.data.task_id
  if (!firstTaskId) throw new Error('Workflow Tool did not return a task ID')
  await waitForTerminalTask(getState, firstTaskId)
  expect(toolResult.data).toMatchObject({
    success: true,
    template_file: templateFile,
  })
  const firstTask = getState().tasks[firstTaskId]
  if (!firstTask || firstTask.type !== 'local_workflow') {
    throw new Error('Workflow Tool did not register a workflow task')
  }
  const firstRun = await loadWorkflowRun(root, firstTask.runId)
  expect(firstRun?.status).toBe('completed')
  expect(firstRun?.spec.objective).toBe('Review src/auth')

  const commandResult = await runWithCwdOverride(root, () =>
    workflowsCommand('run project-review src/tests with spaces', {
      ...context,
      canUseTool,
    } as never),
  )
  expect(commandResult).toMatchObject({
    type: 'text',
    value: expect.stringContaining('project-review launched as task'),
  })
  const secondTask = Object.values(getState().tasks).find(
    task => task.type === 'local_workflow' && task.id !== firstTaskId,
  )
  if (!secondTask || secondTask.type !== 'local_workflow') {
    throw new Error('/workflows run did not register a workflow task')
  }
  await waitForTerminalTask(getState, secondTask.id)
  const secondRun = await loadWorkflowRun(root, secondTask.runId)
  expect(secondRun?.status).toBe('completed')
  expect(secondRun?.spec.objective).toBe('Review src/tests with spaces')
  expect(prompts).toEqual(['Inspect src/auth', 'Inspect src/tests with spaces'])
})
