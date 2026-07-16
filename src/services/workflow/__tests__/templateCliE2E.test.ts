import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const installedBinary = process.env.RECODE_WORKFLOW_TEMPLATE_E2E_BINARY

function isolatedEnvironment(home: string): Record<string, string> {
  const environment = { ...process.env } as Record<string, string>
  for (const key of Object.keys(environment)) {
    if (
      /^(ANTHROPIC|OPENAI|RECODE_PROVIDER|CLAUDE|FEATURE_|AWS_|GOOGLE_|VERTEX_|AZURE_|USER_TYPE)/.test(
        key,
      ) ||
      /^(HTTP|HTTPS|ALL)_PROXY$/i.test(key)
    ) {
      delete environment[key]
    }
  }
  return {
    ...environment,
    ANTHROPIC_API_KEY: 'template-cli-e2e-key',
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:9',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'template-cli-e2e-model',
    CI: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CONFIG_DIR: join(home, '.claude'),
    DISABLE_TELEMETRY: '1',
    FORCE_COLOR: '0',
    HOME: home,
    NO_COLOR: '1',
    RECODE_TELEMETRY_ENABLED: '0',
  }
}

test(`${installedBinary ? 'installed binary' : 'source CLI'} lists validated project workflow templates without a Provider request`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'recode-template-cli-e2e-'))
  const home = join(root, 'home')
  const worktree = join(root, 'worktree')
  const directory = join(worktree, '.recode', 'workflows')

  try {
    await mkdir(home, { recursive: true })
    await mkdir(directory, { recursive: true })
    await writeFile(
      join(directory, 'cli-review.json'),
      JSON.stringify({
        templateVersion: 1,
        name: 'cli-review',
        description: 'Review one CLI target',
        argumentHint: '<target>',
        spec: {
          version: 1,
          name: 'cli-review',
          objective: 'Review $ARGUMENTS',
          steps: [
            {
              id: 'inspect',
              title: 'Inspect',
              prompt: 'Inspect $ARGUMENTS',
            },
          ],
        },
      }),
    )

    const projectRoot = resolve(import.meta.dir, '../../../..')
    const command = installedBinary
      ? [resolve(installedBinary)]
      : [process.execPath, join(projectRoot, 'src/entrypoints/cli.tsx')]
    const child = Bun.spawn(
      [
        ...command,
        '--print',
        '--no-session-persistence',
        '--dangerously-skip-permissions',
        '--output-format',
        'text',
        '/workflows templates',
      ],
      {
        cwd: worktree,
        env: isolatedEnvironment(home),
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const timeout = setTimeout(() => child.kill('SIGKILL'), 20_000)
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    clearTimeout(timeout)

    expect(exitCode).toBe(0)
    expect(stderr).not.toContain('ECONNREFUSED')
    expect(stdout).toContain('Workflow templates (.recode/workflows):')
    expect(stdout).toContain('cli-review <target> - Review one CLI target')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
