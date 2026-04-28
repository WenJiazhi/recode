import { expect, test } from 'bun:test'

import { _test } from '../executorCrossPlatform.js'

test('resolveBoundPointerClientPosition prefers recorded bound-window coordinates', () => {
  const result = _test.resolveBoundPointerClientPosition({
    boundWindowPos: { x: 120, y: 80 },
    ncOffset: { dx: 8, dy: 30 },
    windowRect: { x: 400, y: 300, width: 900, height: 700 },
    realMousePos: { x: 999, y: 999 },
  })

  expect(result).toEqual({ x: 112, y: 50 })
})

test('resolveBoundPointerClientPosition falls back to real mouse position when needed', () => {
  const result = _test.resolveBoundPointerClientPosition({
    boundWindowPos: null,
    ncOffset: { dx: 8, dy: 30 },
    windowRect: { x: 400, y: 300, width: 900, height: 700 },
    realMousePos: { x: 520, y: 460 },
  })

  expect(result).toEqual({ x: 112, y: 130 })
})

test('resolveScreenPointToBoundClientPosition subtracts window origin and non-client offset', () => {
  const result = _test.resolveScreenPointToBoundClientPosition({
    screenPoint: { x: 520, y: 340 },
    ncOffset: { dx: 8, dy: 30 },
    windowRect: { x: 400, y: 200 },
  })

  expect(result).toEqual({ x: 112, y: 110 })
})

test('resolveScreenPointToBoundClientPosition returns null without a window rect', () => {
  const result = _test.resolveScreenPointToBoundClientPosition({
    screenPoint: { x: 520, y: 340 },
    ncOffset: { dx: 8, dy: 30 },
    windowRect: null,
  })

  expect(result).toBeNull()
})
