import { afterEach, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { pathToFileURL } from 'url'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('ripgrep command resolves vendored binary even when cwd is outside the repository', () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-ripgrep-'))
  tempDirs.push(dir)

  const ripgrepModuleUrl = pathToFileURL(
    join(process.cwd(), 'src', 'utils', 'ripgrep.ts'),
  ).href
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `import { ripgrepCommand } from '${ripgrepModuleUrl}'; console.log(JSON.stringify(ripgrepCommand()));`,
    ],
    {
      cwd: dir,
      encoding: 'utf8',
    },
  )

  expect(result.status).toBe(0)
  const command = JSON.parse(result.stdout.trim()) as {
    rgPath: string
    rgArgs: string[]
    argv0?: string
  }
  expect(command.rgPath).toContain(
    'node_modules\\@anthropic-ai\\claude-agent-sdk\\vendor\\ripgrep',
  )
  expect(existsSync(command.rgPath)).toBe(true)
})
