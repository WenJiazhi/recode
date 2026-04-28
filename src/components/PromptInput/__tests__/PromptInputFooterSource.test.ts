import { expect, test } from 'bun:test'

test('PromptInputFooter keeps the intended bridge status separator', async () => {
  const source = await Bun.file(
    'src/components/PromptInput/PromptInputFooter.tsx',
  ).text()

  expect(source).toContain('{bridgeSelected && <Text dimColor> · Enter to view</Text>}')
})
