#!/usr/bin/env bun

import { rgPath } from '@vscode/ripgrep'
import { chmod, copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const defaultName = process.platform === 'win32' ? 'recode.exe' : 'recode'
const outfile = resolve(process.env.RECODE_BINARY_OUT ?? `dist/${defaultName}`)

await mkdir(dirname(outfile), { recursive: true })

async function cleanCompilerArtifacts(): Promise<void> {
  const entries = await readdir(process.cwd())
  await Promise.all(
    entries
      .filter(name => /^\.[0-9a-f]+-[0-9a-f]+\.bun-build$/i.test(name))
      .map(name => rm(resolve(name), { force: true })),
  )
}

await cleanCompilerArtifacts()

const child = Bun.spawn(
  [
    process.execPath,
    'build',
    '--compile',
    '--define',
    'process.env.NODE_ENV="production"',
    '--define',
    'RECODE_STANDALONE=true',
    '--define',
    'RECODE_EMBEDDED_RIPGREP=false',
    `--outfile=${outfile}`,
    'src/entrypoints/cli.tsx',
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  },
)

const exitCode = await child.exited
await cleanCompilerArtifacts()
if (exitCode !== 0) {
  process.exit(exitCode)
}

const ripgrepName = process.platform === 'win32' ? 'recode-rg.exe' : 'recode-rg'
const ripgrepOutfile = resolve(dirname(outfile), ripgrepName)
await copyFile(rgPath, ripgrepOutfile)
await chmod(ripgrepOutfile, 0o755)

console.log(`Standalone binary written to ${outfile}`)
console.log(`Ripgrep binary written to ${ripgrepOutfile}`)
