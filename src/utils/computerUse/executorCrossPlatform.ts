/**
 * Cross-platform (Windows/Linux) ComputerExecutor implementation.
 *
 * Unlike the macOS executor which uses native modules and drainRunLoop,
 * CGEventTap, this executor delegates everything to src/utils/computerUse/platforms/.
 *
 * All operations go through the platform abstraction:
 * - Input: SendMessage (HWND-bound, no focus steal)
 * - Screenshot: PrintWindow (per-window JPEG)
 * - Display: platform-native enumeration
 * - Apps: platform-native listing/launching
 *
 * No drainRunLoop, no CGEventTap, no pbcopy/pbpaste, no native packages.
 *
 * ── Coordinate model (bound-window mode) ─────────────────────────────────
 *
 * When an HWND is bound, screenshots come from PrintWindow (the bound window),
 * NOT from the display. This means:
 *   - Image pixel coords ARE window coords (1:1 after scaleCoord)
 *   - displayWidth/displayHeight are set to the IMAGE dimensions so scaleCoord
 *     returns raw image coords unchanged
 *   - originX/originY are 0 (not the display origin)
 *   - For clicks, we subtract the non-client area offset (title bar + border)
 *     so WM_LBUTTONDOWN receives client-relative coords
 */

import type {
  ComputerExecutor,
  DisplayGeometry,
  FrontmostApp,
  InstalledApp,
  ResolvePrepareCaptureResult,
  RunningApp,
  ScreenshotResult,
} from '@recode/computer-use-mcp'

import { logForDebugging } from '../debug.js'
import { sleep } from '../sleep.js'
import { CLI_CU_CAPABILITIES, CLI_HOST_BUNDLE_ID } from './common.js'
import { validateHwnd } from './win32/shared.js'
import { loadPlatform } from './platforms/index.js'
import type { Platform } from './platforms/index.js'
import { resolveWindowsTerminalLaunchSpecs } from './windowsTerminalLaunch.js'

// ---------------------------------------------------------------------------
// Helpers for HWND-bound mode
// ---------------------------------------------------------------------------

/** Get the bound HWND string, or null */
function getBoundHwndStr(): string | null {
  if (process.platform !== 'win32') return null
  try {
    const { getBoundHwnd } =
      require('./platforms/win32.js') as typeof import('./platforms/win32.js')
    return getBoundHwnd()
  } catch {
    return null
  }
}

/** Check if we're in HWND-bound mode (Windows only) */
function isBound(): boolean {
  return getBoundHwndStr() !== null
}

/**
 * Get the non-client area offset (title bar height, left border width).
 * Returns {dx, dy} to subtract from window coords → client coords.
 * For WinUI apps with custom title bars, this may be (0, 0).
 */
