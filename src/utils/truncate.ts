// Width-aware truncation/wrapping - needs ink/stringWidth (not leaf-safe).

import { stringWidth } from '../ink/stringWidth.js'
import { getGraphemeSegmenter } from './intl.js'

const ELLIPSIS = '…'

/**
 * Truncates a file path in the middle to preserve both directory context and filename.
 * Width-aware: uses stringWidth() for correct CJK/emoji measurement.
 * For example: "src/components/deeply/nested/folder/MyComponent.tsx" becomes
 * "src/components/…/MyComponent.tsx" when maxLength is 30.
 *
 * @param path The file path to truncate
 * @param maxLength Maximum display width of the result in terminal columns (must be > 0)
 * @returns The truncated path, or original if it fits within maxLength
 */
export function truncatePathMiddle(path: string, maxLength: number): string {
  if (stringWidth(path) <= maxLength) {
    return path
  }

  if (maxLength <= 0) {
    return ELLIPSIS
  }

  if (maxLength < 5) {
    return truncateToWidth(path, maxLength)
  }

  const lastSlash = path.lastIndexOf('/')
  const filename = lastSlash >= 0 ? path.slice(lastSlash) : path
  const directory = lastSlash >= 0 ? path.slice(0, lastSlash) : ''
  const filenameWidth = stringWidth(filename)

  if (filenameWidth >= maxLength - stringWidth(ELLIPSIS)) {
    return truncateStartToWidth(path, maxLength)
  }

  const availableForDir = maxLength - stringWidth(ELLIPSIS) - filenameWidth

  if (availableForDir <= 0) {
    return truncateStartToWidth(filename, maxLength)
  }

  const truncatedDir = truncateToWidthNoEllipsis(directory, availableForDir)
  return `${truncatedDir}${ELLIPSIS}${filename}`
}

/**
 * Truncates a string to fit within a maximum display width, measured in terminal columns.
 * Splits on grapheme boundaries to avoid breaking emoji or surrogate pairs.
 * Appends an ellipsis when truncation occurs.
 */
export function truncateToWidth(text: string, maxWidth: number): string {
  if (stringWidth(text) <= maxWidth) return text
  if (maxWidth <= stringWidth(ELLIPSIS)) return ELLIPSIS

  let width = 0
  let result = ''
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    const segWidth = stringWidth(segment)
    if (width + segWidth > maxWidth - stringWidth(ELLIPSIS)) break
    result += segment
    width += segWidth
  }
  return result + ELLIPSIS
}

/**
 * Truncates from the start of a string, keeping the tail end.
 * Prepends an ellipsis when truncation occurs.
 * Width-aware and grapheme-safe.
 */
export function truncateStartToWidth(text: string, maxWidth: number): string {
  if (stringWidth(text) <= maxWidth) return text
  if (maxWidth <= stringWidth(ELLIPSIS)) return ELLIPSIS

  const segments = [...getGraphemeSegmenter().segment(text)]
  let width = 0
  let startIdx = segments.length
  for (let i = segments.length - 1; i >= 0; i--) {
    const segWidth = stringWidth(segments[i]!.segment)
    if (width + segWidth > maxWidth - stringWidth(ELLIPSIS)) break
    width += segWidth
    startIdx = i
  }

  return (
    ELLIPSIS +
    segments
      .slice(startIdx)
      .map(s => s.segment)
      .join('')
  )
}

/**
 * Truncates a string to fit within a maximum display width, without appending an ellipsis.
 * Useful when the caller adds its own separator (e.g. middle-truncation with an ellipsis between parts).
 * Width-aware and grapheme-safe.
 */
export function truncateToWidthNoEllipsis(
  text: string,
  maxWidth: number,
): string {
  if (stringWidth(text) <= maxWidth) return text
  if (maxWidth <= 0) return ''

  let width = 0
  let result = ''
  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    const segWidth = stringWidth(segment)
    if (width + segWidth > maxWidth) break
    result += segment
    width += segWidth
  }
  return result
}

/**
 * Truncates a string to fit within a maximum display width (terminal columns),
 * splitting on grapheme boundaries to avoid breaking emoji, CJK, or surrogate pairs.
 * Appends an ellipsis when truncation occurs.
 * @param str The string to truncate
 * @param maxWidth Maximum display width in terminal columns
 * @param singleLine If true, also truncates at the first newline
 * @returns The truncated string with ellipsis if needed
 */
export function truncate(
  str: string,
  maxWidth: number,
  singleLine: boolean = false,
): string {
  let result = str

  if (singleLine) {
    const firstNewline = str.indexOf('\n')
    if (firstNewline !== -1) {
      result = str.substring(0, firstNewline)
      if (stringWidth(result) + stringWidth(ELLIPSIS) > maxWidth) {
        return truncateToWidth(result, maxWidth)
      }
      return `${result}${ELLIPSIS}`
    }
  }

  if (stringWidth(result) <= maxWidth) {
    return result
  }
  return truncateToWidth(result, maxWidth)
}

export function wrapText(text: string, width: number): string[] {
  const lines: string[] = []
  let currentLine = ''
  let currentWidth = 0

  for (const { segment } of getGraphemeSegmenter().segment(text)) {
    const segWidth = stringWidth(segment)
    if (currentWidth + segWidth <= width) {
      currentLine += segment
      currentWidth += segWidth
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = segment
      currentWidth = segWidth
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines
}
