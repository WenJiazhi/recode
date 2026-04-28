import { expect, test } from 'bun:test'

test('loading status icon keeps the intended ellipsis glyph', async () => {
  const source = await Bun.file(
    'src/components/design-system/StatusIcon.tsx',
  ).text()

  expect(source).toContain("icon: '…'")
})
