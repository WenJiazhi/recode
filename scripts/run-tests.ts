#!/usr/bin/env bun

const roots = ['src', 'packages']
const patterns = ['**/*.test.ts', '**/*.test.tsx']
const testFiles = new Set<string>()

for (const root of roots) {
  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern)
    for await (const file of glob.scan({ cwd: root, onlyFiles: true })) {
      testFiles.add(`${root}/${file}`)
    }
  }
}

const files = [...testFiles].sort()
if (files.length === 0) {
  console.error('No test files found under src/ or packages/.')
  process.exit(1)
}

let failedFiles = 0
let passedTests = 0
for (const [index, file] of files.entries()) {
  console.log(`\n[${index + 1}/${files.length}] ${file}`)
  const child = Bun.spawn([process.execPath, 'test', file], {
    cwd: process.cwd(),
    env: process.env,
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  process.stdout.write(stdout)
  process.stderr.write(stderr)

  const summary = `${stdout}\n${stderr}`.match(/\n\s*(\d+) pass\s*\n\s*(\d+) fail/)
  if (summary) passedTests += Number(summary[1])
  if (exitCode !== 0) failedFiles++
}

if (failedFiles > 0) {
  console.error(`\n${failedFiles} test file(s) failed.`)
  process.exit(1)
}

console.log(`\nAll ${passedTests} tests across ${files.length} files passed.`)
