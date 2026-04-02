import type { LocalCommandCall } from '../../types/command.js'
import { fetchGitDiff } from '../../utils/gitDiff.js'
import { getIsGit } from '../../utils/git.js'

function formatFileLine(
  filePath: string,
  linesAdded: number,
  linesRemoved: number,
  flags: string[],
): string {
  const stats =
    linesAdded === 0 && linesRemoved === 0
      ? ''
      : ` (+${linesAdded} -${linesRemoved})`
  const suffix = flags.length > 0 ? ` [${flags.join(', ')}]` : ''
  return `- ${filePath}${stats}${suffix}`
}

export const call: LocalCommandCall = async () => {
  if (!(await getIsGit())) {
    return {
      type: 'text',
      value: 'Not in a git repository.',
    }
  }

  const diff = await fetchGitDiff()
  if (!diff || diff.stats.filesCount === 0) {
    return {
      type: 'text',
      value: 'Working tree is clean.',
    }
  }

  const lines = [
    'Uncommitted changes (git diff HEAD):',
    `${diff.stats.filesCount} files changed, +${diff.stats.linesAdded} -${diff.stats.linesRemoved}`,
  ]

  if (diff.perFileStats.size === 0) {
    lines.push(
      '',
      'Per-file details omitted because the diff is too large for headless output.',
      'Run `recode /diff` for the full interactive diff view.',
    )
    return {
      type: 'text',
      value: lines.join('\n'),
    }
  }

  lines.push('', 'Files:')

  for (const [filePath, fileStats] of diff.perFileStats) {
    const flags: string[] = []
    if (fileStats.isBinary) flags.push('binary')
    if (fileStats.isUntracked) flags.push('untracked')

    lines.push(
      formatFileLine(filePath, fileStats.added, fileStats.removed, flags),
    )
  }

  lines.push('', 'Run `recode /diff` for the full interactive diff view.')

  return {
    type: 'text',
    value: lines.join('\n'),
  }
}
