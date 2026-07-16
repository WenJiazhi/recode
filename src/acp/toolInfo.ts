import type {
  PlanEntry,
  ToolCallContent,
  ToolCallLocation,
  ToolKind,
} from '@agentclientprotocol/sdk'
import { isAbsolute, resolve } from 'node:path'

export type RecodeToolInfo = {
  title: string
  kind: ToolKind
  locations?: ToolCallLocation[]
  content?: ToolCallContent[]
}

function absolutePath(path: unknown, cwd: string): string | undefined {
  if (typeof path !== 'string' || path.length === 0) return undefined
  return isAbsolute(path) ? path : resolve(cwd, path)
}

function shorten(value: string, max = 120): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 3)}...`
}

function location(path: unknown, cwd: string): ToolCallLocation[] | undefined {
  const absolute = absolutePath(path, cwd)
  return absolute ? [{ path: absolute }] : undefined
}

export function getRecodeToolInfo(
  name: string,
  input: Record<string, unknown>,
  cwd: string,
): RecodeToolInfo {
  switch (name) {
    case 'Read': {
      const path = input.file_path ?? input.path
      return {
        title: `Read ${String(path ?? 'file')}`,
        kind: 'read',
        locations: location(path, cwd),
      }
    }
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit': {
      const path = input.file_path ?? input.notebook_path
      return {
        title: `Edit ${String(path ?? 'file')}`,
        kind: 'edit',
        locations: location(path, cwd),
      }
    }
    case 'Write': {
      const path = input.file_path ?? input.path
      const absolute = absolutePath(path, cwd)
      const text = typeof input.content === 'string' ? input.content : ''
      return {
        title: `Write ${String(path ?? 'file')}`,
        kind: 'edit',
        locations: absolute ? [{ path: absolute }] : undefined,
        content: absolute
          ? [{ type: 'diff', path: absolute, oldText: null, newText: text }]
          : undefined,
      }
    }
    case 'Bash':
    case 'Shell':
    case 'PowerShell':
      return {
        title: shorten(String(input.description ?? input.command ?? name)),
        kind: 'execute',
      }
    case 'Glob':
      return {
        title: `Find ${String(input.pattern ?? 'files')}`,
        kind: 'search',
        locations: location(input.path, cwd),
      }
    case 'Grep':
    case 'Search':
      return {
        title: `Search ${String(input.pattern ?? input.query ?? '')}`.trim(),
        kind: 'search',
        locations: location(input.path, cwd),
      }
    case 'WebFetch':
      return {
        title: `Fetch ${String(input.url ?? '')}`.trim(),
        kind: 'fetch',
      }
    case 'WebSearch':
      return {
        title: `Search web for ${String(input.query ?? '')}`.trim(),
        kind: 'fetch',
      }
    case 'ExitPlanMode':
      return { title: 'Finish planning', kind: 'switch_mode' }
    case 'TodoWrite':
    case 'Goal':
    case 'Agent':
    case 'Task':
      return {
        title: shorten(
          String(input.description ?? input.objective ?? input.action ?? name),
        ),
        kind: 'think',
      }
    default:
      return { title: name || 'Unknown tool', kind: 'other' }
  }
}

export function getPlanEntries(
  name: string,
  input: Record<string, unknown>,
): PlanEntry[] | undefined {
  if (name !== 'TodoWrite' || !Array.isArray(input.todos)) return undefined

  return input.todos.flatMap(rawTodo => {
    if (!rawTodo || typeof rawTodo !== 'object') return []
    const todo = rawTodo as Record<string, unknown>
    if (typeof todo.content !== 'string') return []
    const status =
      todo.status === 'in_progress' || todo.status === 'completed'
        ? todo.status
        : 'pending'
    return [
      {
        content: todo.content,
        priority: 'medium' as const,
        status,
      },
    ]
  })
}

export function toolResultContent(
  content: unknown,
): ToolCallContent[] | undefined {
  if (typeof content === 'string') {
    return content.length > 0
      ? [{ type: 'content', content: { type: 'text', text: content } }]
      : undefined
  }
  if (!Array.isArray(content)) return undefined

  const text = content
    .filter(
      (block): block is Record<string, unknown> =>
        Boolean(block) && typeof block === 'object',
    )
    .map(block => (block.type === 'text' ? String(block.text ?? '') : ''))
    .filter(Boolean)
    .join('\n')
  return text
    ? [{ type: 'content', content: { type: 'text', text } }]
    : undefined
}
