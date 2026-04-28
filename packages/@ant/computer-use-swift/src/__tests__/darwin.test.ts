import { expect, test } from 'bun:test'
import { parseInstalledAppRows } from '../backends/darwin'

test('parseInstalledAppRows keeps real bundle ids and drops null rows', () => {
  const rows = [
    '/Applications/Google Chrome.app|Google Chrome|com.google.Chrome',
    '/Applications/Broken.app|Broken|(null)',
  ].join('\n')

  expect(parseInstalledAppRows(rows)).toEqual([
    {
      path: '/Applications/Google Chrome.app',
      displayName: 'Google Chrome',
      bundleId: 'com.google.Chrome',
    },
  ])
})

test('parseInstalledAppRows deduplicates by bundle id', () => {
  const rows = [
    '/Applications/Google Chrome.app|Google Chrome|com.google.Chrome',
    '/System/Applications/Google Chrome.app|Google Chrome|com.google.Chrome',
    '/Applications/Safari.app|Safari|com.apple.Safari',
  ].join('\n')

  expect(parseInstalledAppRows(rows)).toEqual([
    {
      path: '/Applications/Google Chrome.app',
      displayName: 'Google Chrome',
      bundleId: 'com.google.Chrome',
    },
    {
      path: '/Applications/Safari.app',
      displayName: 'Safari',
      bundleId: 'com.apple.Safari',
    },
  ])
})
