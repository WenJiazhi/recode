import { expect, test } from 'bun:test'

test('PromptInputFooterSuggestions keeps the intended unified suggestion separator', async () => {
  const source = await Bun.file(
    'src/components/PromptInput/PromptInputFooterSuggestions.tsx',
  ).text()

  expect(source).toContain('lineContent = `')
  expect(source).toContain('${' + 'icon} ${' + 'displayText} · ${' + 'truncatedDesc}')
})
