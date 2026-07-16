#!/usr/bin/env bun

import { chmod, cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import {
  startMockProvider,
  TOOL_RESULT_SENTINEL,
  type MockProviderKind,
  type MockScenario,
} from './provider-e2e/mock-provider.js'

type RuntimeKind = 'source' | 'bundle' | 'binary'

type Runtime = {
  command: string[]
  kind: RuntimeKind
  label: string
}

type RunResult = {
  exitCode: number
  output: string
}

const PROJECT_ROOT = resolve(import.meta.dir, '..')
const API_KEY = 'recode-e2e-local-key'
const TIMEOUT_MS = 30_000

function parseOption(name: string): string | undefined {
  const exactIndex = process.argv.indexOf(name)
  if (exactIndex !== -1) return process.argv[exactIndex + 1]
  const prefix = `${name}=`
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
}

function parseRuntimeKinds(): RuntimeKind[] {
  const value = parseOption('--runtimes')
  const requested = value
    ? value.split(',').map(item => item.trim())
    : ['source', 'bundle']
  const valid = new Set<RuntimeKind>(['source', 'bundle', 'binary'])
  for (const runtime of requested) {
    if (!valid.has(runtime as RuntimeKind)) {
      throw new Error(`Unknown runtime ${JSON.stringify(runtime)}`)
    }
  }
  return [...new Set(requested as RuntimeKind[])]
}

async function resolveRuntimes(): Promise<Runtime[]> {
  const kinds = parseRuntimeKinds()
  const binaryPath = parseOption('--binary')
  const runtimes: Runtime[] = []

  for (const kind of kinds) {
    if (kind === 'source') {
      runtimes.push({
        kind,
        label: 'source CLI',
        command: [process.execPath, join(PROJECT_ROOT, 'src/entrypoints/cli.tsx')],
      })
      continue
    }
    if (kind === 'bundle') {
      const bundle = join(PROJECT_ROOT, 'dist/cli.js')
      if (!(await Bun.file(bundle).exists())) {
        throw new Error('dist/cli.js is missing; run `bun run build` first')
      }
      runtimes.push({
        kind,
        label: 'dist bundle',
        command: [process.execPath, bundle],
      })
      continue
    }
    if (!binaryPath) {
      throw new Error('--binary <path> is required for the binary runtime')
    }
    const absoluteBinary = resolve(binaryPath)
    if (!(await Bun.file(absoluteBinary).exists())) {
      throw new Error(`Installed binary does not exist: ${absoluteBinary}`)
    }
    runtimes.push({
      kind,
      label: `installed binary (${basename(absoluteBinary)})`,
      command: [absoluteBinary],
    })
  }

  return runtimes
}

function cleanEnvironment(): Record<string, string | undefined> {
  const environment = { ...process.env }
  for (const key of Object.keys(environment)) {
    if (
      /^(ANTHROPIC|OPENAI|RECODE_PROVIDER|CLAUDE|AWS_|GOOGLE_|VERTEX_|AZURE_)/.test(
        key,
      ) ||
      /^(HTTP|HTTPS|ALL)_PROXY$/i.test(key)
    ) {
      delete environment[key]
    }
  }
  return environment
}

function providerEnvironment(
  kind: MockProviderKind,
  origin: string,
  home: string,
  expectedModel: string,
): Record<string, string | undefined> {
  const environment = cleanEnvironment()
  Object.assign(environment, {
    CI: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_SIMPLE: '1',
    CLAUDE_CONFIG_DIR: join(home, '.claude'),
    DISABLE_TELEMETRY: '1',
    FORCE_COLOR: '0',
    HOME: home,
    NO_COLOR: '1',
    NO_PROXY: '127.0.0.1,localhost',
    RECODE_TELEMETRY_ENABLED: '0',
  })

  if (kind === 'anthropic') {
    Object.assign(environment, {
      ANTHROPIC_API_KEY: API_KEY,
      ANTHROPIC_BASE_URL: origin,
      ANTHROPIC_DEFAULT_SONNET_MODEL: expectedModel,
    })
  } else {
    Object.assign(environment, {
      OPENAI_API_KEY: API_KEY,
      OPENAI_BASE_URL: `${origin}/v1`,
      OPENAI_DEFAULT_SONNET_MODEL: expectedModel,
      RECODE_PROVIDER_TYPE: 'openai',
    })
  }

  return environment
}

async function runCommand(
  command: string[],
  cwd: string,
  env: Record<string, string | undefined>,
): Promise<RunResult> {
  const child = Bun.spawn(command, {
    cwd,
    env,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    child.kill('SIGKILL')
  }, TIMEOUT_MS)

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  clearTimeout(timeout)

  const output = `${stdout}${stderr}`
  if (timedOut) {
    throw new Error(`CLI timed out after ${TIMEOUT_MS}ms\n${output}`)
  }
  return { exitCode, output }
}

function cliArguments(scenario: MockScenario): string[] {
  return [
    '--print',
    '--bare',
    '--no-session-persistence',
    '--dangerously-skip-permissions',
    '--tools',
    'Read',
    '--model',
    'sonnet',
    '--max-turns',
    scenario === 'flow' ? '3' : '1',
    '--output-format',
    'json',
    '--system-prompt',
    'Follow the mock provider response exactly.',
    'Run the provider protocol verification.',
  ]
}

function expectedError(scenario: MockScenario, kind: MockProviderKind): string {
  return scenario === 'http-error'
    ? `RECODE_PROVIDER_HTTP_ERROR ${kind}`
    : `RECODE_PROVIDER_STREAM_ERROR ${kind}`
}

function assertResult(
  runtime: Runtime,
  kind: MockProviderKind,
  scenario: MockScenario,
  result: RunResult,
): void {
  const label = `${runtime.label} / ${kind} / ${scenario}`
  if (result.output.includes('undefined is not an object')) {
    throw new Error(`${label}: usage handling regressed\n${result.output}`)
  }

  if (scenario === 'flow') {
    if (result.exitCode !== 0) {
      throw new Error(`${label}: exited with ${result.exitCode}\n${result.output}`)
    }
    if (!result.output.includes(`RECODE_PROVIDER_E2E_OK ${kind}`)) {
      throw new Error(`${label}: final text was missing\n${result.output}`)
    }
    return
  }

  const error = expectedError(scenario, kind)
  if (!result.output.includes(error)) {
    throw new Error(`${label}: expected ${JSON.stringify(error)}\n${result.output}`)
  }
  if (result.exitCode === 0) {
    throw new Error(`${label}: provider errors must return a non-zero exit code`)
  }
}

async function runScenario(
  runtime: Runtime,
  kind: MockProviderKind,
  scenario: MockScenario,
  root: string,
): Promise<void> {
  const scenarioRoot = join(root, runtime.kind, kind, scenario)
  const home = join(scenarioRoot, 'home')
  const worktree = join(scenarioRoot, 'worktree')
  await mkdir(home, { recursive: true })
  await mkdir(worktree, { recursive: true })
  const fixtureFile = join(worktree, 'provider-fixture.txt')
  await writeFile(fixtureFile, `${TOOL_RESULT_SENTINEL}\n`, 'utf8')

  const expectedModel = `recode-e2e-${kind}-model`
  const mock = startMockProvider({
    expectedApiKey: API_KEY,
    expectedModel,
    fixtureFile,
    kind,
    scenario,
  })

  try {
    const result = await runCommand(
      [...runtime.command, ...cliArguments(scenario)],
      worktree,
      providerEnvironment(kind, mock.origin, home, expectedModel),
    )
    assertResult(runtime, kind, scenario, result)

    const expectedRequests = scenario === 'flow' ? 2 : 1
    if (mock.requests.length !== expectedRequests) {
      throw new Error(
        `${runtime.label} / ${kind} / ${scenario}: expected ${expectedRequests} provider request(s), received ${mock.requests.length}`,
      )
    }
    if (mock.failures.length > 0) {
      throw new Error(
        `${runtime.label} / ${kind} / ${scenario}: ${mock.failures.join('; ')}`,
      )
    }
  } finally {
    mock.stop()
  }
}

async function stageBinary(binary: Runtime, root: string): Promise<Runtime> {
  const installDir = join(root, 'install', 'bin')
  const installedPath = join(installDir, 'recode')
  await mkdir(installDir, { recursive: true })
  await cp(binary.command[0]!, installedPath)
  await chmod(installedPath, 0o755)
  return {
    kind: 'binary',
    label: `installed binary (${installedPath})`,
    command: [installedPath],
  }
}

async function main(): Promise<void> {
  const runtimes = await resolveRuntimes()
  const root = await mkdtemp(join(tmpdir(), 'recode-provider-e2e-'))
  const scenarios: MockScenario[] = ['flow', 'http-error', 'stream-error']
  const providers: MockProviderKind[] = ['anthropic', 'openai']

  try {
    for (const requestedRuntime of runtimes) {
      const runtime =
        requestedRuntime.kind === 'binary'
          ? await stageBinary(requestedRuntime, root)
          : requestedRuntime
      for (const provider of providers) {
        for (const scenario of scenarios) {
          await runScenario(runtime, provider, scenario, root)
          console.log(`[OK] ${runtime.label} / ${provider} / ${scenario}`)
        }
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }

  console.log(
    `Provider E2E passed for ${runtimes.length} runtime(s), ${providers.length} providers, and ${scenarios.length} scenarios.`,
  )
}

await main()
