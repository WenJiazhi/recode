import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

test("toolCalls keeps common user-visible mojibake out of high-traffic messages", () => {
  const source = readFileSync(join(import.meta.dir, "..", "toolCalls.ts"), "utf8")

  expect(source).toContain('restriction - never use AppleScript')
  expect(source).toContain('tier "read" -')
  expect(source).toContain('tier "click" -')
  expect(source).toContain("Settings > Desktop app (General) > Computer Use > Denied apps")
  expect(source).toContain("Take a new screenshot - it may have appeared")
  expect(source).toContain("Call request_teach_access again immediately - the next call will")
  expect(source).toContain("would clear the clipboard anyway - a UI Paste button in this")
  expect(source).toContain("Dragged ${startCoord ? `(${startCoord[0]},${startCoord[1]})` : \"current\"} -> (${coord[0]},${coord[1]})")
  expect(source).toContain("region exceeds screenshot bounds (${last.width}x${last.height})")
  expect(source).toContain("Moved window to (${x}, ${y}) and resized to ${width}x${height}.")
})

test("toolCalls CuErrorKind includes emitted launch and element lookup failures", () => {
  const source = readFileSync(join(import.meta.dir, "..", "toolCalls.ts"), "utf8")

  expect(source).toContain('| "launch_failed"')
  expect(source).toContain('| "element_not_found"')
})
