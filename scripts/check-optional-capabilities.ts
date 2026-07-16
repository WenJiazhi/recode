#!/usr/bin/env bun

import { resolve } from 'path'
import {
  OPTIONAL_CAPABILITIES,
  type OptionalCapability,
} from '../src/constants/optionalCapabilities.js'

type KnipSymbol = { name: string }

type KnipFileIssues = {
  file: string
  binaries?: KnipSymbol[]
  dependencies?: KnipSymbol[]
  devDependencies?: KnipSymbol[]
  files?: KnipSymbol[]
  optionalPeerDependencies?: KnipSymbol[]
  unlisted?: KnipSymbol[]
  unresolved?: KnipSymbol[]
}

type KnipReport = {
  issues: KnipFileIssues[]
}

type AuditKind =
  | 'retained file'
  | 'unresolved import'
  | 'external binary use'
  | 'runtime dependency exception'

type ExpectedFinding = {
  capabilityId: string
  kind: AuditKind
}

const separator = '\u0000'
const expected = {
  files: new Map<string, ExpectedFinding>(),
  unresolved: new Map<string, ExpectedFinding>(),
  binaries: new Map<string, ExpectedFinding>(),
  devDependencies: new Map<string, ExpectedFinding>(),
}

const duplicateContracts: string[] = []

function addExpected(
  collection: Map<string, ExpectedFinding>,
  key: string,
  capability: OptionalCapability,
  kind: AuditKind,
): void {
  const previous = collection.get(key)
  if (previous) {
    duplicateContracts.push(
      `${kind} ${formatKey(key)} is owned by both ${previous.capabilityId} and ${capability.id}`,
    )
    return
  }
  collection.set(key, { capabilityId: capability.id, kind })
}

for (const capability of OPTIONAL_CAPABILITIES) {
  for (const file of capability.audit?.retainedFiles ?? []) {
    addExpected(expected.files, file, capability, 'retained file')
  }
  for (const reference of capability.audit?.unresolvedImports ?? []) {
    addExpected(
      expected.unresolved,
      `${reference.importer}${separator}${reference.specifier}`,
      capability,
      'unresolved import',
    )
  }
  for (const reference of capability.audit?.externalBinaryUses ?? []) {
    addExpected(
      expected.binaries,
      `${reference.source}${separator}${reference.binary}`,
      capability,
      'external binary use',
    )
  }
  for (const dependency of
    capability.audit?.runtimeDependencyExceptions ?? []) {
    addExpected(
      expected.devDependencies,
      `package.json${separator}${dependency}`,
      capability,
      'runtime dependency exception',
    )
  }
}

if (duplicateContracts.length > 0) {
  fail('Capability audit contract contains duplicate ownership:', duplicateContracts)
}

const knipEntrypoint = resolve('node_modules/knip/bin/knip-bun.js')
const child = Bun.spawn(
  [
    process.execPath,
    knipEntrypoint,
    '--include',
    'files,dependencies,unlisted,binaries,unresolved',
    '--reporter',
    'json',
    '--no-exit-code',
    '--no-config-hints',
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    stdout: 'pipe',
    stderr: 'pipe',
  },
)

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
  child.exited,
])

if (exitCode !== 0) {
  fail('Knip could not produce the optional capability audit.', [
    stderr.trim() || `knip exited with code ${exitCode}`,
  ])
}

let report: KnipReport
try {
  report = JSON.parse(stdout) as KnipReport
} catch (error) {
  fail('Knip returned invalid JSON.', [String(error), stdout.slice(0, 500)])
}

const actual = {
  files: new Set<string>(),
  unresolved: new Set<string>(),
  binaries: new Set<string>(),
  devDependencies: new Set<string>(),
}
const unsupportedFindings: string[] = []

for (const issue of report.issues) {
  for (const item of issue.files ?? []) actual.files.add(item.name)
  for (const item of issue.unresolved ?? []) {
    actual.unresolved.add(`${issue.file}${separator}${item.name}`)
  }
  for (const item of issue.binaries ?? []) {
    actual.binaries.add(`${issue.file}${separator}${item.name}`)
  }
  for (const item of issue.devDependencies ?? []) {
    actual.devDependencies.add(`${issue.file}${separator}${item.name}`)
  }
  for (const item of issue.dependencies ?? []) {
    unsupportedFindings.push(`unused dependency ${item.name} in ${issue.file}`)
  }
  for (const item of issue.optionalPeerDependencies ?? []) {
    unsupportedFindings.push(
      `unused optional peer dependency ${item.name} in ${issue.file}`,
    )
  }
  for (const item of issue.unlisted ?? []) {
    unsupportedFindings.push(`unlisted dependency ${item.name} in ${issue.file}`)
  }
}

const mismatches = [...unsupportedFindings]
compareContract('retained file', expected.files, actual.files, mismatches)
compareContract(
  'unresolved import',
  expected.unresolved,
  actual.unresolved,
  mismatches,
)
compareContract(
  'external binary use',
  expected.binaries,
  actual.binaries,
  mismatches,
)
compareContract(
  'runtime dependency exception',
  expected.devDependencies,
  actual.devDependencies,
  mismatches,
)

if (mismatches.length > 0) {
  fail('Optional capability audit contract is out of date:', mismatches)
}

console.log(
  [
    'Optional capability audit passed:',
    `${actual.unresolved.size} unresolved imports,`,
    `${actual.files.size} retained files,`,
    `${actual.binaries.size} external binary uses,`,
    `${actual.devDependencies.size} runtime dependency exception.`,
  ].join(' '),
)

function compareContract(
  label: AuditKind,
  expectedFindings: Map<string, ExpectedFinding>,
  actualFindings: Set<string>,
  errors: string[],
): void {
  for (const key of actualFindings) {
    if (!expectedFindings.has(key)) {
      errors.push(`unregistered ${label}: ${formatKey(key)}`)
    }
  }

  for (const [key, owner] of expectedFindings) {
    if (!actualFindings.has(key)) {
      errors.push(
        `stale ${label} contract: ${formatKey(key)} (${owner.capabilityId})`,
      )
    }
  }
}

function formatKey(key: string): string {
  return key.split(separator).join(' -> ')
}

function fail(message: string, details: string[]): never {
  console.error(message)
  for (const detail of details.filter(Boolean)) console.error(`- ${detail}`)
  process.exit(1)
}
