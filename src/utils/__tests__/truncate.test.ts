import { expect, test } from 'bun:test'

import { addLineNumbers, stripLineNumberPrefix } from '../file.js'
import {
  truncate,
  truncatePathMiddle,
  truncateStartToWidth,
  truncateToWidth,
} from '../truncate.js'

test('addLineNumbers keeps the default compact tab prefix', () => {
  expect(addLineNumbers({ content: 'alpha\nbeta', startLine: 7 })).toBe(
    '7\talpha\n8\tbeta',
  )
})

test('stripLineNumberPrefix accepts the padded arrow format', () => {
  expect(stripLineNumberPrefix('     7→alpha')).toBe('alpha')
})

test('truncateToWidth uses a real ellipsis', () => {
  expect(truncateToWidth('abcdefgh', 5)).toBe('abcd…')
  expect(truncateStartToWidth('abcdefgh', 5)).toBe('…efgh')
})

test('truncatePathMiddle preserves both directory and filename around an ellipsis', () => {
  expect(
    truncatePathMiddle(
      'src/components/deeply/nested/folder/MyComponent.tsx',
      30,
    ),
  ).toContain('…')
})

test('truncate appends an ellipsis for single-line newline truncation', () => {
  expect(truncate('first line\nsecond line', 20, true)).toBe('first line…')
})
