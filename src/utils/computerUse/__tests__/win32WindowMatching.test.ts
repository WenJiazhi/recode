import { expect, test } from 'bun:test'

import { _test } from '../platforms/win32.js'

test('normalizeWindowMatchHint strips paths and .exe suffixes', () => {
  expect(
    _test.normalizeWindowMatchHint(
      'C:\\Users\\test\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe',
    ),
  ).toBe('wt')
  expect(_test.normalizeWindowMatchHint('PowerShell.EXE')).toBe('powershell')
  expect(_test.normalizeWindowMatchHint('  Windows Terminal  ')).toBe(
    'windows terminal',
  )
})

test('titleMatchesExistingWindowHint accepts strong title matches only', () => {
  expect(
    _test.titleMatchesExistingWindowHint(
      'Windows Terminal - PowerShell',
      'Windows Terminal',
    ),
  ).toBe(true)
  expect(
    _test.titleMatchesExistingWindowHint('notes.txt - Notepad', 'Notepad'),
  ).toBe(true)
  expect(
    _test.titleMatchesExistingWindowHint('Claude Code - Windows Terminal', 'Terminal'),
  ).toBe(false)
  expect(
    _test.titleMatchesExistingWindowHint('Visual Studio Code', 'Code'),
  ).toBe(false)
})
