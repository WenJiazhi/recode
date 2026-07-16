import { expect, test } from 'bun:test'

test('SkillsMenu keeps the intended metadata separators', async () => {
  const source = await Bun.file('src/components/skills/SkillsMenu.tsx').text()

  expect(source).toContain('` · ${' + 'pluginName' + '}`')
  expect(source).toContain(' · {tokenDisplay} description')
  expect(source).toContain('tokens')
})
