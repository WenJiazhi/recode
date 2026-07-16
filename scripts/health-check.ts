#!/usr/bin/env bun

const DIVIDER = '-'.repeat(64)

type MetricStatus = 'ok' | 'warn' | 'error' | 'info'

type Metric = {
  label: string
  value: string | number
  status: MetricStatus
}

type CommandResult = {
  exitCode: number
  output: string
}

const metrics: Metric[] = []

function add(
  label: string,
  value: string | number,
  status: MetricStatus = 'info',
): void {
  metrics.push({ label, value, status })
}

function icon(status: MetricStatus): string {
  switch (status) {
    case 'ok':
      return '[OK]'
    case 'warn':
      return '[!!]'
    case 'error':
      return '[XX]'
    case 'info':
      return '[--]'
  }
}

async function runScript(script: string): Promise<CommandResult> {
  const child = Bun.spawn([process.execPath, 'run', script], {
    cwd: process.cwd(),
    env: process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { exitCode, output: `${stdout}\n${stderr}` }
}

async function checkCodeSize(): Promise<void> {
  const files: string[] = []
  const glob = new Bun.Glob('**/*.{ts,tsx}')
  for await (const file of glob.scan({ cwd: 'src', onlyFiles: true })) {
    files.push(`src/${file}`)
  }

  let lines = 0
  for (const file of files) {
    const text = await Bun.file(file).text()
    lines += text.length === 0 ? 0 : text.split('\n').length
  }

  add('TypeScript files', files.length)
  add('Source lines (src/)', lines)
}

async function checkCoreScript(
  script: 'lint' | 'typecheck' | 'build',
  label: string,
): Promise<CommandResult> {
  const result = await runScript(script)
  add(
    label,
    result.exitCode === 0 ? 'passed' : `failed (run: bun run ${script})`,
    result.exitCode === 0 ? 'ok' : 'error',
  )
  return result
}

async function checkTests(): Promise<void> {
  const result = await runScript('test')
  const summary = result.output.match(
    /All (\d+) tests across (\d+) files passed\./,
  )

  if (result.exitCode !== 0) {
    add('Tests', 'failed (run: bun run test)', 'error')
    return
  }

  add(
    'Tests',
    summary ? `${summary[1]} across ${summary[2]} files` : 'passed',
    'ok',
  )
}

async function checkStaticAudit(): Promise<void> {
  const result = await runScript('check:unused')
  const summary = result.output.match(
    /Optional capability audit passed: (\d+) unresolved imports, (\d+) retained files, (\d+) external binary uses, (\d+) runtime dependency exception\./,
  )

  add(
    'Optional capability audit',
    result.exitCode === 0
      ? summary
        ? `${summary[1]} imports / ${summary[2]} files / ${summary[3]} binaries / ${summary[4]} dependency`
        : 'passed'
      : 'failed (run: bun run check:unused)',
    result.exitCode === 0 ? 'ok' : 'error',
  )
}

async function checkBuild(): Promise<void> {
  const result = await checkCoreScript('build', 'Build')
  if (result.exitCode !== 0) return

  const bundle = Bun.file('dist/cli.js')
  add('Bundle size (dist/cli.js)', `${(bundle.size / 1024 / 1024).toFixed(1)} MB`)

  await checkCoreScript('test:smoke', 'Built CLI smoke test')
  await checkCoreScript('test:provider-e2e', 'Offline Provider E2E')
  await checkCoreScript('test:acp-e2e', 'ACP subprocess E2E')
  await checkCoreScript('test:installer', 'Release installer E2E')
}

console.log('')
console.log(DIVIDER)
console.log('  Recode health report')
console.log(`  ${new Date().toISOString()}`)
console.log(DIVIDER)

await checkCodeSize()
await checkCoreScript('lint', 'Lint')
await checkCoreScript('typecheck', 'Typecheck')
await checkCoreScript('check:docs', 'Docs and config')
await checkTests()
await checkStaticAudit()
await checkBuild()

console.log('')
for (const metric of metrics) {
  console.log(
    `  ${icon(metric.status)}  ${metric.label.padEnd(30)} ${metric.value}`,
  )
}

const errors = metrics.filter(metric => metric.status === 'error').length
const warnings = metrics.filter(metric => metric.status === 'warn').length

console.log('')
console.log(DIVIDER)
if (errors > 0) {
  console.log(`  Result: ${errors} core check(s) failed; ${warnings} advisory finding(s).`)
} else if (warnings > 0) {
  console.log(`  Result: core checks passed; ${warnings} advisory finding(s) need review.`)
} else {
  console.log('  Result: all core checks passed; no static audit findings.')
}
console.log(DIVIDER)
console.log('')

process.exit(errors > 0 ? 1 : 0)
