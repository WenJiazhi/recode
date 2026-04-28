import { expect, test } from 'bun:test'

import { _test } from '../executorCrossPlatform.js'

test('toDisplayGeometry preserves explicit non-zero display origins', () => {
  expect(
    _test.toDisplayGeometry({
      width: 2560,
      height: 1440,
      scaleFactor: 1,
      displayId: 2,
      originX: 1920,
      originY: -120,
    }),
  ).toEqual({
    width: 2560,
    height: 1440,
    scaleFactor: 1,
    displayId: 2,
    originX: 1920,
    originY: -120,
  })
})

test('buildUnboundScreenshotResult keeps the display origin in screenshot metadata', () => {
  expect(
    _test.buildUnboundScreenshotResult(
      { base64: 'abc', width: 1568, height: 980 },
      { width: 2560, height: 1440, displayId: 2, originX: 1920, originY: 0 },
    ),
  ).toEqual({
    base64: 'abc',
    width: 1568,
    height: 980,
    displayWidth: 2560,
    displayHeight: 1440,
    originX: 1920,
    originY: 0,
  })
})
