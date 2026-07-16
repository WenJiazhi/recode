import { which } from '../which.js'

export type WindowsTerminalKind = 'wt' | 'powershell' | 'cmd'

type WindowsTerminalBinaries = {
  wt: string | null
  powershell: string | null
  pwsh: string | null
  cmd: string
  outerShell: string | null
}

export type WindowsTerminalLaunchSpec = {
  kind: WindowsTerminalKind
  launcherShell: string
  startProcessScript: string
  titleHints: string[]
}

function quotePowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function encodePowerShellCommand(value: string): string {
  return Buffer.from(value, 'utf16le').toString('base64')
}

function buildStartProcessScript(filePath: string, args: string[]): string {
  const serializedArgs = args.map(quotePowerShellString).join(', ')
  return `Start-Process -FilePath ${quotePowerShellString(filePath)} -ArgumentList @(${serializedArgs})`
}

function getCommandTitleHint(command: string): string | null {
  const token = command.trim().split(/\s+/)[0]?.trim().toLowerCase()
  return token ? token.replace(/[^\w.-]/g, '') : null
}

export function buildWindowsTerminalLaunchSpecs(opts: {
  preferredTerminal?: WindowsTerminalKind
  workingDirectory: string
  command: string
  binaries: WindowsTerminalBinaries
}): WindowsTerminalLaunchSpec[] {
  const { preferredTerminal, workingDirectory, command, binaries } = opts
  const launcherShell = binaries.outerShell
  if (!launcherShell) return []

  const commandHint = getCommandTitleHint(command)
  const commandHints = commandHint ? [commandHint] : []
  const psBinary = binaries.powershell ?? binaries.pwsh
  const powershellPayload = encodePowerShellCommand(
    `Set-Location -LiteralPath ${quotePowerShellString(workingDirectory)}; ${command}`,
  )
  const cmdPayload = `cd /d "${workingDirectory.replace(/"/g, '""')}" && ${command}`

  const specs: Record<WindowsTerminalKind, WindowsTerminalLaunchSpec | null> = {
    wt: binaries.wt
      ? {
          kind: 'wt',
          launcherShell,
          startProcessScript: buildStartProcessScript(binaries.wt, [
            '-d',
            workingDirectory,
            'powershell',
            '-NoExit',
            '-EncodedCommand',
            powershellPayload,
          ]),
          titleHints: ['terminal', 'powershell', 'pwsh', ...commandHints],
        }
      : null,
    powershell: psBinary
      ? {
          kind: 'powershell',
          launcherShell,
          startProcessScript: buildStartProcessScript(psBinary, [
            '-NoExit',
            '-EncodedCommand',
            powershellPayload,
          ]),
          titleHints: ['powershell', 'pwsh', ...commandHints],
        }
      : null,
    cmd: {
      kind: 'cmd',
      launcherShell,
      startProcessScript: buildStartProcessScript(binaries.cmd, [
        '/K',
        cmdPayload,
      ]),
      titleHints: ['cmd', 'command prompt', ...commandHints],
    },
  }

  const order: WindowsTerminalKind[] =
    preferredTerminal === 'powershell'
      ? ['powershell', 'cmd']
      : preferredTerminal === 'cmd'
        ? ['cmd', 'powershell']
        : preferredTerminal === 'wt'
          ? ['wt', 'powershell', 'cmd']
          : ['wt', 'powershell', 'cmd']

  return order.flatMap(kind => {
    const spec = specs[kind]
    return spec ? [spec] : []
  })
}

export async function resolveWindowsTerminalLaunchSpecs(opts: {
  preferredTerminal?: WindowsTerminalKind
  workingDirectory: string
  command: string
}): Promise<WindowsTerminalLaunchSpec[]> {
  const [wt, powershellExe, powershell, pwshExe, pwsh] = await Promise.all([
    which('wt.exe'),
    which('powershell.exe'),
    which('powershell'),
    which('pwsh.exe'),
    which('pwsh'),
  ])

  return buildWindowsTerminalLaunchSpecs({
    ...opts,
    binaries: {
      wt,
      powershell: powershellExe ?? powershell,
      pwsh: pwshExe ?? pwsh,
      cmd: (await which('cmd.exe')) ?? 'cmd.exe',
      outerShell: powershellExe ?? powershell ?? pwshExe ?? pwsh,
    },
  })
}
