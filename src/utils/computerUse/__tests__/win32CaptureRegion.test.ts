import { expect, test } from 'bun:test'

import { _test } from '../platforms/win32.js'

test('buildCaptureRegionBridgeCall uses screen-region route when no window is bound', () => {
  expect(
    _test.buildCaptureRegionBridgeCall(null, 12.4, 45.6, 100.2, 80.9, 3),
  ).toEqual({
    method: 'screenshot_region',
    params: {
      display_id: 3,
      x: 12,
      y: 46,
      w: 100,
      h: 81,
    },
  })
})

test('buildCaptureRegionBridgeCall uses window-region route when a window is bound', () => {
  expect(
    _test.buildCaptureRegionBridgeCall(
      '0x1234',
      19.8,
      24.1,
      300.6,
      220.4,
      undefined,
      null,
    ),
  ).toEqual({
    method: 'screenshot_window_region',
    params: {
      hwnd: '0x1234',
      x: 20,
      y: 24,
      w: 301,
      h: 220,
    },
  })
})

test('buildCaptureRegionBridgeCall converts screen coordinates into window-local coordinates when bound', () => {
  expect(
    _test.buildCaptureRegionBridgeCall(
      '0x1234',
      220.4,
      155.7,
      80.2,
      60.4,
      undefined,
      { x: 200, y: 100 },
    ),
  ).toEqual({
    method: 'screenshot_window_region',
    params: {
      hwnd: '0x1234',
      x: 20,
      y: 56,
      w: 80,
      h: 60,
    },
  })
})

test('buildCaptureRegionBridgeCall preserves window-local coordinates when explicitly requested', () => {
  expect(
    _test.buildCaptureRegionBridgeCall(
      '0x1234',
      20.4,
      55.7,
      80.2,
      60.4,
      undefined,
      { x: 200, y: 100 },
      { coordinateSpace: 'window' },
    ),
  ).toEqual({
    method: 'screenshot_window_region',
    params: {
      hwnd: '0x1234',
      x: 20,
      y: 56,
      w: 80,
      h: 60,
    },
  })
})