function getNonClientOffset(): { dx: number; dy: number } {
  if (process.platform !== 'win32') return { dx: 0, dy: 0 }
  try {
    const { getBoundHwnd } =
      require('./platforms/win32.js') as typeof import('./platforms/win32.js')
    const hwnd = getBoundHwnd()
    if (!hwnd) return { dx: 0, dy: 0 }

    validateHwnd(hwnd)

    const result = Bun.spawnSync({
      cmd: [
        'powershell',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class NcCalc {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
}
'@
$h = [IntPtr]::new([long]${hwnd})
$wr = New-Object NcCalc+RECT
$cr = New-Object NcCalc+RECT
[NcCalc]::GetWindowRect($h, [ref]$wr) | Out-Null
[NcCalc]::GetClientRect($h, [ref]$cr) | Out-Null
$pt = New-Object NcCalc+POINT
$pt.X = 0; $pt.Y = 0
[NcCalc]::ClientToScreen($h, [ref]$pt) | Out-Null
"$($pt.X - $wr.L),$($pt.Y - $wr.T)"
`,
      ],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const out = new TextDecoder().decode(result.stdout).trim()
    const [dxStr, dyStr] = out.split(',')
    const dx = Number(dxStr) || 0
    const dy = Number(dyStr) || 0
    return { dx, dy }
  } catch {
    return { dx: 0, dy: 0 }
  }
}

// Cache non-client offset (recalculate on bind change)
let _ncOffset: { dx: number; dy: number } | null = null
let _ncOffsetHwnd: string | null = null
let _boundPointerWindowPos: { x: number; y: number } | null = null
let _boundPointerHwnd: string | null = null

function getCachedNcOffset(): { dx: number; dy: number } {
  if (process.platform !== 'win32') return { dx: 0, dy: 0 }
  try {
    const { getBoundHwnd } =
      require('./platforms/win32.js') as typeof import('./platforms/win32.js')
    const hwnd = getBoundHwnd()
    if (!hwnd) return { dx: 0, dy: 0 }
    if (_ncOffset && _ncOffsetHwnd === hwnd) return _ncOffset
    _ncOffset = getNonClientOffset()
    _ncOffsetHwnd = hwnd
    return _ncOffset
  } catch {
    return { dx: 0, dy: 0 }
  }
}

function recordBoundPointerWindowPos(x: number, y: number): void {
  const hwnd = getBoundHwndStr()
  if (!hwnd) return

  _boundPointerWindowPos = { x: Math.round(x), y: Math.round(y) }
  _boundPointerHwnd = hwnd
}

function resetBoundPointerWindowPos(): void {
  _boundPointerWindowPos = null
  _boundPointerHwnd = null
}

function resolveBoundPointerClientPosition(args: {
  boundWindowPos?: { x: number; y: number } | null
  ncOffset: { dx: number; dy: number }
  windowRect?: { x: number; y: number } | null
  realMousePos?: { x: number; y: number } | null
}): { x: number; y: number } | null {
  const { boundWindowPos, ncOffset, windowRect, realMousePos } = args

  if (boundWindowPos) {
    return {
      x: Math.round(boundWindowPos.x) - ncOffset.dx,
      y: Math.round(boundWindowPos.y) - ncOffset.dy,
    }
  }

  if (windowRect && realMousePos) {
    return {
      x: Math.round(realMousePos.x) - windowRect.x - ncOffset.dx,
      y: Math.round(realMousePos.y) - windowRect.y - ncOffset.dy,
    }
  }

  return null
}

function resolveScreenPointToBoundClientPosition(args: {
  screenPoint: { x: number; y: number }
  ncOffset: { dx: number; dy: number }
  windowRect?: { x: number; y: number } | null
}): { x: number; y: number } | null {
  const { screenPoint, ncOffset, windowRect } = args
  if (!windowRect) return null

  return {
    x: Math.round(screenPoint.x) - windowRect.x - ncOffset.dx,
    y: Math.round(screenPoint.y) - windowRect.y - ncOffset.dy,
  }
}

/**
 * Capture the accessibility tree for the bound window (Windows only).
 * Returns compact text for the model, or undefined if not available.
 */
function getAccessibilityText(): string | undefined {
  if (process.platform !== 'win32' || !isBound()) return undefined
  try {
    const { getBoundHwnd } =
      require('./platforms/win32.js') as typeof import('./platforms/win32.js')
    const hwnd = getBoundHwnd()
    if (!hwnd) return undefined
    const { captureAccessibilitySnapshot } =
      require('./win32/accessibilitySnapshot.js') as typeof import('./win32/accessibilitySnapshot.js')
    const snap = captureAccessibilitySnapshot(hwnd)
    if (!snap || !snap.text) return undefined
    return snap.text
  } catch {
    return undefined
  }
}

/**
 * Augment a raw screenshot result with the metadata scaleCoord needs.
 * When HWND-bound: set displayWidth = imageWidth so coords map 1:1.
 * Also captures accessibility snapshot on Windows for GUI element awareness.
 */
function buildUnboundScreenshotResult(
  raw: { base64: string; width: number; height: number },
  display: { width: number; height: number; displayId?: number; originX?: number; originY?: number },
): ScreenshotResult {
  return {
    base64: raw.base64,
    width: raw.width,
    height: raw.height,
    displayWidth: display.width,
    displayHeight: display.height,
    originX: display.originX ?? 0,
    originY: display.originY ?? 0,
  }
}

function augmentScreenshot(
  raw: { base64: string; width: number; height: number },
  display: { width: number; height: number; displayId?: number; originX?: number; originY?: number },
): ScreenshotResult {
  if (isBound()) {
    const accessibilityText = getAccessibilityText()
    return {
      base64: raw.base64,
      width: raw.width,
      height: raw.height,
      displayWidth: raw.width,
      displayHeight: raw.height,
      originX: 0,
      originY: 0,
      accessibilityText,
    }
  }
  return buildUnboundScreenshotResult(raw, display)
}

function toDisplayGeometry(d: {
  width: number
  height: number
  scaleFactor?: number
  displayId?: number
  originX?: number
  originY?: number
}): DisplayGeometry {
  return {
    ...d,
    scaleFactor: d.scaleFactor ?? 1,
    displayId: d.displayId ?? 0,
    originX: d.originX ?? 0,
    originY: d.originY ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export function createCrossPlatformExecutor(opts: {
  getMouseAnimationEnabled: () => boolean
  getHideBeforeActionEnabled: () => boolean
}): ComputerExecutor {
  const platform = loadPlatform()

  logForDebugging(
    `[computer-use] cross-platform executor for ${process.platform}`,
  )

  return {
    capabilities: {
      ...CLI_CU_CAPABILITIES,
      hostBundleId: CLI_HOST_BUNDLE_ID,
    },

    // ── Pre-action (no-op on non-macOS) ──────────────────────────────────

    async prepareForAction(): Promise<string[]> {
      return []
    },

    async previewHideSet(): Promise<
      Array<{ bundleId: string; displayName: string }>
    > {
      return []
    },

    // ── Display ──────────────────────────────────────────────────────────

    async getDisplaySize(displayId?: number): Promise<DisplayGeometry> {
      const d = platform.display.getSize(displayId)
      return toDisplayGeometry(d)
    },

    async listDisplays(): Promise<DisplayGeometry[]> {
      return platform.display.listAll().map(toDisplayGeometry)
    },

    async findWindowDisplays(
      bundleIds: string[],
    ): Promise<Array<{ bundleId: string; displayIds: number[] }>> {
      return bundleIds.map(b => ({ bundleId: b, displayIds: [0] }))
    },

    // ── Screenshot ───────────────────────────────────────────────────────

    async resolvePrepareCapture(opts: {
      allowedBundleIds: string[]
      preferredDisplayId?: number
      autoResolve: boolean
      doHide?: boolean
    }): Promise<ResolvePrepareCaptureResult> {
      const d = platform.display.getSize(opts.preferredDisplayId)
      const raw = await platform.screenshot.captureScreen(
        opts.preferredDisplayId,
      )
      const shot = augmentScreenshot(raw, d)
      return {
        ...shot,
        hidden: [],
        displayId: opts.preferredDisplayId ?? d.displayId ?? 0,
      }
    },

    async screenshot(opts: {
      allowedBundleIds: string[]
      displayId?: number
    }): Promise<ScreenshotResult> {
      const d = platform.display.getSize(opts.displayId)
      const raw = await platform.screenshot.captureScreen(opts.displayId)
      return augmentScreenshot(raw, d)
    },

    async zoom(
      regionLogical: { x: number; y: number; w: number; h: number },
      _allowedBundleIds: string[],
      displayId?: number,
    ): Promise<{ base64: string; width: number; height: number }> {
      return platform.screenshot.captureRegion(
        regionLogical.x,
        regionLogical.y,
        regionLogical.w,
        regionLogical.h,
        displayId,
        isBound() ? { coordinateSpace: 'window' } : undefined,
      )
    },

    // ── Keyboard ─────────────────────────────────────────────────────────

    async key(keySequence: string, repeat?: number): Promise<void> {
      const parts = keySequence.split('+').filter(p => p.length > 0)
      const n = repeat ?? 1
      for (let i = 0; i < n; i++) {
        if (i > 0) await sleep(8)
        await platform.input.keys(parts)
      }
    },

    async holdKey(keyNames: string[], durationMs: number): Promise<void> {
      const pressed: string[] = []
      let primaryError: unknown = null
      let releaseError: unknown = null
      try {
        for (const k of keyNames) {
          await platform.input.key(k, 'press')
          pressed.push(k)
        }
        await sleep(durationMs)
      } catch (error) {
        primaryError = error
      } finally {
        for (const k of [...pressed].reverse()) {
          try {
            await platform.input.key(k, 'release')
          } catch (error) {
            releaseError ??= error
          }
        }
      }
      if (primaryError) {
        throw primaryError
      }
      if (releaseError) {
        throw releaseError
      }
    },

    async type(text: string, _opts: { viaClipboard: boolean }): Promise<void> {
      await platform.input.typeText(text)
    },

    async readClipboard(): Promise<string> {
      if (process.platform === 'win32') {
        const result = Bun.spawnSync({
          cmd: ['powershell', '-NoProfile', '-Command', 'Get-Clipboard'],
          stdout: 'pipe',
        })
        return new TextDecoder().decode(result.stdout).trim()
      }
      // Linux
      const result = Bun.spawnSync({
        cmd: ['xclip', '-selection', 'clipboard', '-o'],
        stdout: 'pipe',
      })
      return new TextDecoder().decode(result.stdout).trim()
    },

    async writeClipboard(text: string): Promise<void> {
      if (process.platform === 'win32') {
        const escaped = text.replace(/'/g, "''")
        Bun.spawnSync({
          cmd: [
            'powershell',
            '-NoProfile',
            '-Command',
            `Set-Clipboard -Value '${escaped}'`,
          ],
        })
        return
      }
      // Linux
      const proc = Bun.spawn(['xclip', '-selection', 'clipboard'], {
        stdin: 'pipe',
      })
      proc.stdin.write(text)
      proc.stdin.end()
      await proc.exited
    },

    // ── Mouse ────────────────────────────────────────────────────────────

    async moveMouse(x: number, y: number): Promise<void> {
      if (isBound()) {
        recordBoundPointerWindowPos(x, y)
      }
      await platform.input.moveMouse(x, y)
    },

    async click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      _modifiers?: string[],
    ): Promise<void> {
      let clickX = Math.round(x)
      let clickY = Math.round(y)

      // When HWND-bound: scaleCoord gives us window coords (1:1 from image).
      // Subtract non-client offset to get client-area coords for WM_LBUTTONDOWN.
      if (isBound()) {
        recordBoundPointerWindowPos(x, y)
        const nc = getCachedNcOffset()
        clickX -= nc.dx
        clickY -= nc.dy
        logForDebugging(
          `[computer-use] click(${Math.round(x)},${Math.round(y)}) → client(${clickX},${clickY}) [nc offset: ${nc.dx},${nc.dy}]`,
        )
      }

      for (let i = 0; i < count; i++) {
        await platform.input.click(clickX, clickY, button)
      }
    },

    async mouseDown(): Promise<void> {
      if (isBound() && process.platform === 'win32') {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (hwnd) {
          const { sendMouseDown } =
            require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
          const nc = getCachedNcOffset()
          const pos = resolveBoundPointerClientPosition({
            boundWindowPos:
              _boundPointerHwnd === hwnd ? _boundPointerWindowPos : null,
            ncOffset: nc,
            windowRect: platform.windowManagement?.getWindowRect() ?? null,
            realMousePos: await platform.input.mouseLocation(),
          })
          if (pos) {
            if (!sendMouseDown(hwnd, pos.x, pos.y)) {
              throw new Error('Bound mouseDown failed.')
            }
            return
          }
          const realPos = await platform.input.mouseLocation()
          if (!sendMouseDown(hwnd, realPos.x, realPos.y)) {
            throw new Error('Bound mouseDown failed.')
          }
          return
        }
      }
      // Unbound: SendInput with MOUSEEVENTF_LEFTDOWN
      if (process.platform === 'win32') {
        Bun.spawnSync({
          cmd: [
            'powershell',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `Add-Type -Language CSharp @'
using System; using System.Runtime.InteropServices;
public class MDown { [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public int mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Explicit)] public struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(4)] public MOUSEINPUT mi; }
[DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] i, int cb); }
'@
$i = New-Object MDown+INPUT; $i.type=0; $i.mi.dwFlags=0x0002; [MDown]::SendInput(1, @($i), [Runtime.InteropServices.Marshal]::SizeOf($i)) | Out-Null`,
          ],
        })
        return
      }
    },

    async mouseUp(): Promise<void> {
      if (isBound() && process.platform === 'win32') {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (hwnd) {
          const { sendMouseUp } =
            require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
          const nc = getCachedNcOffset()
          const pos = resolveBoundPointerClientPosition({
            boundWindowPos:
              _boundPointerHwnd === hwnd ? _boundPointerWindowPos : null,
            ncOffset: nc,
            windowRect: platform.windowManagement?.getWindowRect() ?? null,
            realMousePos: await platform.input.mouseLocation(),
          })
          if (pos) {
            if (!sendMouseUp(hwnd, pos.x, pos.y)) {
              throw new Error('Bound mouseUp failed.')
            }
            return
          }
          const realPos = await platform.input.mouseLocation()
          if (!sendMouseUp(hwnd, realPos.x, realPos.y)) {
            throw new Error('Bound mouseUp failed.')
          }
          return
        }
      }
      // Unbound: SendInput with MOUSEEVENTF_LEFTUP
      if (process.platform === 'win32') {
        Bun.spawnSync({
          cmd: [
            'powershell',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `Add-Type -Language CSharp @'
using System; using System.Runtime.InteropServices;
public class MUp { [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public int mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Explicit)] public struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(4)] public MOUSEINPUT mi; }
[DllImport("user32.dll",SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] i, int cb); }
'@
$i = New-Object MUp+INPUT; $i.type=0; $i.mi.dwFlags=0x0004; [MUp]::SendInput(1, @($i), [Runtime.InteropServices.Marshal]::SizeOf($i)) | Out-Null`,
          ],
        })
        return
      }
    },

    async getCursorPosition(): Promise<{ x: number; y: number }> {
      const hwnd = getBoundHwndStr()
      if (hwnd && _boundPointerHwnd === hwnd && _boundPointerWindowPos) {
        return { ..._boundPointerWindowPos }
      }
      return platform.input.mouseLocation()
    },

    async drag(
      from: { x: number; y: number } | undefined,
      to: { x: number; y: number },
    ): Promise<void> {
      if (isBound() && process.platform === 'win32') {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (hwnd) {
          const { sendMouseDown, sendMouseMove, sendMouseUp } =
            require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
          const nc = getCachedNcOffset()
          const startClient = from
            ? {
                x: Math.round(from.x) - nc.dx,
                y: Math.round(from.y) - nc.dy,
              }
            : resolveBoundPointerClientPosition({
                boundWindowPos:
                  _boundPointerHwnd === hwnd ? _boundPointerWindowPos : null,
                ncOffset: nc,
                windowRect: platform.windowManagement?.getWindowRect() ?? null,
                realMousePos: await platform.input.mouseLocation(),
              })
          if (!startClient) {
            throw new Error('Bound drag start point unavailable.')
          }
          if (from) {
            recordBoundPointerWindowPos(from.x, from.y)
          }
          if (!sendMouseDown(hwnd, startClient.x, startClient.y)) {
            throw new Error('Bound drag start failed.')
          }
          await sleep(50)
          recordBoundPointerWindowPos(to.x, to.y)
          const tx = Math.round(to.x) - nc.dx
          const ty = Math.round(to.y) - nc.dy
          if (!sendMouseMove(hwnd, tx, ty)) {
            throw new Error('Bound drag move failed.')
          }
          await sleep(16)
          if (!sendMouseUp(hwnd, tx, ty)) {
            throw new Error('Bound drag end failed.')
          }
          return
        }
      }
      // Unbound: press at from, move to to, release
      if (from) {
        await platform.input.moveMouse(from.x, from.y)
        await sleep(16)
      }
      // mouseDown
      await (this as any).mouseDown()
      await sleep(50)
      await platform.input.moveMouse(to.x, to.y)
      await sleep(16)
      // mouseUp
      await (this as any).mouseUp()
    },

    async scroll(x: number, y: number, dx: number, dy: number): Promise<void> {
      if (isBound() && process.platform === 'win32') {
        if (dy !== 0) {
          const handled = await (this as any).mouseWheel(x, y, dy, false)
          if (!handled) await platform.input.scroll(dy, 'vertical')
        }
        if (dx !== 0) {
          const handled = await (this as any).mouseWheel(x, y, dx, true)
          if (!handled) await platform.input.scroll(dx, 'horizontal')
        }
        return
      }
      if (dy !== 0) await platform.input.scroll(dy, 'vertical')
      if (dx !== 0) await platform.input.scroll(dx, 'horizontal')
    },

    // ── App management ───────────────────────────────────────────────────

    async getFrontmostApp(): Promise<FrontmostApp | null> {
      // When HWND is bound, return a synthetic identity
      // so the frontmost gate passes (operations target bound window, not foreground)
      if (isBound()) {
        return { bundleId: 'cu-bound-window', displayName: 'Bound Window' }
      }
      const info = platform.apps.getFrontmostApp()
      if (!info) return null
      return { bundleId: info.id, displayName: info.appName }
    },

    async appUnderPoint(
      _x: number,
      _y: number,
    ): Promise<{ bundleId: string; displayName: string } | null> {
      return null
    },

    async listInstalledApps(): Promise<InstalledApp[]> {
      return (await platform.apps.listInstalled()).map(a => ({
        bundleId: a.id,
        displayName: a.displayName,
        path: a.path,
      }))
    },

    async getAppIcon(_path: string): Promise<string | undefined> {
      return undefined
    },

    async listRunningApps(): Promise<RunningApp[]> {
      return platform.apps.listRunning().map(w => ({
        bundleId: w.id,
        displayName: w.title,
      }))
    },

    async openApp(bundleId: string): Promise<void> {
      await platform.apps.open(bundleId)
      // Invalidate NC offset cache on new bind
      _ncOffset = null
      _ncOffsetHwnd = null
    },

    // ── Window management (Windows only) ──────────────────────────────
    async manageWindow(action: string, opts?): Promise<boolean> {
      if (!platform.windowManagement) return false
      const result = platform.windowManagement.manageWindow(action as any, opts)
      // Invalidate NC offset cache on window state change
      _ncOffset = null
      _ncOffsetHwnd = null
      return result
    },

    async getWindowRect(): Promise<{
      x: number
      y: number
      width: number
      height: number
    } | null> {
      if (!platform.windowManagement) return null
      return platform.windowManagement.getWindowRect()
    },

    // ── Open terminal + launch agent ─────────────────────────────────
    async openTerminal(opts: {
      agent: 'claude' | 'codex' | 'gemini' | 'custom'
      command?: string
      terminal?: 'wt' | 'powershell' | 'cmd'
      workingDirectory?: string
    }): Promise<{ hwnd: string; title: string; launched: boolean } | null> {
      if (process.platform !== 'win32') return null
      try {
        const { listWindows: enumWindows } =
          require('./win32/windowEnum.js') as typeof import('./win32/windowEnum.js')
        const { bindWindow } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')

        const agentCmd: Record<string, string> = {
          claude: 'claude',
          codex: 'codex',
          gemini: 'gemini',
          custom: opts.command ?? '',
        }
        const cmd = agentCmd[opts.agent]
        if (!cmd) return null

        const cwd = opts.workingDirectory ?? process.cwd()
        const launchSpecs = await resolveWindowsTerminalLaunchSpecs({
          preferredTerminal: opts.terminal,
          workingDirectory: cwd,
          command: cmd,
        })

        for (const spec of launchSpecs) {
          // Snapshot current windows for this attempt.
          const beforeHwnds = new Set(enumWindows().map(w => w.hwnd))
          const launch = Bun.spawnSync({
            cmd: [
              spec.launcherShell,
              '-NoProfile',
              '-NonInteractive',
              '-Command',
              spec.startProcessScript,
            ],
            stdout: 'ignore',
            stderr: 'ignore',
          })
          if (launch.exitCode !== 0) {
            continue
          }

          // Poll for a matching new terminal window (up to 5s)
          let newHwnd: string | null = null
          let newTitle = ''
          for (let i = 0; i < 25; i++) {
            await sleep(200)
            for (const w of enumWindows()) {
              if (beforeHwnds.has(w.hwnd)) continue
              const t = w.title.toLowerCase()
              if (spec.titleHints.some(hint => t.includes(hint))) {
                newHwnd = w.hwnd
                newTitle = w.title
                break
              }
            }
            if (newHwnd) break
          }
          if (!newHwnd) {
            continue
          }

          // Bind to new terminal
          const win = enumWindows().find(w => w.hwnd === newHwnd)
          bindWindow(newHwnd, win?.pid)
          _ncOffset = null
          _ncOffsetHwnd = null
          resetBoundPointerWindowPos()

          // Wait for agent to initialize
          await sleep(2000)
          return { hwnd: newHwnd, title: newTitle, launched: true }
        }

        return null
      } catch {
        return null
      }
    },

    // ── Window binding (Windows only) ───────────────────────────────
    async bindToWindow(query: { hwnd?: string; title?: string; pid?: number }) {
      if (process.platform !== 'win32') return null
      const { bindWindow } =
        require('./platforms/win32.js') as typeof import('./platforms/win32.js')
      const { listWindows: enumWindows } =
        require('./win32/windowEnum.js') as typeof import('./win32/windowEnum.js')
      const windows = enumWindows()

      let target: { hwnd: string; pid: number; title: string } | undefined
      if (query.hwnd) {
        target = windows.find(w => w.hwnd === query.hwnd)
      } else if (query.title) {
        const lower = query.title.toLowerCase()
        target = windows.find(w => w.title.toLowerCase().includes(lower))
      } else if (query.pid) {
        target = windows.find(w => w.pid === query.pid)
      }

      if (!target) return null
      bindWindow(target.hwnd, target.pid)
      _ncOffset = null
      _ncOffsetHwnd = null
      resetBoundPointerWindowPos()
      return target
    },

    async unbindFromWindow() {
      if (process.platform !== 'win32') return
      const { unbindWindow } =
        require('./platforms/win32.js') as typeof import('./platforms/win32.js')
      unbindWindow()
      _ncOffset = null
      _ncOffsetHwnd = null
      resetBoundPointerWindowPos()
    },

    async hasBoundWindow() {
      return isBound()
    },

    async getBindingStatus() {
      if (process.platform !== 'win32') return null
      const { getBoundHwnd } =
        require('./platforms/win32.js') as typeof import('./platforms/win32.js')
      const hwnd = getBoundHwnd()
      if (!hwnd) return { bound: false }
      const { listWindows: enumWindows } =
        require('./win32/windowEnum.js') as typeof import('./win32/windowEnum.js')
      const windows = enumWindows()
      const win = windows.find(w => w.hwnd === hwnd)
      const rect = platform.windowManagement?.getWindowRect() ?? undefined
      return {
        bound: true,
        hwnd,
        title: win?.title,
        pid: win?.pid,
        rect: rect ?? undefined,
      }
    },

    async listVisibleWindows() {
      if (process.platform !== 'win32') return []
      const { listWindows: enumWindows } =
        require('./win32/windowEnum.js') as typeof import('./win32/windowEnum.js')
      return enumWindows()
    },

    // ── Status indicator ──────────────────────────────────────────────
    async statusIndicator(
      action: 'show' | 'hide' | 'status',
      message?: string,
    ) {
      if (process.platform !== 'win32') return { active: false }
      try {
        const ind =
          require('./win32/inputIndicator.js') as typeof import('./win32/inputIndicator.js')
        if (action === 'show' && message) {
          const hwnd = getBoundHwndStr()
          if (!hwnd) return { active: false }
          if (!ind.isIndicatorActive() && !ind.showIndicator(hwnd)) {
            return { active: false }
          }
          ind.updateIndicator(message)
          return { active: ind.isIndicatorActive(), message }
        }
        if (action === 'hide') {
          ind.hideIndicator()
          return { active: ind.isIndicatorActive() }
        }
        // status
        return { active: ind.isIndicatorActive() }
      } catch {
        return { active: false, ok: false }
      }
    },

    // ── Virtual keyboard (PostMessage to bound window only) ────────────
    // Key events use PostMessage + correct lParam (scan code via MapVirtualKeyW).
    // This is required for Windows Terminal / ConPTY to correctly translate
    // WM_KEYDOWN/WM_KEYUP into console input events.
    async virtualKeyboard(opts: {
      action: 'type' | 'combo' | 'press' | 'release' | 'hold'
      text: string
      duration?: number
      repeat?: number
    }): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const hwnd = getBoundHwndStr()
        if (!hwnd) return false
        const wm =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        const { VK_MAP } =
          require('./win32/shared.js') as typeof import('./win32/shared.js')
        const repeat = opts.repeat ?? 1
        const resolveVk = (rawKey: string): number | null => {
          const lower = rawKey.toLowerCase()
          const vk =
            VK_MAP[lower] ??
            (rawKey.length === 1 ? rawKey.toUpperCase().charCodeAt(0) : 0)
          return vk || null
        }

        for (let r = 0; r < repeat; r++) {
          if (r > 0) await sleep(30)

          switch (opts.action) {
            case 'type':
              if (!wm.sendText(hwnd, opts.text)) return false
              break

            case 'combo': {
              const parts = opts.text
                .split('+')
                .map(k => k.trim())
                .filter(Boolean)
              if (!wm.sendKeys(hwnd, parts)) return false
              break
            }

            case 'press': {
              const vk = resolveVk(opts.text)
              if (vk === null) return false
              if (!wm.sendKey(hwnd, vk, 'down')) return false
              break
            }

            case 'release': {
              const vk = resolveVk(opts.text)
              if (vk === null) return false
              if (!wm.sendKey(hwnd, vk, 'up')) return false
              break
            }

            case 'hold': {
              const parts = opts.text
                .split('+')
                .map(k => k.trim())
                .filter(Boolean)
              const keys = parts.map(k => {
                const vk = resolveVk(k)
                if (vk === null) return null
                return { key: k, vk }
              })
              if (keys.some(k => k === null)) return false
              const resolvedKeys = keys as { key: string; vk: number }[]
              const pressed: number[] = []
              // Press all keys
              for (const { vk } of resolvedKeys) {
                if (!wm.sendKey(hwnd, vk, 'down')) {
                  for (const pressedVk of pressed.reverse()) {
                    wm.sendKey(hwnd, pressedVk, 'up')
                  }
                  return false
                }
                pressed.push(vk)
              }
              // Hold
              await sleep((opts.duration ?? 1) * 1000)
              // Release in reverse
              for (const { vk } of [...resolvedKeys].reverse()) {
                if (!wm.sendKey(hwnd, vk, 'up')) return false
              }
              break
            }
          }
        }
        return true
      } catch {
        return false
      }
    },

    // ── Virtual mouse (SendMessageW to bound window only) ─────────────
    async virtualMouse(opts: {
      action:
        | 'click'
        | 'double_click'
        | 'right_click'
        | 'move'
        | 'drag'
        | 'down'
        | 'up'
      x: number
      y: number
      startX?: number
      startY?: number
    }): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const hwnd = getBoundHwndStr()
        if (!hwnd) return false
        const wm =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        const vc =
          require('./win32/virtualCursor.js') as typeof import('./win32/virtualCursor.js')
        const x = Math.round(opts.x)
        const y = Math.round(opts.y)

        switch (opts.action) {
          case 'click':
            vc.moveVirtualCursor(x, y, true)
            if (!wm.sendClick(hwnd, x, y, 'left')) return false
            break
          case 'double_click':
            vc.moveVirtualCursor(x, y, true)
            if (!wm.sendClick(hwnd, x, y, 'left')) return false
            await sleep(50)
            if (!wm.sendClick(hwnd, x, y, 'left')) return false
            break
          case 'right_click':
            vc.moveVirtualCursor(x, y, true)
            if (!wm.sendClick(hwnd, x, y, 'right')) return false
            break
          case 'move':
            vc.moveVirtualCursor(x, y)
            if (!wm.sendMouseMove(hwnd, x, y)) return false
            break
          case 'drag': {
            const sx = Math.round(opts.startX ?? x)
            const sy = Math.round(opts.startY ?? y)
            vc.moveVirtualCursor(sx, sy, true)
            if (!wm.sendMouseDown(hwnd, sx, sy)) return false
            await sleep(16)
            if (!wm.sendMouseMove(hwnd, x, y)) return false
            vc.moveVirtualCursor(x, y)
            await sleep(16)
            if (!wm.sendMouseUp(hwnd, x, y)) return false
            break
          }
          case 'down':
            vc.moveVirtualCursor(x, y, true)
            if (!wm.sendMouseDown(hwnd, x, y)) return false
            break
          case 'up':
            vc.moveVirtualCursor(x, y)
            if (!wm.sendMouseUp(hwnd, x, y)) return false
            break
        }
        return true
      } catch {
        return false
      }
    },

    // ── Mouse wheel scroll (WM_MOUSEWHEEL, works on Excel/browsers) ──
    async mouseWheel(
      x: number,
      y: number,
      delta: number,
      horizontal?: boolean,
    ): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const hwnd = getBoundHwndStr()
        if (!hwnd) return false
        const nc = getCachedNcOffset()
        const wheelX = Math.round(x) - nc.dx
        const wheelY = Math.round(y) - nc.dy
        // Try Python Bridge first (via bridgeClient directly)
        try {
          const bridge =
            require('./win32/bridgeClient.js') as typeof import('./win32/bridgeClient.js')
          const result = bridge.callSync<boolean>('send_mouse_wheel', {
            hwnd,
            x: wheelX,
            y: wheelY,
            delta,
            horizontal: horizontal ?? false,
          })
          if (result === true) return true
        } catch {}
        // Fallback: windowMessage.ts (PowerShell)
        const { sendMouseWheel } =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        return sendMouseWheel(hwnd, wheelX, wheelY, delta, horizontal ?? false)
      } catch {
        return false
      }
    },

    // ── Window activation + prompt interaction ────────────────────────
    async activateWindow(clickX?: number, clickY?: number): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return false
        // Focus: restore if minimized, bring to foreground
        if (platform.windowManagement) {
          if (!platform.windowManagement.manageWindow('focus')) return false
        }
        // Click to ensure keyboard focus inside the window
        const { sendClick } =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        if (clickX !== undefined && clickY !== undefined) {
          if (!sendClick(hwnd, clickX, clickY, 'left')) return false
        } else {
          // Click center of client area
          const rect = platform.windowManagement?.getWindowRect()
          if (rect) {
            const nc = getCachedNcOffset()
            const cx = Math.round(rect.width / 2) - nc.dx
            const cy = Math.round(rect.height / 2) - nc.dy
            if (!sendClick(hwnd, cx, cy, 'left')) return false
          }
        }
        return true
      } catch {
        return false
      }
    },

    async respondToPrompt(opts: {
      responseType: 'yes' | 'no' | 'enter' | 'escape' | 'select' | 'type'
      arrowDirection?: 'up' | 'down'
      arrowCount?: number
      text?: string
    }): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return false
        const wm =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')

        const VK_RETURN = 0x0d
        const VK_ESCAPE = 0x1b
        const VK_UP = 0x26
        const VK_DOWN = 0x28

        switch (opts.responseType) {
          case 'yes':
            if (!wm.sendChar(hwnd, 'y')) return false
            await sleep(50)
            if (!wm.sendKey(hwnd, VK_RETURN, 'down')) return false
            if (!wm.sendKey(hwnd, VK_RETURN, 'up')) return false
            break
          case 'no':
            if (!wm.sendChar(hwnd, 'n')) return false
            await sleep(50)
            if (!wm.sendKey(hwnd, VK_RETURN, 'down')) return false
            if (!wm.sendKey(hwnd, VK_RETURN, 'up')) return false
            break
          case 'enter':
            if (!wm.sendKey(hwnd, VK_RETURN, 'down')) return false
            if (!wm.sendKey(hwnd, VK_RETURN, 'up')) return false
            break
          case 'escape':
            if (!wm.sendKey(hwnd, VK_ESCAPE, 'down')) return false
            if (!wm.sendKey(hwnd, VK_ESCAPE, 'up')) return false
            break
          case 'select': {
            const vk =
              (opts.arrowDirection ?? 'down') === 'down' ? VK_DOWN : VK_UP
            const count = opts.arrowCount ?? 1
            for (let i = 0; i < count; i++) {
              if (!wm.sendKey(hwnd, vk, 'down')) return false
              if (!wm.sendKey(hwnd, vk, 'up')) return false
              await sleep(30)
            }
            await sleep(50)
            if (!wm.sendKey(hwnd, VK_RETURN, 'down')) return false
            if (!wm.sendKey(hwnd, VK_RETURN, 'up')) return false
            break
          }
          case 'type':
            if (opts.text) {
              if (!wm.sendText(hwnd, opts.text)) return false
              await sleep(50)
            }
            if (!wm.sendKey(hwnd, VK_RETURN, 'down')) return false
            if (!wm.sendKey(hwnd, VK_RETURN, 'up')) return false
            break
        }
        return true
      } catch {
        return false
      }
    },

    // ── Element-targeted actions (Windows UIA) ──────────────────────────
    async clickElement(query: {
      name?: string
      role?: string
      automationId?: string
    }): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return false
        const { captureAccessibilitySnapshot, findNodeInSnapshot } =
          require('./win32/accessibilitySnapshot.js') as typeof import('./win32/accessibilitySnapshot.js')
        const snap = captureAccessibilitySnapshot(hwnd)
        if (!snap) return false
        const node = findNodeInSnapshot(snap.nodes, query)
        if (!node) return false

        // Try InvokePattern first (Button, MenuItem, Link)
        const { clickElementByHwnd: uiaClick } =
          require('./win32/uiAutomation.js') as typeof import('./win32/uiAutomation.js')
        if (node.automationId) {
          if (uiaClick(hwnd, node.automationId)) return true
        }

        // Fallback: click center of bounding rect via SendMessage
        const cx = node.bounds.x + Math.round(node.bounds.w / 2)
        const cy = node.bounds.y + Math.round(node.bounds.h / 2)
        // Convert screen coords to bound-window client coords
        const nc = getCachedNcOffset()
        const rect = platform.windowManagement?.getWindowRect() ?? null
        const { sendClick } =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        const clientPoint = resolveScreenPointToBoundClientPosition({
          screenPoint: { x: cx, y: cy },
          ncOffset: nc,
          windowRect: rect,
        })
        if (!clientPoint) return false
        return sendClick(hwnd, clientPoint.x, clientPoint.y, 'left')
      } catch {
        return false
      }
    },

    async typeIntoElement(
      query: { name?: string; role?: string; automationId?: string },
      text: string,
    ): Promise<boolean> {
      if (process.platform !== 'win32' || !isBound()) return false
      try {
        const { getBoundHwnd } =
          require('./platforms/win32.js') as typeof import('./platforms/win32.js')
        const hwnd = getBoundHwnd()
        if (!hwnd) return false

        // Try UIA ValuePattern directly
        {
          const { setValueByHwnd: setValue, findElementByHwnd: findElement } =
            require('./win32/uiAutomation.js') as typeof import('./win32/uiAutomation.js')
          // Try by automationId first, then by name+role
          if (query.automationId) {
            if (setValue(hwnd, query.automationId, text)) return true
          }
          if (query.name) {
            const el = findElement(hwnd, {
              name: query.name,
              controlType: query.role,
              automationId: query.automationId,
            })
            if (el && el.automationId) {
              if (setValue(hwnd, el.automationId, text)) return true
            }
          }
        }

        // Fallback: find the element, click it, then sendText
        const { captureAccessibilitySnapshot, findNodeInSnapshot } =
          require('./win32/accessibilitySnapshot.js') as typeof import('./win32/accessibilitySnapshot.js')
        const snap = captureAccessibilitySnapshot(hwnd)
        if (!snap) return false
        const node = findNodeInSnapshot(snap.nodes, query)
        if (!node) return false

        // Click to focus, then type
        const nc = getCachedNcOffset()
        const rect = platform.windowManagement?.getWindowRect() ?? null
        const clientPoint = resolveScreenPointToBoundClientPosition({
          screenPoint: {
            x: node.bounds.x + Math.round(node.bounds.w / 2),
            y: node.bounds.y + Math.round(node.bounds.h / 2),
          },
          ncOffset: nc,
          windowRect: rect,
        })
        if (!clientPoint) return false
        const { sendClick, sendText } =
          require('./win32/windowMessage.js') as typeof import('./win32/windowMessage.js')
        if (!sendClick(hwnd, clientPoint.x, clientPoint.y, 'left')) return false
        await sleep(50)
        return sendText(hwnd, text)
      } catch {
        return false
      }
    },
  }
}

/**
 * Module-level unhide — no-op on non-macOS (we don't hide apps).
 */
export async function unhideComputerUseAppsCrossPlatform(
  _bundleIds: readonly string[],
): Promise<void> {
  // No-op: Windows/Linux don't use hide/unhide
}

export const _test = {
  buildUnboundScreenshotResult,
  resolveBoundPointerClientPosition,
  resolveScreenPointToBoundClientPosition,
  toDisplayGeometry,
}
