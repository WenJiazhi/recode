#!/usr/bin/env bun

import { existsSync, readFileSync } from 'fs'
import { dirname, extname, resolve } from 'path'
import { parse as parseYaml } from 'yaml'

const root = process.cwd()
const errors: string[] = []

function collect(pattern: string): string[] {
  return [
    ...new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: true, dot: true }),
  ]
}

const markdownFiles = Array.from(
  new Set([
    ...collect('*.md'),
    ...collect('docs/**/*.{md,mdx}'),
    ...collect('.github/**/*.md'),
  ]),
).sort()

function hasLocalTarget(source: string, target: string): boolean {
  const absolute = resolve(root, dirname(source), target)
  const candidates = [absolute]
  if (!extname(absolute)) {
    candidates.push(`${absolute}.md`, `${absolute}.mdx`, resolve(absolute, 'README.md'))
  }
  return candidates.some(candidate => existsSync(candidate))
}

for (const file of markdownFiles) {
  const contents = readFileSync(resolve(root, file), 'utf8')
  for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().split(/\s+/)[0]
    if (target.startsWith('<') && target.endsWith('>')) {
      target = target.slice(1, -1)
    }
    if (
      !target ||
      target.startsWith('#') ||
      /^[a-z][a-z\d+.-]*:/i.test(target)
    ) {
      continue
    }

    const localPath = decodeURIComponent(target.split(/[?#]/, 1)[0])
    if (!hasLocalTarget(file, localPath)) {
      errors.push(`${file}: missing local link target ${target}`)
    }
  }
}

const jsonFiles = [
  'package.json',
  'mint.json',
  ...collect('.recode/*.json'),
]
for (const file of jsonFiles) {
  try {
    JSON.parse(readFileSync(resolve(root, file), 'utf8'))
  } catch (error) {
    errors.push(`${file}: invalid JSON (${String(error)})`)
  }
}

const yamlFiles = [
  ...collect('.github/**/*.{yml,yaml}'),
]
for (const file of yamlFiles) {
  try {
    parseYaml(readFileSync(resolve(root, file), 'utf8'))
  } catch (error) {
    errors.push(`${file}: invalid YAML (${String(error)})`)
  }
}

const mint = JSON.parse(readFileSync(resolve(root, 'mint.json'), 'utf8')) as {
  navigation?: Array<{ pages?: string[] }>
}
for (const group of mint.navigation ?? []) {
  for (const page of group.pages ?? []) {
    if (
      !existsSync(resolve(root, `${page}.md`)) &&
      !existsSync(resolve(root, `${page}.mdx`))
    ) {
      errors.push(`mint.json: missing navigation page ${page}`)
    }
  }
}

if (errors.length > 0) {
  console.error(`Documentation check failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(
  `Documentation check passed (${markdownFiles.length} Markdown, ${jsonFiles.length} JSON, ${yamlFiles.length} YAML files).`,
)
