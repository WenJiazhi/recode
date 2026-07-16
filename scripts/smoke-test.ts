#!/usr/bin/env bun

import packageJson from '../package.json'

type RunResult = {
  exitCode: number
  output: string
}

async function runCli(...args: string[]): Promise<RunResult> {
  const env = { ...process.env, NODE_ENV: 'production' }
  if (args.includes('/doctor')) {
    delete env.ANTHROPIC_API_KEY
    delete env.CLAUDE_CODE_OAUTH_TOKEN
    delete env.CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR
    env.CI = 'true'
  }
  const child = Bun.spawn([process.execPath, 'dist/cli.js', ...args], {
    cwd: process.cwd(),
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { exitCode, output: `${stdout}${stderr}` }
}

function assertResult(
  label: string,
  result: RunResult,
  expectedText: string,
): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${label} exited with code ${result.exitCode}:\n${result.output}`,
    )
  }
  if (!result.output.includes(expectedText)) {
    throw new Error(`${label} did not include ${JSON.stringify(expectedText)}`)
  }
}

if (!(await Bun.file('dist/cli.js').exists())) {
  throw new Error('dist/cli.js is missing; run `bun run build` first')
}

const version = await runCli('--version')
assertResult('version smoke test', version, `${packageJson.version} (recode)`)

const help = await runCli('--help')
assertResult('help smoke test', help, 'Usage: recode')
assertResult('help options smoke test', help, '--output-format <format>')
assertResult('ACP help smoke test', help, '--acp')

const doctor = await runCli('-p', '/doctor')
assertResult(
  'doctor capability smoke test',
  doctor,
  'Governed optional capabilities:',
)
if (doctor.output.includes('Installation type: development')) {
  throw new Error('production bundle was classified as a development build')
}

console.log('Built CLI smoke test passed (--version, --help, /doctor).')
