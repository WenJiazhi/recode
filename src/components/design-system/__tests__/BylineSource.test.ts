import { expect, test } from 'bun:test'

test('Byline keeps the intended middot separator', async () => {
  const source = await Bun.file('src/components/design-system/Byline.tsx').text()

  expect(source).toContain('<Text dimColor={true}> · </Text>')
})
