#!/usr/bin/env bun

import packageJson from '../package.json'
import { chmod, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const temp = await mkdtemp(join(tmpdir(), 'recode-installer-e2e-'))
const asset = `recode-${process.platform === 'darwin' ? 'darwin' : 'linux'}-${process.arch === 'arm64' ? 'arm64' : 'x64'}.tar.gz`
const archive = join(temp, asset)

async function command(command: string[], env = process.env) {
  const child = Bun.spawn(command, {
    cwd: root,
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

try {
  if (!(await Bun.file(join(root, 'dist/recode')).exists())) {
    throw new Error('dist/recode is missing; run bun run build:binary first')
  }
  const packed = await command([
    'tar',
    '-czf',
    archive,
    '-C',
    join(root, 'dist'),
    'recode',
    'recode-rg',
  ])
  if (packed.exitCode !== 0) throw new Error(packed.output)

  const bytes = await Bun.file(archive).arrayBuffer()
  const digest = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  const checksums = `${digest}  ${asset}\n`
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname
      if (path === `/good/${asset}`) return new Response(bytes)
      if (path === '/good/checksums.txt') return new Response(checksums)
      if (path === `/bad/${asset}`) return new Response(bytes)
      if (path === '/bad/checksums.txt') {
        return new Response(`${'0'.repeat(64)}  ${asset}\n`)
      }
      return new Response('not found', { status: 404 })
    },
  })

  try {
    const installDir = join(temp, 'installed', 'bin')
    const good = await command(['sh', 'install.sh'], {
      ...process.env,
      RECODE_DOWNLOAD_BASE_URL: `${server.url}good`,
      RECODE_INSTALL_DIR: installDir,
    })
    if (good.exitCode !== 0) throw new Error(good.output)
    const installed = join(installDir, 'recode')
    const installedRipgrep = join(installDir, 'recode-rg')
    await chmod(installed, 0o755)
    await chmod(installedRipgrep, 0o755)
    const version = await command([installed, '--version'])
    if (
      version.exitCode !== 0 ||
      !version.output.includes(`${packageJson.version} (recode)`)
    ) {
      throw new Error(`Installed binary version check failed:\n${version.output}`)
    }
    const ripgrepVersion = await command([installedRipgrep, '--version'])
    if (
      ripgrepVersion.exitCode !== 0 ||
      !ripgrepVersion.output.includes('ripgrep')
    ) {
      throw new Error(
        `Installed ripgrep version check failed:\n${ripgrepVersion.output}`,
      )
    }

    const badDir = join(temp, 'bad-install')
    await mkdir(badDir, { recursive: true })
    const bad = await command(['sh', 'install.sh'], {
      ...process.env,
      RECODE_DOWNLOAD_BASE_URL: `${server.url}bad`,
      RECODE_INSTALL_DIR: badDir,
    })
    if (bad.exitCode === 0 || !bad.output.includes('Checksum verification failed')) {
      throw new Error('Installer accepted an invalid checksum')
    }
    await writeFile(join(temp, 'installer-e2e.ok'), 'ok\n')
  } finally {
    server.stop(true)
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}

console.log('Installer E2E passed (curl download, install, and checksum rejection).')
