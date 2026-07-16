import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
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

test('ripgrep command resolves a working binary outside the repository', () => {
  const dir = mkdtempSync(join(tmpdir(), 'recode-ripgrep-'))
  tempDirs.push(dir)

  const ripgrepModuleUrl = pathToFileURL(
    join(process.cwd(), 'src', 'utils', 'ripgrep.ts'),
  ).href
  const result = Bun.spawnSync(
    [
      process.execPath,
      '-e',
      `import { ripgrepCommand } from '${ripgrepModuleUrl}'; console.log(JSON.stringify(ripgrepCommand()));`,
    ],
    {
      cwd: dir,
    },
  )

  expect(result.exitCode).toBe(0)
  const command = JSON.parse(result.stdout.toString().trim()) as {
    rgPath: string
    rgArgs: string[]
    argv0?: string
  }
  const version = Bun.spawnSync(
    [command.rgPath, ...command.rgArgs, '--version'],
    {
      cwd: dir,
      argv0: command.argv0,
    },
  )
  expect(version.exitCode).toBe(0)
  expect(version.stdout.toString()).toContain('ripgrep')
})
