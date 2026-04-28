import { describe, expect, it } from 'bun:test'

import {
  buildWindowsTerminalLaunchSpecs,
  type WindowsTerminalLaunchSpec,
} from '../windowsTerminalLaunch.js'

function kinds(specs: WindowsTerminalLaunchSpec[]): string[] {
  return specs.map(spec => spec.kind)
}

describe('buildWindowsTerminalLaunchSpecs', () => {
  it('prefers wt then powershell then cmd when all launchers exist', () => {
    const specs = buildWindowsTerminalLaunchSpecs({
      workingDirectory: 'D:\\Desktop',
      command: 'codex',
      binaries: {
        wt: 'C:\\Program Files\\WindowsApps\\wt.exe',
        powershell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        pwsh: null,
        cmd: 'C:\\Windows\\System32\\cmd.exe',
        outerShell:
          'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      },
    })

    expect(kinds(specs)).toEqual(['wt', 'powershell', 'cmd'])
    expect(specs[0]?.titleHints).toContain('terminal')
    expect(specs[1]?.titleHints).toContain('powershell')
    expect(specs[2]?.titleHints).toContain('cmd')
  })

  it('falls back to powershell then cmd when wt is unavailable', () => {
    const specs = buildWindowsTerminalLaunchSpecs({
      workingDirectory: 'D:\\Desktop',
      command: 'codex',
      binaries: {
        wt: null,
        powershell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        pwsh: null,
        cmd: 'C:\\Windows\\System32\\cmd.exe',
        outerShell:
          'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      },
    })

    expect(kinds(specs)).toEqual(['powershell', 'cmd'])
  })

  it('honors explicit cmd preference while retaining powershell fallback', () => {
    const specs = buildWindowsTerminalLaunchSpecs({
      preferredTerminal: 'cmd',
      workingDirectory: 'D:\\Desktop',
      command: 'codex',
      binaries: {
        wt: null,
        powershell: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        pwsh: null,
        cmd: 'C:\\Windows\\System32\\cmd.exe',
        outerShell:
          'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
      },
    })

    expect(kinds(specs)).toEqual(['cmd', 'powershell'])
  })

  it('returns no specs when no launcher shell is available', () => {
    const specs = buildWindowsTerminalLaunchSpecs({
      workingDirectory: 'D:\\Desktop',
      command: 'codex',
      binaries: {
        wt: 'C:\\Program Files\\WindowsApps\\wt.exe',
        powershell: null,
        pwsh: null,
        cmd: 'C:\\Windows\\System32\\cmd.exe',
        outerShell: null,
      },
    })

    expect(specs).toEqual([])
  })
})
