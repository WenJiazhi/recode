import { expect, test } from 'bun:test'

import { _test } from '../platforms/win32.js'

test('parseDisplayListOutput preserves Windows screen origins', () => {
  expect(
    _test.parseDisplayListOutput('1920,1080,0,0,0,True|2560,1440,1920,-120,1,False'),
  ).toEqual([
    {
      width: 1920,
      height: 1080,
      scaleFactor: 1,
      displayId: 0,
      originX: 0,
      originY: 0,
    },
    {
      width: 2560,
      height: 1440,
      scaleFactor: 1,
      displayId: 1,
      originX: 1920,
      originY: -120,
    },
  ])
})
