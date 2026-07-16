import { expect, test } from 'bun:test'
import {
  filterOpenAIToolsForRequest,
  getOpenAIRequestMaxTokens,
} from '../index.js'
import { TOOL_SEARCH_TOOL_NAME } from '../../../../tools/ToolSearchTool/prompt.js'

test('getOpenAIRequestMaxTokens prefers explicit override', () => {
  expect(getOpenAIRequestMaxTokens('gpt-5.4(high)', 12345)).toBe(12345)
})

test('getOpenAIRequestMaxTokens falls back to model upper limit', () => {
  expect(getOpenAIRequestMaxTokens('gpt-5.4(high)')).toBe(64000)
})

test('filterOpenAIToolsForRequest removes ToolSearch when tool search is disabled', () => {
  const tools = [
    { name: TOOL_SEARCH_TOOL_NAME },
    { name: 'Read' },
  ] as any

  const result = filterOpenAIToolsForRequest(tools, {
    useToolSearch: false,
    deferredToolNames: new Set(),
    discoveredToolNames: new Set(),
  })

  expect(result.map(tool => tool.name)).toEqual(['Read'])
})

test('filterOpenAIToolsForRequest keeps only discovered deferred tools', () => {
  const tools = [
    { name: TOOL_SEARCH_TOOL_NAME },
    { name: 'Read' },
    { name: 'TaskGet' },
    { name: 'TaskUpdate' },
  ] as any

  const result = filterOpenAIToolsForRequest(tools, {
    useToolSearch: true,
    deferredToolNames: new Set(['TaskGet', 'TaskUpdate']),
    discoveredToolNames: new Set(['TaskGet']),
  })

  expect(result.map(tool => tool.name)).toEqual([
    TOOL_SEARCH_TOOL_NAME,
    'Read',
    'TaskGet',
  ])
})
