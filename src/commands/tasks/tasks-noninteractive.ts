import type { LocalCommandCall } from '../../types/command.js'

function formatTaskLine(
  id: string,
  status: string,
  type: string,
  description: string,
): string {
  return `- [${status}] ${description} (${type}, ${id})`
}

export const call: LocalCommandCall = async (_args, context) => {
  const taskEntries = Object.entries(context.getAppState().tasks ?? {})

  if (taskEntries.length === 0) {
    return {
      type: 'text',
      value: 'No background tasks.',
    }
  }

  const sorted = taskEntries.sort((a, b) => {
    const aTask = a[1]
    const bTask = b[1]

    if (aTask.status === 'running' && bTask.status !== 'running') return -1
    if (aTask.status !== 'running' && bTask.status === 'running') return 1

    return (bTask.startTime ?? 0) - (aTask.startTime ?? 0)
  })

  const lines = [
    `Background tasks: ${sorted.length}`,
    '',
    ...sorted.map(([id, task]) =>
      formatTaskLine(id, task.status, task.type, task.description),
    ),
    '',
    'Run `recode /tasks` for the full interactive task manager.',
  ]

  return {
    type: 'text',
    value: lines.join('\n'),
  }
}
